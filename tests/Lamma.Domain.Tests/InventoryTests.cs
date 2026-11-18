using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Domain.Tests;

public sealed class InventoryRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 18, 9, 0, 0, DateTimeKind.Utc);

    private static Product Cream(decimal cost = 5m) => Product.Create(Guid.NewGuid(), "كريم", null, "beauty", 12m, cost, 5, "{}", [], []);

    [Theory]
    [InlineData(0, 5, 10, 8, 8)] // no stock: the new cost
    [InlineData(10, 5, 10, 8, 6.5)] // (10×5 + 10×8) / 20
    [InlineData(3, 5, 1, 6, 5.25)] // (15 + 6) / 4
    [InlineData(2, 1, 1, 0, 0.667)] // rounded to 3 dp
    public void Weighted_average_cost_on_receive(int onHand, decimal current, int qty, decimal unitCost, decimal expected)
        => Assert.Equal(expected, StockRules.WeightedCost(onHand, current, qty, unitCost));

    [Fact]
    public void Receive_updates_stock_cost_and_writes_a_receipt_movement()
    {
        var product = Cream();
        var variant = product.Variants.Single();
        product.RecordOpeningStock(variant, 10, Guid.NewGuid(), Now);
        var receipt = Guid.NewGuid();

        var movement = product.ReceiveStock(variant, 10, 8m, null, receipt, "مشغل عمّان", Guid.NewGuid(), Now);

        Assert.Equal(20, variant.OnHand);
        Assert.Equal(6.5m, product.EffectiveCost(variant));
        Assert.Equal((StockMovementType.Receive, StockReferenceKind.Receipt, 10, 8m), (movement.Type, movement.ReferenceKind!.Value, movement.OnHandDelta, movement.UnitCost!.Value));
        Assert.Equal(receipt, movement.ReferenceId);
        Assert.False(movement.IsAutomatic);
    }

    [Fact]
    public void Expiry_follows_the_oldest_stock_and_resets_when_empty()
    {
        var jan = new DateOnly(2027, 1, 1);
        var mar = new DateOnly(2027, 3, 1);
        Assert.Equal(mar, StockRules.ExpiryAfterReceive(0, jan, mar));
        Assert.Equal(jan, StockRules.ExpiryAfterReceive(5, jan, mar));
        Assert.Equal(jan, StockRules.ExpiryAfterReceive(5, mar, jan));
        Assert.Equal(mar, StockRules.ExpiryAfterReceive(5, null, mar));
    }

    [Fact]
    public void Adjust_down_writes_a_manual_movement_and_cannot_go_below_stock()
    {
        var product = Cream();
        var variant = product.Variants.Single();
        product.RecordOpeningStock(variant, 4, Guid.NewGuid(), Now);

        var movement = product.AdjustStock(variant, -1, AdjustmentReason.Damage, "  انكسر ", Guid.NewGuid(), Now);

        Assert.Equal(3, variant.OnHand);
        Assert.Equal((StockMovementType.Adjustment, AdjustmentReason.Damage, "انكسر", "تعديل: تلف"), (movement.Type, movement.AdjustmentReason!.Value, movement.Reason!, movement.ReferenceLabel!));
        Assert.Equal("stock.below_reserved", Assert.Throws<DomainConflictException>(() => product.AdjustStock(variant, -4, AdjustmentReason.Loss, null, Guid.NewGuid(), Now)).Code);
        Assert.Equal(3, variant.OnHand);
    }

    [Theory]
    [InlineData(AdjustmentReason.Damage, false)]
    [InlineData(AdjustmentReason.Loss, false)]
    [InlineData(AdjustmentReason.Gift, false)]
    [InlineData(AdjustmentReason.Count, true)]
    [InlineData(AdjustmentReason.Correction, true)]
    public void Increase_is_allowed_only_for_count_and_correction(AdjustmentReason reason, bool allowed)
    {
        Assert.Equal(allowed, StockRules.IsReasonAllowed(reason, increase: true));
        Assert.True(StockRules.IsReasonAllowed(reason, increase: false));
    }

    [Fact]
    public void Archived_variants_cannot_take_stock_changes()
    {
        var product = Cream();
        product.Archive();
        var ex = Assert.Throws<DomainConflictException>(() => product.ReceiveStock(product.Variants.Single(), 1, 1m, null, Guid.NewGuid(), "x", Guid.NewGuid(), Now));
        Assert.Equal("stock.archived", ex.Code);
    }

    [Theory]
    [InlineData(-1, "expired")]
    [InlineData(0, "soon")]
    [InlineData(60, "soon")]
    [InlineData(61, "ok")]
    public void Expiry_status_uses_the_60_day_window(int days, string status)
        => Assert.Equal(status, StockRules.ExpiryStatus(days));
}
