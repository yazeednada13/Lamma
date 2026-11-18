using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class InventoryApiTests(LammaApiFactory factory)
{
    private static Guid VariantAt(JsonElement product, int index) => product.GetProperty("variants")[index].GetProperty("id").GetGuid();

    private static object Receive(params (Guid VariantId, int Qty, string Cost)[] lines)
        => new { supplier = "مشغل عمّان", lines = lines.Select(l => new { variantId = l.VariantId, quantity = l.Qty, unitCost = l.Cost }).ToArray() };

    /// <summary>3.A7: every variant's OnHand equals the sum of its movements (whole database, all businesses).</summary>
    private async Task AssertMovementsReconcileAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LammaDbContext>();
        var mismatches = await db.ProductVariants.IgnoreQueryFilters()
            .Select(v => new { v.OnHand, Sum = db.StockMovements.IgnoreQueryFilters().Where(m => m.VariantId == v.Id).Sum(m => (int?)m.OnHandDelta) ?? 0 })
            .Where(x => x.OnHand != x.Sum)
            .CountAsync();
        Assert.Equal(0, mismatches);
    }

    [Fact]
    public async Task Multi_line_receive_updates_stock_and_weighted_cost_in_one_receipt()
    {
        var session = await factory.OnboardedAsync();
        var dress = await session.CreateAsync(CatalogApi.Dress()); // S·زيتي 3 @17, M·زيتي 0, M·كريمي 2
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", cost: "5", opening: 10));

        var response = await session.PostIdempotentAsync("/api/v1/inventory/receipts", Receive((VariantAt(dress, 0), 3, "20"), (VariantAt(cream, 0), 10, "8")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var receipt = await response.JsonAsync();
        Assert.Equal((13, "140.000", "مشغل عمّان"), (receipt.GetProperty("pieces").GetInt32(), receipt.GetProperty("totalCost").GetString(), receipt.GetProperty("supplier").GetString()));
        var creamLine = receipt.GetProperty("lines")[1];
        Assert.Equal((20, "6.500"), (creamLine.GetProperty("newOnHand").GetInt32(), creamLine.GetProperty("newCost").GetString()));
        var dressLine = receipt.GetProperty("lines")[0];
        Assert.Equal((6, "18.500"), (dressLine.GetProperty("newOnHand").GetInt32(), dressLine.GetProperty("newCost").GetString()));

        var movements = await (await session.GetAsync($"/api/v1/inventory/movements?productId={cream.GetProperty("id").GetGuid()}&direction=in&origin=manual")).JsonAsync();
        var row = Assert.Single(movements.GetProperty("items").EnumerateArray());
        Assert.Equal(("receive", "receipt", "مشغل عمّان", 10), (row.GetProperty("type").GetString(), row.GetProperty("referenceKind").GetString(), row.GetProperty("label").GetString(), row.GetProperty("onHandDelta").GetInt32()));
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task A_retry_with_the_same_key_is_not_applied_twice_and_a_changed_body_is_rejected()
    {
        var session = await factory.OnboardedAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 1));
        var key = Guid.NewGuid();
        var body = Receive((VariantAt(cream, 0), 4, "5"));

        var first = await (await session.PostIdempotentAsync("/api/v1/inventory/receipts", body, key)).JsonAsync();
        var retry = await session.PostIdempotentAsync("/api/v1/inventory/receipts", body, key);

        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
        Assert.Equal(first.GetProperty("id").GetGuid(), (await retry.JsonAsync()).GetProperty("id").GetGuid());
        var details = await (await session.GetAsync($"/api/v1/products/{cream.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(5, details.GetProperty("onHand").GetInt32());

        await (await session.PostIdempotentAsync("/api/v1/inventory/receipts", Receive((VariantAt(cream, 0), 9, "5")), key))
            .AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "idempotency.key_reused");
        await (await session.PostIdempotentAsync("/api/v1/inventory/receipts", body, null))
            .AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "idempotency.key_required");
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Concurrent_duplicates_with_one_key_apply_once()
    {
        var session = await factory.OnboardedAsync();
        await session.RefreshTokenAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم"));
        var key = Guid.NewGuid();
        var body = Receive((VariantAt(cream, 0), 2, "5"));

        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => session.PostIdempotentAsync("/api/v1/inventory/receipts", body, key)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var details = await (await session.GetAsync($"/api/v1/products/{cream.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(2, details.GetProperty("onHand").GetInt32());
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Adjustments_follow_the_reason_rules_and_never_go_below_stock()
    {
        var session = await factory.OnboardedAsync();
        var cream = await session.CreateAsync(CatalogApi.Simple("كريم", opening: 3));
        var variantId = VariantAt(cream, 0);

        var down = await (await session.PostIdempotentAsync("/api/v1/inventory/adjustments", new { variantId, delta = -1, reason = "damage", note = "انكسر" }, Guid.NewGuid())).JsonAsync();
        Assert.Equal((2, 2), (down.GetProperty("onHand").GetInt32(), down.GetProperty("available").GetInt32()));

        await (await session.PostIdempotentAsync("/api/v1/inventory/adjustments", new { variantId, delta = -5, reason = "loss" }, Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.Conflict, "stock.below_reserved");
        await (await session.PostIdempotentAsync("/api/v1/inventory/adjustments", new { variantId, delta = 2, reason = "damage" }, Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "stock.invalid_reason");
        var up = await (await session.PostIdempotentAsync("/api/v1/inventory/adjustments", new { variantId, delta = 2, reason = "count" }, Guid.NewGuid())).JsonAsync();
        Assert.Equal(4, up.GetProperty("onHand").GetInt32());

        var log = await (await session.GetAsync($"/api/v1/inventory/movements?variantId={variantId}&origin=manual")).JsonAsync();
        Assert.Equal(["count", "damage"], log.GetProperty("items").EnumerateArray().Select(m => m.GetProperty("adjustmentReason").GetString()).Order());
        await AssertMovementsReconcileAsync();
    }

    [Fact]
    public async Task Another_business_variant_is_not_found_and_nothing_changes()
    {
        var owner = await factory.OnboardedAsync();
        var cream = await owner.CreateAsync(CatalogApi.Simple("كريم", opening: 3));
        var stranger = await factory.OnboardedAsync();

        await (await stranger.PostIdempotentAsync("/api/v1/inventory/adjustments", new { variantId = VariantAt(cream, 0), delta = -1, reason = "loss" }, Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.NotFound, "inventory.variant_not_found");
        await (await stranger.PostIdempotentAsync("/api/v1/inventory/receipts", Receive((VariantAt(cream, 0), 1, "1")), Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.NotFound, "inventory.variant_not_found");
        Assert.Equal(0, (await (await stranger.GetAsync("/api/v1/inventory/movements")).JsonAsync()).GetProperty("totalCount").GetInt32());
        var details = await (await owner.GetAsync($"/api/v1/products/{cream.GetProperty("id").GetGuid()}")).JsonAsync();
        Assert.Equal(3, details.GetProperty("onHand").GetInt32());
    }

    [Fact]
    public async Task Summary_and_levels_are_computed_on_the_server()
    {
        var session = await factory.OnboardedAsync();
        await session.CreateAsync(CatalogApi.Simple("كريم", price: "12", cost: "5", opening: 10)); // in
        await session.CreateAsync(CatalogApi.Simple("صابون", price: "4", cost: "1", opening: 2)); // low (threshold 5)
        await session.CreateAsync(CatalogApi.Simple("شامبو")); // out

        var summary = await (await session.GetAsync("/api/v1/inventory/summary")).JsonAsync();
        Assert.Equal(("52.000", "128.000", "76.000"), (summary.GetProperty("stockValueAtCost").GetString(), summary.GetProperty("retailValue").GetString(), summary.GetProperty("expectedProfit").GetString()));
        Assert.Equal((12, 1, 1, "صابون", "شامبو"), (summary.GetProperty("pieces").GetInt32(), summary.GetProperty("lowCount").GetInt32(), summary.GetProperty("outCount").GetInt32(),
            summary.GetProperty("lowNames")[0].GetString(), summary.GetProperty("outNames")[0].GetString()));

        var levels = await (await session.GetAsync("/api/v1/inventory/levels")).JsonAsync();
        Assert.Equal(["شامبو", "صابون", "كريم"], levels.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString())); // most urgent first
        var low = await (await session.GetAsync("/api/v1/inventory/levels?status=low")).JsonAsync();
        Assert.Equal("صابون", Assert.Single(low.GetProperty("items").EnumerateArray()).GetProperty("name").GetString());
    }

    [Fact]
    public async Task Expiry_lists_variants_with_stock_nearest_first_with_the_60_day_status()
    {
        var session = await factory.OnboardedAsync();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(factory.Clock.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Amman")));
        var soon = await session.CreateAsync(new { name = "كريم", templateCode = "beauty", sellingPrice = "9", cost = "3", expiryDate = today.AddDays(30).ToString("yyyy-MM-dd"), variants = new[] { new { values = Array.Empty<string>(), openingQuantity = 2 } } });
        await session.CreateAsync(new { name = "سيروم", templateCode = "beauty", sellingPrice = "9", cost = "3", expiryDate = today.AddDays(200).ToString("yyyy-MM-dd"), variants = new[] { new { values = Array.Empty<string>(), openingQuantity = 1 } } });
        await session.CreateAsync(new { name = "فاضي", templateCode = "beauty", sellingPrice = "9", cost = "3", expiryDate = today.AddDays(5).ToString("yyyy-MM-dd") }); // no stock

        // A later batch keeps the earlier date (D-108).
        await session.PostIdempotentAsync("/api/v1/inventory/receipts", new { lines = new[] { new { variantId = VariantAt(soon, 0), quantity = 3, unitCost = "3", expiryDate = today.AddDays(90).ToString("yyyy-MM-dd") } } }, Guid.NewGuid());

        var items = (await (await session.GetAsync("/api/v1/inventory/expiring")).JsonAsync()).EnumerateArray().ToList();
        Assert.Equal(["كريم", "سيروم"], items.Select(i => i.GetProperty("productName").GetString()));
        Assert.Equal((30, "soon", 5), (items[0].GetProperty("daysLeft").GetInt32(), items[0].GetProperty("status").GetString(), items[0].GetProperty("onHand").GetInt32()));
        Assert.Equal("ok", items[1].GetProperty("status").GetString());
    }
}
