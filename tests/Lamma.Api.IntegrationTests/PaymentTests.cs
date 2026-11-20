using System.Globalization;
using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Domain.Common;

namespace Lamma.Api.IntegrationTests;

internal static class PaymentApi
{
    /// <summary>An order of one 10 JOD item × qty, fee 2, discount 1 (total = 10·qty + 1), expected method <paramref name="method"/>.</summary>
    public static object Body(Guid customerId, Guid variantId, int qty, string status = "confirmed", string? method = "cash", object? payment = null)
        => new
        {
            customerId,
            channel = "instagram",
            items = new[] { new { variantId, quantity = qty } },
            deliveryFee = "2",
            discount = "1",
            paymentMethod = method,
            isGift = false,
            status,
            payment,
        };

    public static async Task<JsonElement> OrderAsync(this ApiSession session, Guid customerId, Guid variantId, int qty, string status = "confirmed", string? method = "cash")
    {
        var response = await session.PlaceAsync(Body(customerId, variantId, qty, status, method));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.JsonAsync();
    }

    public static DateOnly Today(this LammaApiFactory factory)
        => BusinessTime.LocalDate(factory.Clock.UtcNow, BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId));

    public static Task<HttpResponseMessage> PayOrderAsync(this ApiSession session, JsonElement order, string amount, DateOnly paidOn, string method = "cash", Guid? key = null)
        => session.PostIdempotentAsync($"/api/v1/orders/{order.GetProperty("id").GetGuid()}/payments", new { amount, method, paidOn = paidOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) }, key ?? Guid.NewGuid());

    public static Task<HttpResponseMessage> PayCustomerAsync(this ApiSession session, Guid customerId, string amount, DateOnly paidOn, string method = "cliq")
        => session.PostIdempotentAsync($"/api/v1/customers/{customerId}/payments", new { amount, method, paidOn = paidOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) }, Guid.NewGuid());

    public static Task<HttpResponseMessage> ReverseAsync(this ApiSession session, Guid paymentId)
        => session.PostIdempotentAsync($"/api/v1/payments/{paymentId}/reverse", new { reason = "دخلت غلط" }, Guid.NewGuid());

    public static async Task<JsonElement> OkJsonAsync(this Task<HttpResponseMessage> request)
    {
        var response = await request;
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.JsonAsync();
    }

    public static async Task<string> BalanceAsync(this ApiSession session, Guid customerId)
        => (await (await session.GetAsync($"/api/v1/customers/{customerId}")).JsonAsync()).GetProperty("balanceDue").GetString()!;

    public static string Status(this JsonElement summary) => summary.GetProperty("paymentStatus").GetString()!;
}

