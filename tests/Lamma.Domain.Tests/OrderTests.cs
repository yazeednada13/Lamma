using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;

namespace Lamma.Domain.Tests;

public sealed class OrderRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 20, 9, 0, 0, DateTimeKind.Utc);
    private static readonly OrderDelivery NoDelivery = new(null, false, null, null, null);

    private static (Product Product, ProductVariant Variant) Cream(int stock, decimal price = 12m, decimal cost = 5m)
    {
        var product = Product.Create(Guid.NewGuid(), "كريم", null, "beauty", price, cost, 5, "{}", [], []);
        var variant = product.Variants.Single();
        if (stock > 0)
        {
            product.RecordOpeningStock(variant, stock, Guid.NewGuid(), Now);
        }

        return (product, variant);
    }

    private static (Order Order, Dictionary<Guid, ProductVariant> Variants, ProductVariant Variant) NewOrder(int stock, int qty, decimal fee = 2m, decimal discount = 0m)
    {
        var (product, variant) = Cream(stock);
        var order = Order.Create(product.BusinessId, 1001, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, qty, null)], fee, discount, PaymentMethod.Cod, NoDelivery, null, Now);
        return (order, new Dictionary<Guid, ProductVariant> { [variant.Id] = variant }, variant);
    }

    private static IReadOnlyList<StockMovement> Move(Order order, Dictionary<Guid, ProductVariant> variants, OrderStatus to, DateTime? at = null, CancelReason? reason = null, string? note = null)
        => order.ChangeStatus(to, reason ?? (to == OrderStatus.Cancelled ? CancelReason.ChangedMind : null), note, variants, Guid.NewGuid(), at ?? Now);

    public static TheoryData<OrderStatus, OrderStatus, bool> Transitions()
    {
        var allowed = new HashSet<(OrderStatus, OrderStatus)>
        {
            (OrderStatus.New, OrderStatus.Confirmed), (OrderStatus.New, OrderStatus.Preparing), (OrderStatus.New, OrderStatus.Courier),
            (OrderStatus.New, OrderStatus.Delivered), (OrderStatus.New, OrderStatus.Cancelled),
            (OrderStatus.Confirmed, OrderStatus.Preparing), (OrderStatus.Confirmed, OrderStatus.Courier), (OrderStatus.Confirmed, OrderStatus.Delivered), (OrderStatus.Confirmed, OrderStatus.Cancelled),
            (OrderStatus.Preparing, OrderStatus.Courier), (OrderStatus.Preparing, OrderStatus.Delivered), (OrderStatus.Preparing, OrderStatus.Cancelled),
            (OrderStatus.Courier, OrderStatus.Delivered), (OrderStatus.Courier, OrderStatus.Cancelled),
        };
        var data = new TheoryData<OrderStatus, OrderStatus, bool>();
        foreach (var from in Enum.GetValues<OrderStatus>())
        {
            foreach (var to in Enum.GetValues<OrderStatus>())
            {
                data.Add(from, to, allowed.Contains((from, to)));
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Transitions))]
    public void Only_forward_moves_are_allowed_and_closed_orders_are_final(OrderStatus from, OrderStatus to, bool expected)
        => Assert.Equal(expected, OrderStatusPolicy.CanChange(from, to)); // D-121; delivered → returned opens in Phase 8

    [Theory]
    [InlineData(OrderStatus.New, OrderStatus.Confirmed, StockMovementType.Reserve, 0, 1)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Preparing, null, 0, 0)]
    [InlineData(OrderStatus.Courier, OrderStatus.Cancelled, StockMovementType.Release, 0, -1)]
    [InlineData(OrderStatus.Courier, OrderStatus.Delivered, StockMovementType.Sale, -1, -1)]
    [InlineData(OrderStatus.New, OrderStatus.Delivered, StockMovementType.Sale, -1, 0)]
    [InlineData(OrderStatus.New, OrderStatus.Cancelled, null, 0, 0)]
    [InlineData(OrderStatus.Delivered, OrderStatus.Courier, StockMovementType.Sale, 1, 1)] // undo of a delivery
    [InlineData(OrderStatus.Cancelled, OrderStatus.Confirmed, StockMovementType.Reserve, 0, 1)] // undo of a cancel
    public void Effect_table_follows_database_design_section_6(OrderStatus from, OrderStatus to, StockMovementType? type, int onHand, int reserved)
        => Assert.Equal(new StockEffect(type, onHand, reserved), InventoryEffectCalculator.For(from, to));

    [Fact]
    public void Totals_use_the_snapshots_and_profit_excludes_the_delivery_fee()
    {
        var (product, variant) = Cream(10, price: 12.5m, cost: 5m);
        var order = Order.Create(product.BusinessId, 1001, Guid.NewGuid(), SalesChannel.Whatsapp, [OrderLine.From(product, variant, 3, null)], 2.5m, 1.5m, null, NoDelivery, null, Now);

        Assert.Equal((37.5m, 2.5m, 1.5m, 38.5m), (order.ItemsSubtotal, order.DeliveryFee, order.Discount, order.Total)); // D-031
        Assert.Equal((15m, 21m), (order.ItemsCost, order.Profit)); // D-125: 37.5 − 1.5 − 15
        Assert.Equal((12.5m, 5m), (order.Items.Single().UnitPrice, order.Items.Single().UnitCost));
        Assert.Equal(OrderStatus.New, order.Status);
        Assert.Equal(0, variant.Reserved); // D-128: «جديد» reserves nothing
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(36.01)]
    [InlineData(0.0005)]
    public void Discount_must_be_between_zero_and_the_items_subtotal(decimal discount)
    {
        var ex = Assert.Throws<DomainException>(() => NewOrder(10, 3, discount: discount));
        Assert.Equal("order.invalid_discount", ex.Code);
    }

    [Fact]
    public void Full_path_reserves_then_sells_and_writes_one_movement_per_step()
    {
        var (order, variants, variant) = NewOrder(5, 2);

        var reserve = Move(order, variants, OrderStatus.Confirmed);
        Assert.Equal((5, 2), (variant.OnHand, variant.Reserved));
        Assert.Empty(Move(order, variants, OrderStatus.Preparing));
        Assert.Empty(Move(order, variants, OrderStatus.Courier));
        var sale = Move(order, variants, OrderStatus.Delivered);

        Assert.Equal((3, 0), (variant.OnHand, variant.Reserved));
        Assert.Equal((StockMovementType.Reserve, 0, 2), (reserve.Single().Type, reserve.Single().OnHandDelta, reserve.Single().ReservedDelta));
        Assert.Equal((StockMovementType.Sale, -2, -2), (sale.Single().Type, sale.Single().OnHandDelta, sale.Single().ReservedDelta));
        Assert.Equal((StockReferenceKind.Order, "#1001", true), (sale.Single().ReferenceKind!.Value, sale.Single().ReferenceLabel, sale.Single().IsAutomatic));
        Assert.Equal(Now, order.DeliveredAt);
        Assert.Equal(Now, order.ConfirmedAt);
        Assert.Equal(5, order.StatusLogs.Count);
    }

    [Fact]
    public void Skipping_to_delivered_sells_directly_but_needs_available_stock()
    {
        var (order, variants, variant) = NewOrder(3, 2);
        var sale = Move(order, variants, OrderStatus.Delivered);
        Assert.Equal((1, 0), (variant.OnHand, variant.Reserved));
        Assert.Equal((-2, 0), (sale.Single().OnHandDelta, sale.Single().ReservedDelta));

        var (short1, shortVariants, shortVariant) = NewOrder(1, 2);
        var ex = Assert.Throws<DomainConflictException>(() => Move(short1, shortVariants, OrderStatus.Confirmed));
        Assert.Equal("stock.not_available", ex.Code);
        Assert.Equal((OrderStatus.New, 0), (short1.Status, shortVariant.Reserved)); // nothing changed
    }

    [Fact]
    public void Cancelling_needs_a_reason_other_needs_a_note_and_releases_the_reservation()
    {
        var (order, variants, variant) = NewOrder(5, 2);
        Move(order, variants, OrderStatus.Courier);

        Assert.Equal("order.cancel_reason_required", Assert.Throws<DomainException>(() => order.ChangeStatus(OrderStatus.Cancelled, null, null, variants, Guid.NewGuid(), Now)).Code);
        Assert.Equal("order.cancel_note_required", Assert.Throws<DomainException>(() => Move(order, variants, OrderStatus.Cancelled, reason: CancelReason.Other)).Code);

        var release = Move(order, variants, OrderStatus.Cancelled, reason: CancelReason.NoAnswer);
        Assert.Equal((StockMovementType.Release, -2), (release.Single().Type, release.Single().ReservedDelta));
        Assert.Equal((5, 0), (variant.OnHand, variant.Reserved));
        Assert.Equal((CancelReason.NoAnswer, Now), (order.CancelReason!.Value, order.CancelledAt!.Value));
        Assert.Equal("order.invalid_transition", Assert.Throws<DomainConflictException>(() => Move(order, variants, OrderStatus.Confirmed)).Code);
    }

    [Fact]
    public void Undo_reverts_the_latest_change_within_five_minutes_with_compensating_movements()
    {
        var (order, variants, variant) = NewOrder(5, 2);
        Move(order, variants, OrderStatus.Confirmed);
        Move(order, variants, OrderStatus.Delivered, Now.AddMinutes(1));
        var change = order.UndoableChange(Now.AddMinutes(5))!;

        var reverse = order.Undo(change.Id, variants, Guid.NewGuid(), Now.AddMinutes(5));

        Assert.Equal(OrderStatus.Confirmed, order.Status);
        Assert.Null(order.DeliveredAt);
        Assert.Equal((5, 2), (variant.OnHand, variant.Reserved));
        Assert.Equal((StockMovementType.Sale, 2, 2, "تراجع #1001"), (reverse.Single().Type, reverse.Single().OnHandDelta, reverse.Single().ReservedDelta, reverse.Single().ReferenceLabel));
        var log = order.StatusLogs.MaxBy(l => l.Sequence)!;
        Assert.Equal((true, change.Id), (log.IsUndo, log.UndoOfLogId));
        Assert.Null(order.UndoableChange(Now.AddMinutes(5))); // an undo is not undone
        Assert.Equal("order.undo_not_available", Assert.Throws<DomainConflictException>(() => order.Undo(log.Id, variants, Guid.NewGuid(), Now.AddMinutes(5))).Code);
    }

    [Fact]
    public void Undo_is_refused_after_the_window_for_an_older_change_and_for_the_creation()
    {
        var (order, variants, _) = NewOrder(5, 1);
        Assert.Null(order.UndoableChange(Now)); // creation row
        Move(order, variants, OrderStatus.Confirmed);
        var first = order.StatusLogs.MaxBy(l => l.Sequence)!;
        Move(order, variants, OrderStatus.Preparing, Now.AddMinutes(1));

        Assert.Equal("order.undo_not_latest", Assert.Throws<DomainConflictException>(() => order.Undo(first.Id, variants, Guid.NewGuid(), Now.AddMinutes(2))).Code);
        var latest = order.StatusLogs.MaxBy(l => l.Sequence)!;
        Assert.Equal("order.undo_expired", Assert.Throws<DomainConflictException>(() => order.Undo(latest.Id, variants, Guid.NewGuid(), Now.AddMinutes(6).AddSeconds(1))).Code);
    }

    [Fact]
    public void Undoing_a_cancel_re_reserves_only_when_stock_is_available()
    {
        var (product, variant) = Cream(2);
        var variants = new Dictionary<Guid, ProductVariant> { [variant.Id] = variant };
        var order = Order.Create(product.BusinessId, 1001, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, 2, null)], 0, 0, null, NoDelivery, null, Now);
        var other = Order.Create(product.BusinessId, 1002, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, 2, null)], 0, 0, null, NoDelivery, null, Now);
        Move(order, variants, OrderStatus.Confirmed);
        Move(order, variants, OrderStatus.Cancelled);
        Move(other, variants, OrderStatus.Confirmed); // takes the released pieces
        var cancel = order.StatusLogs.MaxBy(l => l.Sequence)!;

        var ex = Assert.Throws<DomainConflictException>(() => order.Undo(cancel.Id, variants, Guid.NewGuid(), Now.AddMinutes(1)));

        Assert.Equal("stock.not_available", ex.Code);
        Assert.Equal((OrderStatus.Cancelled, 2), (order.Status, variant.Reserved));
    }

    [Fact]
    public void Items_are_editable_only_while_new_and_details_until_delivered()
    {
        var (product, variant) = Cream(10);
        var (order, variants, _) = (Order.Create(product.BusinessId, 1001, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, 1, null)], 0, 0, null, NoDelivery, null, Now), new Dictionary<Guid, ProductVariant> { [variant.Id] = variant }, variant);

        order.ReplaceItems(SalesChannel.Facebook, [OrderLine.From(product, variant, 4, 10m)], 3m, 0, null);
        Assert.Equal((40m, 43m, SalesChannel.Facebook), (order.ItemsSubtotal, order.Total, order.Channel));

        Move(order, variants, OrderStatus.Confirmed);
        Assert.Equal("order.locked", Assert.Throws<DomainConflictException>(() => order.ReplaceItems(SalesChannel.Instagram, [OrderLine.From(product, variant, 1, null)], 0, 0, null)).Code);
        order.UpdateDetails(new OrderDelivery("عمّان · خلدا", true, "سارة", "0791234567", "كل عام وأنتِ بخير"), "لفّ هدية");
        Assert.Equal(("+962791234567", "سارة"), (order.RecipientPhone, order.RecipientName));

        Move(order, variants, OrderStatus.Delivered);
        Assert.Equal("order.locked", Assert.Throws<DomainConflictException>(() => order.UpdateDetails(NoDelivery, null)).Code);
    }

    [Fact]
    public void Archived_products_cannot_be_ordered()
    {
        var (product, variant) = Cream(3);
        product.Archive();
        Assert.Equal("order.item_archived", Assert.Throws<DomainConflictException>(() => OrderLine.From(product, variant, 1, null)).Code);
    }
}
