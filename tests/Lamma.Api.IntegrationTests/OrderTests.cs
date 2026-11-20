using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lamma.Api.IntegrationTests;

internal static class OrderApi
{
    public static Guid VariantAt(JsonElement product, int index) => product.GetProperty("variants")[index].GetProperty("id").GetGuid();

    public static async Task<Guid> CustomerAsync(this ApiSession session, string name = "رنا الخطيب")
    {
        var response = await session.PostAsync("/api/v1/customers", new { name, channel = "instagram", city = "amman", area = "خلدا" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.JsonAsync()).GetProperty("id").GetGuid();
    }

    public static object Body(Guid customerId, string status, params (Guid VariantId, int Qty)[] items)
        => new
        {
            customerId,
            channel = "instagram",
            items = items.Select(i => new { variantId = i.VariantId, quantity = i.Qty }).ToArray(),
            deliveryFee = "2",
            discount = "1",
            paymentMethod = "cod",
            deliveryAddress = "عمّان · خلدا",
            isGift = false,
            status,
        };

    public static Task<HttpResponseMessage> PlaceAsync(this ApiSession session, object body, Guid? key = null)
        => session.PostIdempotentAsync("/api/v1/orders", body, key ?? Guid.NewGuid());

    public static async Task<JsonElement> OrderAsync(this ApiSession session, Guid customerId, string status, params (Guid VariantId, int Qty)[] items)
    {
        var response = await session.PlaceAsync(Body(customerId, status, items));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.JsonAsync();
    }

    public static Task<HttpResponseMessage> MoveAsync(this ApiSession session, JsonElement order, string to, string? expected = null, string? reason = null, string? note = null)
        => session.PostIdempotentAsync(
            $"/api/v1/orders/{order.GetProperty("id").GetGuid()}/status",
            new { to, expectedStatus = expected ?? order.GetProperty("status").GetString(), cancelReason = reason, cancelNote = note },
            Guid.NewGuid());

    public static async Task<JsonElement> MovedAsync(this ApiSession session, JsonElement order, string to, string? reason = null)
    {
        var response = await session.MoveAsync(order, to, reason: reason);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.JsonAsync();
    }

    public static async Task<(int OnHand, int Reserved, int Sold)> StockAsync(this ApiSession session, JsonElement product)
    {
        var details = await (await session.GetAsync($"/api/v1/products/{product.GetProperty("id").GetGuid()}")).JsonAsync();
        return (details.GetProperty("onHand").GetInt32(), details.GetProperty("reserved").GetInt32(), details.GetProperty("sold").GetInt32());
    }
}

[Collection(ApiCollection.Name)]
public sealed class OrderApiTests(LammaApiFactory factory)
{
    /// <summary>Every variant's OnHand and Reserved equal the sums of its movements (whole database).</summary>
    private async Task AssertMovementsReconcileAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LammaDbContext>();
        var mismatches = await db.ProductVariants.IgnoreQueryFilters()
            .Select(v => new
            {
                v.OnHand,
                v.Reserved,
                OnHandSum = db.StockMovements.IgnoreQueryFilters().Where(m => m.VariantId == v.Id).Sum(m => (int?)m.OnHandDelta) ?? 0,
                ReservedSum = db.StockMovements.IgnoreQueryFilters().Where(m => m.VariantId == v.Id).Sum(m => (int?)m.ReservedDelta) ?? 0,
            })
            .Where(x => x.OnHand != x.OnHandSum || x.Reserved != x.ReservedSum)
            .CountAsync();
        Assert.Equal(0, mismatches);
    }

    [Fact]
    public async Task Confirmed_order_reserves_keeps_its_snapshots_and_a_retry_is_applied_once()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", price: "12", cost: "5", opening: 5));
        var variant = OrderApi.VariantAt(cream, 0);
        var key = Guid.NewGuid();
        var body = OrderApi.Body(customer, "confirmed", (variant, 3));