[Collection(ApiCollection.Name)]
public sealed class PaymentApiTests(LammaApiFactory factory)
{
    private async Task<(ApiSession Session, Guid Customer, Guid Variant)> ShopAsync()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var item = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100));
        return (session, customer, OrderApi.VariantAt(item, 0));
    }

    [Fact]
    public async Task Partial_then_rest_makes_the_order_paid_and_bad_payments_are_rejected()
    {
        var (session, customer, variant) = await ShopAsync();
        var order = await session.OrderAsync(customer, variant, 3); // total 31
        var today = factory.Today();
        var key = Guid.NewGuid();

        var first = await session.PayOrderAsync(order, "10", today, key: key).OkJsonAsync();
        var retry = await session.PayOrderAsync(order, "10", today, key: key).OkJsonAsync();

        Assert.Equal(first.GetProperty("payment").GetProperty("id").GetGuid(), retry.GetProperty("payment").GetProperty("id").GetGuid());
        var summary = Assert.Single(first.GetProperty("orders").EnumerateArray());
        Assert.Equal(("partial", "10.000", "21.000"), (summary.Status(), summary.GetProperty("paid").GetString(), summary.GetProperty("remaining").GetString()));
        Assert.Equal("0.000", first.GetProperty("customerBalance").GetString()); // not delivered: not a receivable (D-134)

        await (await session.PayOrderAsync(order, "21.01", today)).AssertProblemAsync(HttpStatusCode.Conflict, "payment.exceeds_remaining");
        await (await session.PayOrderAsync(order, "5", today, method: "cod")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment.method_not_allowed");
        await (await session.PayOrderAsync(order, "5", today, method: "zain_cash")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment.method_not_allowed"); // disabled by default
        await (await session.PayOrderAsync(order, "5", today.AddDays(1))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment.invalid_date");
        await (await session.PayOrderAsync(order, "5", today.AddDays(-1))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment.invalid_date"); // before the order existed
        await (await session.PayOrderAsync(order, "0.001", today)).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");

        var rest = await session.PayOrderAsync(order, "21", today).OkJsonAsync();
        Assert.Equal("paid", rest.GetProperty("orders")[0].Status());

        var details = await (await session.GetAsync($"/api/v1/orders/{order.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(("31.000", "0.000", "paid", 2), (details.GetProperty("paid").GetString(), details.GetProperty("remaining").GetString(), details.Status(), details.GetProperty("payments").GetArrayLength()));
        var row = Assert.Single((await (await session.GetAsync("/api/v1/orders")).JsonAsync()).GetProperty("items").EnumerateArray());
        Assert.Equal(("paid", "31.000"), (row.Status(), row.GetProperty("paid").GetString()));
        var list = await (await session.GetAsync($"/api/v1/payments?orderId={order.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(2, list.GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Two_concurrent_payments_for_the_rest_one_wins_and_one_gets_a_conflict()
    {
        var (session, customer, variant) = await ShopAsync();
        await session.RefreshTokenAsync();
        var order = await session.OrderAsync(customer, variant, 3); // total 31
        var today = factory.Today();

        var responses = await Task.WhenAll(session.PayOrderAsync(order, "31", today), session.PayOrderAsync(order, "31", today));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        await responses.Single(r => r.StatusCode != HttpStatusCode.OK).AssertProblemAsync(HttpStatusCode.Conflict, "payment.exceeds_remaining");
        var details = await (await session.GetAsync($"/api/v1/orders/{order.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(("31.000", "paid"), (details.GetProperty("paid").GetString(), details.Status()));
    }

    [Fact]
    public async Task Customer_payment_is_split_oldest_first_reversal_restores_and_aging_buckets_are_exact()
    {
        var (session, customer, variant) = await ShopAsync();
        var now = factory.Clock.UtcNow;
        JsonElement a, b, c;
        try
        {
            factory.Clock.UtcNow = now.AddDays(-10);
            a = await session.MovedAsync(await session.OrderAsync(customer, variant, 1), "delivered"); // 11, late (10 days)
            factory.Clock.UtcNow = now.AddDays(-5);
            b = await session.MovedAsync(await session.OrderAsync(customer, variant, 1), "delivered"); // 11, fresh (5 days)
            await session.PayOrderAsync(b, "5", factory.Today()).OkJsonAsync();                      // b: 6 left
        }
        finally
        {
            factory.Clock.UtcNow = now;
        }

        c = await session.MovedAsync(await session.OrderAsync(customer, variant, 1), "delivered");        // 11, fresh (today)
        await session.MovedAsync(await session.OrderAsync(customer, variant, 1, method: "cod"), "delivered"); // courier-held 11
        await session.OrderAsync(customer, variant, 2);                                                      // confirmed 21: not due yet
        var today = factory.Today();

        Assert.Equal("28.000", await session.BalanceAsync(customer));
        var aging = await (await session.GetAsync("/api/v1/finance/receivables/aging")).JsonAsync();
        Assert.Equal(("28.000", 3, 1), (aging.GetProperty("total").GetString(), aging.GetProperty("count").GetInt32(), aging.GetProperty("customerCount").GetInt32()));
        Assert.Equal(("17.000", 2), (aging.GetProperty("fresh").GetProperty("amount").GetString(), aging.GetProperty("fresh").GetProperty("count").GetInt32()));
        Assert.Equal(("11.000", "0.000"), (aging.GetProperty("late").GetProperty("amount").GetString(), aging.GetProperty("overdue").GetProperty("amount").GetString()));
        Assert.Equal(("11.000", 1), (aging.GetProperty("courierHeld").GetString(), aging.GetProperty("courierHeldCount").GetInt32()));
        var late = await (await session.GetAsync("/api/v1/finance/receivables?bucket=late")).JsonAsync();
        var lateRow = Assert.Single(late.GetProperty("items").EnumerateArray());
        Assert.Equal((a.GetProperty("id").GetGuid(), 10, "late"), (lateRow.GetProperty("orderId").GetGuid(), lateRow.GetProperty("ageDays").GetInt32(), lateRow.GetProperty("bucket").GetString()));
        var owes = await (await session.GetAsync("/api/v1/customers?segment=owes")).JsonAsync();
        Assert.Equal(1, owes.GetProperty("totalCount").GetInt32());

        var result = await session.PayCustomerAsync(customer, "20", today).OkJsonAsync();

        var allocations = result.GetProperty("payment").GetProperty("allocations").EnumerateArray()
            .Select(x => (x.GetProperty("orderId").GetGuid(), x.GetProperty("amount").GetString())).ToList();
        Assert.Equal([(a.GetProperty("id").GetGuid(), "11.000"), (b.GetProperty("id").GetGuid(), "6.000"), (c.GetProperty("id").GetGuid(), "3.000")], allocations);
        Assert.Equal(["paid", "paid", "partial"], result.GetProperty("orders").EnumerateArray().Select(o => o.Status()));
        Assert.Equal("8.000", result.GetProperty("customerBalance").GetString());
        await (await session.PayCustomerAsync(customer, "8.01", today)).AssertProblemAsync(HttpStatusCode.Conflict, "payment.exceeds_balance");

        var paymentId = result.GetProperty("payment").GetProperty("id").GetGuid();
        var reversed = await session.ReverseAsync(paymentId).OkJsonAsync();
        Assert.True(reversed.GetProperty("payment").GetProperty("isReversed").GetBoolean());
        Assert.Equal("28.000", reversed.GetProperty("customerBalance").GetString());
        await (await session.ReverseAsync(paymentId)).AssertProblemAsync(HttpStatusCode.Conflict, "payment.already_reversed");
        var history = await (await session.GetAsync($"/api/v1/payments?customerId={customer}")).JsonAsync();
        Assert.Equal(2, history.GetProperty("totalCount").GetInt32()); // reversed payments stay in history (D-136)
    }

    [Fact]
    public async Task Deposit_at_creation_blocks_cancel_until_reversed_and_edits_below_paid()
    {
        var (session, customer, variant) = await ShopAsync();
        var created = await session.PlaceAsync(PaymentApi.Body(customer, variant, 2, status: "new", payment: new { amount = "15", method = "cash" }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var order = await created.JsonAsync(); // total 21, deposit 15
        Assert.Equal(("15.000", "6.000", "partial"), (order.GetProperty("paid").GetString(), order.GetProperty("remaining").GetString(), order.Status()));
        await (await session.PlaceAsync(PaymentApi.Body(customer, variant, 1, payment: new { amount = "12", method = "cash" }))).AssertProblemAsync(HttpStatusCode.Conflict, "payment.exceeds_remaining");
        await (await session.PlaceAsync(PaymentApi.Body(customer, variant, 1, payment: new { amount = "5", method = "cod" }))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment.method_not_allowed");

        var url = $"/api/v1/orders/{order.GetProperty("id").GetGuid()}";
        var edit = new { channel = "instagram", items = new[] { new { variantId = variant, quantity = 1 } }, deliveryFee = "0", discount = "0", paymentMethod = "cash", isGift = false };
        await (await session.PutAsync(url, edit)).AssertProblemAsync(HttpStatusCode.Conflict, "order.total_below_paid"); // 10 < 15

        await (await session.MoveAsync(order, "cancelled", reason: "changed_mind")).AssertProblemAsync(HttpStatusCode.Conflict, "order.has_payments");
        var deposit = order.GetProperty("payments")[0].GetProperty("paymentId").GetGuid();
        await session.ReverseAsync(deposit).OkJsonAsync();
        var cancelled = await session.MovedAsync(order, "cancelled", reason: "changed_mind");
        Assert.Equal(JsonValueKind.Null, cancelled.GetProperty("paymentStatus").ValueKind);
        await (await session.PayOrderAsync(order, "5", factory.Today())).AssertProblemAsync(HttpStatusCode.Conflict, "order.not_payable");
    }

    [Fact]
    public async Task Another_business_cannot_see_pay_or_reverse()
    {
        var (owner, customer, variant) = await ShopAsync();
        var order = await owner.MovedAsync(await owner.OrderAsync(customer, variant, 1), "delivered");
        var payment = await owner.PayOrderAsync(order, "5", factory.Today()).OkJsonAsync();
        var paymentId = payment.GetProperty("payment").GetProperty("id").GetGuid();

        var other = await factory.OnboardedAsync();
        await (await other.PayOrderAsync(order, "1", factory.Today())).AssertProblemAsync(HttpStatusCode.NotFound, "order.not_found");
        await (await other.PayCustomerAsync(customer, "1", factory.Today())).AssertProblemAsync(HttpStatusCode.NotFound, "customer.not_found");
        await (await other.ReverseAsync(paymentId)).AssertProblemAsync(HttpStatusCode.NotFound, "payment.not_found");
        await (await other.GetAsync($"/api/v1/payments/{paymentId}")).AssertProblemAsync(HttpStatusCode.NotFound, "payment.not_found");
        Assert.Equal(0, (await (await other.GetAsync("/api/v1/payments")).JsonAsync()).GetProperty("totalCount").GetInt32());
        Assert.Equal(0, (await (await other.GetAsync("/api/v1/finance/receivables")).JsonAsync()).GetProperty("totalCount").GetInt32());
        Assert.Equal("6.000", await owner.BalanceAsync(customer));
    }
}
