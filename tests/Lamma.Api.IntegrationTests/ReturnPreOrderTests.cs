using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class ReturnPreOrderApiTests(LammaApiFactory factory)
{
    private async Task<(ApiSession Session, Guid Customer, JsonElement Product, Guid Variant)> ShopAsync(int stock = 10)
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var item = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: stock));
        return (session, customer, item, OrderApi.VariantAt(item, 0));
    }

    private static Task<HttpResponseMessage> ReturnAsync(ApiSession session, JsonElement order, DateOnly on, object[] lines, string? refund = null)
        => session.PostIdempotentAsync(
            $"/api/v1/orders/{order.GetProperty("id").GetGuid()}/returns",
            new { lines, returnedOn = FinanceApi.Day(on), reason = "مقاس غلط", refund = refund is null ? null : new { amount = refund, method = "cash" } },
            Guid.NewGuid());

    private static object Line(JsonElement order, int qty, bool restock) => new { orderItemId = order.GetProperty("items")[0].GetProperty("id").GetGuid(), quantity = qty, restock };

    [Fact]
    public async Task Paid_order_returned_in_two_steps_refunds_exactly_and_updates_every_figure()
    {
        var (session, customer, product, variant) = await ShopAsync();
        var today = factory.Today();
        var order = await session.OrderAsync(customer, variant, 3); // 3 × 10 + 2 fee − 1 discount = 31
        await session.PayOrderAsync(order, "31", today).OkJsonAsync();
        order = await session.MovedAsync(order, "delivered");

        await (await ReturnAsync(session, order, today, [Line(order, 1, true)], "5")).AssertProblemAsync(HttpStatusCode.Conflict, "return.refund_out_of_range");
        var partial = await ReturnAsync(session, order, today, [Line(order, 1, true)], "9.67").OkJsonAsync(); // 10 − round2(1 × 10 / 30) = 9.67
        Assert.Equal(("delivered", true, "9.670", "21.330"), (partial.GetProperty("status").GetString(), partial.GetProperty("isPartiallyReturned").GetBoolean(), partial.GetProperty("returnedAmount").GetString(), partial.GetProperty("netTotal").GetString()));
        Assert.Equal("paid", partial.Status()); // the refund took paid exactly to the net total
        Assert.Equal(1, partial.GetProperty("items")[0].GetProperty("returnedQuantity").GetInt32());

        var rest = await ReturnAsync(session, order, today, [Line(order, 2, false)], "19.33").OkJsonAsync();
        Assert.Equal(("returned", "29.000", "2.000", "paid"), (rest.GetProperty("status").GetString(), rest.GetProperty("returnedAmount").GetString(), rest.GetProperty("netTotal").GetString(), rest.Status())); // the 2.00 fee stays
        Assert.Equal(JsonValueKind.Null, rest.GetProperty("undo").ValueKind); // final (D-150)
        await (await ReturnAsync(session, order, today, [Line(order, 1, true)])).AssertProblemAsync(HttpStatusCode.Conflict, "return.not_delivered");

        var refundId = rest.GetProperty("payments").EnumerateArray().First(p => p.GetProperty("kind").GetString() == "refund").GetProperty("paymentId").GetGuid();
        await (await session.ReverseAsync(refundId)).AssertProblemAsync(HttpStatusCode.Conflict, "payment.from_return");

        Assert.Equal((8, 0, 0), await session.StockAsync(product)); // 10 − 3 delivered + 1 restocked; sold 3 − 3 returned
        var c = await session.GetJsonAsync($"/api/v1/customers/{customer}");
        Assert.Equal("2.000", c.GetProperty("totalSpent").GetString());

        var o = await session.GetJsonAsync("/api/v1/finance/overview");
        string F(string name) => o.GetProperty(name).GetString()!;
        Assert.Equal(("31.000", "29.000", "2.000"), (F("sales"), F("returns"), F("netSales")));
        Assert.Equal(("8.000", "-6.000"), (F("cogs"), F("grossProfit"))); // 12 − 4 restocked
        Assert.Equal("2.000", F("cashReceived")); // 31 in − 29 refunded
    }

    [Fact]
    public async Task Unpaid_order_return_just_lowers_what_is_owed_and_quantities_are_checked()
    {
        var (session, customer, _, variant) = await ShopAsync();
        var today = factory.Today();
        var order = await session.MovedAsync(await session.OrderAsync(customer, variant, 3), "delivered");

        await (await ReturnAsync(session, order, today, [Line(order, 4, true)])).AssertProblemAsync(HttpStatusCode.Conflict, "return.quantity_too_high");
        await (await ReturnAsync(session, order, today, [Line(order, 1, true)], "1")).AssertProblemAsync(HttpStatusCode.Conflict, "return.refund_out_of_range");
        await (await ReturnAsync(session, order, today.AddDays(1), [Line(order, 1, true)])).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "return.invalid_date");

        var returned = await ReturnAsync(session, order, today, [Line(order, 1, true)]).OkJsonAsync();
        Assert.Equal(("21.330", "unpaid"), (returned.GetProperty("remaining").GetString(), returned.Status()));
        Assert.Equal("21.330", await session.BalanceAsync(customer));
    }

    [Fact]
    public async Task Pre_order_can_exceed_stock_shows_on_the_calendar_and_cannot_be_confirmed_until_stock_arrives()
    {
        var (session, customer, _, variant) = await ShopAsync(stock: 1);
        var today = factory.Today();
        object Body(DateOnly on) => new
        {
            customerId = customer,
            channel = "instagram",
            items = new[] { new { variantId = variant, quantity = 3 } },
            deliveryFee = "0",
            discount = "0",
            isGift = false,
            status = "new",
            expectedDeliveryOn = FinanceApi.Day(on),
            expectedDeliveryTime = "14:30",
        };

        await (await session.PlaceAsync(Body(today.AddDays(-1)))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "order.invalid_schedule");
        var created = await session.PlaceAsync(Body(today.AddDays(3)));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var order = await created.JsonAsync();
        Assert.Equal((FinanceApi.Day(today.AddDays(3)), "14:30", "new"), (order.GetProperty("expectedDeliveryOn").GetString(), order.GetProperty("expectedDeliveryTime").GetString(), order.GetProperty("status").GetString()));

        var calendar = await session.GetJsonAsync($"/api/v1/orders/preorders?from={FinanceApi.Day(today)}&to={FinanceApi.Day(today.AddDays(13))}");
        var entry = Assert.Single(calendar.EnumerateArray());
        Assert.Equal((order.GetProperty("id").GetGuid(), "14:30"), (entry.GetProperty("id").GetGuid(), entry.GetProperty("expectedDeliveryTime").GetString()));
        Assert.Equal(1, (await session.GetJsonAsync("/api/v1/orders?isPreOrder=true")).GetProperty("totalCount").GetInt32());

        await (await session.MoveAsync(order, "confirmed")).AssertProblemAsync(HttpStatusCode.Conflict, "stock.not_available");
    }

    [Fact]
    public async Task Another_business_cannot_return_or_see_pre_orders()
    {
        var (owner, customer, _, variant) = await ShopAsync();
        var order = await owner.MovedAsync(await owner.OrderAsync(customer, variant, 1), "delivered");

        var other = await factory.OnboardedAsync();
        await (await ReturnAsync(other, order, factory.Today(), [Line(order, 1, true)])).AssertProblemAsync(HttpStatusCode.NotFound, "order.not_found");
        Assert.Empty((await other.GetJsonAsync("/api/v1/orders/preorders")).EnumerateArray());
    }
}