        var first = await session.PlaceAsync(body, key);
        var retry = await session.PlaceAsync(body, key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var order = await first.JsonAsync();
        Assert.Equal(order.GetProperty("id").GetGuid(), (await retry.JsonAsync()).GetProperty("id").GetGuid());
        Assert.Equal((1001, "confirmed"), (order.GetProperty("number").GetInt32(), order.GetProperty("status").GetString()));
        Assert.Equal(("36.000", "2.000", "1.000", "37.000"), (order.GetProperty("itemsSubtotal").GetString(), order.GetProperty("deliveryFee").GetString(), order.GetProperty("discount").GetString(), order.GetProperty("total").GetString()));
        Assert.Equal(("15.000", "20.000"), (order.GetProperty("itemsCost").GetString(), order.GetProperty("profit").GetString()));
        Assert.Equal((5, 3, 0), await session.StockAsync(cream));

        // A later price change does not touch the order (D-032).
        Assert.Equal(HttpStatusCode.OK, (await session.PutAsync($"/api/v1/products/{cream.GetProperty("id").GetGuid()}/variants/{variant}", new { priceOverride = "20", costOverride = "9" })).StatusCode);
        var reloaded = await (await session.GetAsync($"/api/v1/orders/{order.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(("12.000", "5.000", "37.000"), (reloaded.GetProperty("items")[0].GetProperty("unitPrice").GetString(), reloaded.GetProperty("items")[0].GetProperty("unitCost").GetString(), reloaded.GetProperty("total").GetString()));

        // Only 2 are available now: a confirmed order for 3 is refused, a new one is accepted and reserves nothing.
        await (await session.PlaceAsync(OrderApi.Body(customer, "confirmed", (variant, 3)))).AssertProblemAsync(HttpStatusCode.Conflict, "stock.not_available");
        var second = await session.OrderAsync(customer, "new", (variant, 3));
        Assert.Equal(1002, second.GetProperty("number").GetInt32());
        Assert.Equal((5, 3, 0), await session.StockAsync(cream));
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Full_path_to_delivered_sells_the_stock_and_feeds_customer_and_product_figures()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var dress = await session.CreateAsync(CatalogApi.Dress()); // S·زيتي 3, M·زيتي 0, M·كريمي 2 @42.5
        var order = await session.OrderAsync(customer, "new", (OrderApi.VariantAt(dress, 0), 2), (OrderApi.VariantAt(dress, 2), 1));
        Assert.Equal(new[] { "confirmed", "preparing", "courier", "delivered", "cancelled" }, order.GetProperty("allowedStatuses").EnumerateArray().Select(s => s.GetString()));

        order = await session.MovedAsync(order, "confirmed");
        Assert.Equal((5, 3, 0), await session.StockAsync(dress));
        order = await session.MovedAsync(order, "preparing");
        order = await session.MovedAsync(order, "courier");
        order = await session.MovedAsync(order, "delivered");

        Assert.Equal((2, 0, 3), await session.StockAsync(dress));
        Assert.Equal("delivered", order.GetProperty("status").GetString());
        Assert.Empty(order.GetProperty("allowedStatuses").EnumerateArray());
        Assert.Equal(5, order.GetProperty("timeline").GetArrayLength());
        var customerDetails = await (await session.GetAsync($"/api/v1/customers/{customer}")).JsonAsync();
        Assert.Equal((1, "119.500"), (customerDetails.GetProperty("orderCount").GetInt32(), customerDetails.GetProperty("totalSpent").GetString())); // 76 + 42.5 + 2 − 1

        var counts = await (await session.GetAsync("/api/v1/orders/status-counts")).JsonAsync();
        Assert.Equal((1, 1), (counts.GetProperty("all").GetInt32(), counts.GetProperty("delivered").GetInt32()));
        var byNumber = await (await session.GetAsync("/api/v1/orders?search=%231001")).JsonAsync();
        var row = Assert.Single(byNumber.GetProperty("items").EnumerateArray());
        Assert.Equal((3, "رنا الخطيب"), (row.GetProperty("pieces").GetInt32(), row.GetProperty("customerName").GetString()));
        var byProduct = await (await session.GetAsync($"/api/v1/orders?productId={dress.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(1, byProduct.GetProperty("totalCount").GetInt32());
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Skip_to_delivered_cancel_from_courier_and_a_stale_status_is_rejected()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 6));
        var variant = OrderApi.VariantAt(cream, 0);

        var direct = await session.OrderAsync(customer, "new", (variant, 2));
        await session.MovedAsync(direct, "delivered"); // D-121 skip: sale straight from on hand
        Assert.Equal((4, 0, 2), await session.StockAsync(cream));

        var failed = await session.OrderAsync(customer, "confirmed", (variant, 3));
        failed = await session.MovedAsync(failed, "courier");
        Assert.Equal((4, 3, 2), await session.StockAsync(cream));
        await (await session.MoveAsync(failed, "cancelled", reason: "other")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        var cancelled = await session.MovedAsync(failed, "cancelled", reason: "no_answer");
        Assert.Equal(("cancelled", "no_answer"), (cancelled.GetProperty("status").GetString(), cancelled.GetProperty("cancelReason").GetString()));
        Assert.Equal((4, 0, 2), await session.StockAsync(cream));

        var stale = await (await session.MoveAsync(failed, "delivered", expected: "courier")).AssertProblemAsync(HttpStatusCode.Conflict, "order.status_changed");
        Assert.Equal("cancelled", stale.GetProperty("currentStatus").GetString());
        await (await session.MoveAsync(cancelled, "confirmed")).AssertProblemAsync(HttpStatusCode.Conflict, "order.invalid_transition");
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Two_orders_racing_for_the_last_piece_one_wins_and_one_gets_a_conflict()
    {
        var session = await factory.OnboardedAsync();
        await session.RefreshTokenAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 1));
        var variant = OrderApi.VariantAt(cream, 0);
        var a = await session.OrderAsync(customer, "new", (variant, 1));
        var b = await session.OrderAsync(customer, "new", (variant, 1));

        var responses = await Task.WhenAll(session.MoveAsync(a, "confirmed"), session.MoveAsync(b, "confirmed"));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        await responses.Single(r => r.StatusCode != HttpStatusCode.OK).AssertProblemAsync(HttpStatusCode.Conflict, "stock.not_available");
        Assert.Equal((1, 1, 0), await session.StockAsync(cream));
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Concurrent_creates_get_unique_sequential_numbers()
    {
        var session = await factory.OnboardedAsync();
        await session.RefreshTokenAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 50));
        var body = OrderApi.Body(customer, "confirmed", (OrderApi.VariantAt(cream, 0), 1));

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => session.PlaceAsync(body)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var numbers = new List<int>();
        foreach (var response in responses)
        {
            numbers.Add((await response.JsonAsync()).GetProperty("number").GetInt32());
        }

        Assert.Equal(Enumerable.Range(1001, 6), numbers.Order());
        Assert.Equal((50, 6, 0), await session.StockAsync(cream));
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Undo_reverts_the_latest_change_within_five_minutes_only()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 4));
        var order = await session.OrderAsync(customer, "confirmed", (OrderApi.VariantAt(cream, 0), 2));
        var id = order.GetProperty("id").GetGuid();

        order = await session.MovedAsync(order, "delivered");
        var undo = order.GetProperty("undo");
        Assert.Equal(("delivered", "confirmed"), (undo.GetProperty("from").GetString(), undo.GetProperty("to").GetString()));
        var reverted = await session.PostIdempotentAsync($"/api/v1/orders/{id}/status/undo", new { changeId = undo.GetProperty("changeId").GetGuid() }, Guid.NewGuid());
        Assert.Equal(HttpStatusCode.OK, reverted.StatusCode);
        var back = await reverted.JsonAsync();
        Assert.Equal("confirmed", back.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, back.GetProperty("undo").ValueKind);
        Assert.Equal((4, 2, 0), await session.StockAsync(cream));

        var older = order.GetProperty("timeline")[1].GetProperty("id").GetGuid(); // the creation-time confirm
        await (await session.PostIdempotentAsync($"/api/v1/orders/{id}/status/undo", new { changeId = older }, Guid.NewGuid())).AssertProblemAsync(HttpStatusCode.Conflict, "order.undo_not_latest");

        var original = factory.Clock.UtcNow;
        try
        {
            order = await session.MovedAsync(back, "preparing");
            factory.Clock.UtcNow = original.AddMinutes(6);
            await (await session.PostIdempotentAsync($"/api/v1/orders/{id}/status/undo", new { changeId = order.GetProperty("timeline")[4].GetProperty("id").GetGuid() }, Guid.NewGuid()))
                .AssertProblemAsync(HttpStatusCode.Conflict, "order.undo_expired");
        }
        finally
        {
            factory.Clock.UtcNow = original;
        }

        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Items_are_editable_only_while_new()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 5));
        var variant = OrderApi.VariantAt(cream, 0);
        var order = await session.OrderAsync(customer, "new", (variant, 1));
        var url = $"/api/v1/orders/{order.GetProperty("id").GetGuid()}";
        object Edit(int qty) => new { channel = "whatsapp", items = new[] { new { variantId = variant, quantity = qty, unitPrice = "10" } }, deliveryFee = "0", discount = "5", paymentMethod = "cash", isGift = true, recipientName = "سارة", recipientPhone = "0791234567" };

        var edited = await (await session.PutAsync(url, Edit(2))).JsonAsync();
        Assert.Equal(("15.000", "whatsapp", "+962791234567"), (edited.GetProperty("total").GetString(), edited.GetProperty("channel").GetString(), edited.GetProperty("recipientPhone").GetString()));

        var confirmed = await session.MovedAsync(edited, "confirmed");
        Assert.False(confirmed.GetProperty("canEditItems").GetBoolean());
        await (await session.PutAsync(url, Edit(1))).AssertProblemAsync(HttpStatusCode.Conflict, "order.locked");
        var details = await session.PutAsync($"{url}/details", new { deliveryAddress = "إربد", isGift = false, note = "اتصل قبل" });
        Assert.Equal(HttpStatusCode.OK, details.StatusCode);
        var updated = await details.JsonAsync();
        Assert.Equal(("إربد", 2, false), (updated.GetProperty("deliveryAddress").GetString(), updated.GetProperty("pieces").GetInt32(), updated.GetProperty("isGift").GetBoolean()));
        Assert.Equal((5, 2, 0), await session.StockAsync(cream));
    }

    [Fact]
    public async Task Another_business_cannot_see_or_use_orders_customers_or_variants()
    {
        var owner = await factory.OnboardedAsync();
        var customer = await owner.CustomerAsync();
        var cream = await owner.CreateAsync(CatalogApi.Simple("كريم", opening: 3));
        var order = await owner.OrderAsync(customer, "new", (OrderApi.VariantAt(cream, 0), 1));

        var other = await factory.OnboardedAsync();
        var theirCustomer = await other.CustomerAsync("عميل ثاني");
        var theirCream = await other.CreateAsync(CatalogApi.Simple("كريم", opening: 3));

        await (await other.GetAsync($"/api/v1/orders/{order.GetProperty("id").GetGuid()}")).AssertProblemAsync(HttpStatusCode.NotFound, "order.not_found");
        await (await other.MoveAsync(order, "confirmed")).AssertProblemAsync(HttpStatusCode.NotFound, "order.not_found");
        await (await other.PlaceAsync(OrderApi.Body(customer, "new", (OrderApi.VariantAt(theirCream, 0), 1)))).AssertProblemAsync(HttpStatusCode.NotFound, "order.customer_not_found");
        await (await other.PlaceAsync(OrderApi.Body(theirCustomer, "new", (OrderApi.VariantAt(cream, 0), 1)))).AssertProblemAsync(HttpStatusCode.NotFound, "order.variant_not_found");
        Assert.Equal(0, (await (await other.GetAsync("/api/v1/orders")).JsonAsync()).GetProperty("totalCount").GetInt32());

        var theirs = await other.OrderAsync(theirCustomer, "new", (OrderApi.VariantAt(theirCream, 0), 1));
        Assert.Equal(1001, theirs.GetProperty("number").GetInt32()); // numbering is per business
    }
}
