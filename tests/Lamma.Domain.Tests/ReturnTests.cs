using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;

namespace Lamma.Domain.Tests;

public sealed class ReturnRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 22, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 11, 22);
    private static readonly OrderDelivery NoDelivery = new(null, false, null, null, null);

    private static (Product Product, ProductVariant Variant) Item(string name, decimal price, int stock)
    {
        var product = Product.Create(Guid.NewGuid(), name, null, "beauty", price, 4m, 5, "{}", [], []);
        var variant = product.Variants.Single();
        if (stock > 0)
        {
            product.RecordOpeningStock(variant, stock, Guid.NewGuid(), Now);
        }

        return (product, variant);
    }

    /// <summary>A delivered order: 3 × 10 + 1 × 5 = 35, fee 2, discount 7 → total 30.</summary>
    private static (Order Order, Dictionary<Guid, ProductVariant> Variants, OrderItem A, OrderItem B) Delivered()
    {
        var (pa, va) = Item("كريم", 10m, 10);
        var (pb, vb) = Item("صابون", 5m, 10);
        var order = Order.Create(Guid.NewGuid(), 1001, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(pa, va, 3, null), OrderLine.From(pb, vb, 1, null)], 2m, 7m, PaymentMethod.Cash, NoDelivery, null, Now);
        var variants = new Dictionary<Guid, ProductVariant> { [va.Id] = va, [vb.Id] = vb };
        order.ChangeStatus(OrderStatus.Delivered, null, null, variants, Guid.NewGuid(), Now);
        return (order, variants, order.Items.Single(i => i.UnitPrice == 10m), order.Items.Single(i => i.UnitPrice == 5m));
    }

    private static (OrderReturn Return, IReadOnlyList<StockMovement> Movements) Return(Order order, Dictionary<Guid, ProductVariant> variants, params ReturnLineRequest[] lines)
        => order.Return(lines, variants, Today, Today, Today, null, Guid.NewGuid(), Now);

    [Fact]
    public void Partial_then_full_return_removes_exactly_the_discount_and_closes_the_order()
    {
        var (order, variants, a, b) = Delivered();
        Assert.Equal(30m, order.Total);

        var first = Return(order, variants, new ReturnLineRequest(a.Id, 1, true));
        Assert.Equal(8m, first.Return.Amount); // 10 − round(7 × 10 / 35) = 10 − 2
        Assert.Equal((OrderStatus.Delivered, true, 22m), (order.Status, order.IsPartiallyReturned, order.NetTotal));

        var rest = Return(order, variants, new ReturnLineRequest(a.Id, 2, true), new ReturnLineRequest(b.Id, 1, false));
        Assert.Equal(20m, rest.Return.Amount); // cumulative 35 − 7 = 28, minus the 8 already returned
        Assert.Equal((OrderStatus.Returned, 28m, 2m), (order.Status, order.ReturnedAmount, order.NetTotal)); // the delivery fee stays
        Assert.Null(order.UndoableChange(Now)); // a return is final (D-150)
    }

    [Fact]
    public void Restocked_pieces_go_back_with_a_return_movement_and_damaged_ones_do_not()
    {
        var (order, variants, a, b) = Delivered();
        var stockA = variants[a.VariantId].OnHand;
        var stockB = variants[b.VariantId].OnHand;

        var (_, movements) = Return(order, variants, new ReturnLineRequest(a.Id, 2, true), new ReturnLineRequest(b.Id, 1, false));

        var movement = Assert.Single(movements);
        Assert.Equal((StockMovementType.Return, 2, 0, a.VariantId), (movement.Type, movement.OnHandDelta, movement.ReservedDelta, movement.VariantId));
        Assert.Equal((stockA + 2, stockB), (variants[a.VariantId].OnHand, variants[b.VariantId].OnHand));
    }

    [Fact]
    public void Return_rules_reject_bad_requests()
    {
        var (order, variants, a, _) = Delivered();
        Assert.Equal("return.quantity_too_high", Assert.Throws<DomainConflictException>(() => Return(order, variants, new ReturnLineRequest(a.Id, 4, true))).Code);
        Assert.Equal("return.item_not_found", Assert.ThrowsAny<DomainException>(() => Return(order, variants, new ReturnLineRequest(Guid.NewGuid(), 1, true))).Code);
        Assert.Equal("return.invalid_date", Assert.ThrowsAny<DomainException>(() => order.Return([new(a.Id, 1, true)], variants, Today.AddDays(1), Today, Today, null, Guid.NewGuid(), Now)).Code);
        Assert.Equal("return.invalid_date", Assert.ThrowsAny<DomainException>(() => order.Return([new(a.Id, 1, true)], variants, Today.AddDays(-1), Today, Today, null, Guid.NewGuid(), Now)).Code);

        var (product, variant) = Item("عطر", 10m, 5);
        var open = Order.Create(Guid.NewGuid(), 1002, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, 1, null)], 0m, 0m, null, NoDelivery, null, Now);
        Assert.Equal("return.not_delivered", Assert.Throws<DomainConflictException>(() => open.Return([new(open.Items.Single().Id, 1, true)], new Dictionary<Guid, ProductVariant>(), Today, Today, Today, null, Guid.NewGuid(), Now)).Code);
    }

    [Theory]
    [InlineData(30, 20, 10, 10, 10)] // fully paid: the refund must take paid back down to the net total
    [InlineData(15, 20, 10, 0, 10)]  // partly paid: no refund needed, up to the returned value
    [InlineData(0, 20, 10, 0, 0)]    // unpaid: it simply owes less
    public void Refund_range_leaves_no_customer_credit(int paid, int netAfter, int value, int min, int max)
        => Assert.Equal(new RefundRange(min, max), RefundRange.For(paid, netAfter, value));

    [Fact]
    public void Refund_is_a_negative_allocation_that_cannot_be_reversed_alone()
    {
        var refund = Payment.ForRefund(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 10m, PaymentMethod.Cash, Today, Today, Guid.NewGuid(), Now);
        Assert.Equal((PaymentKind.Refund, 10m, -10m), (refund.Kind, refund.Amount, Assert.Single(refund.Allocations).Amount));
        Assert.Equal("payment.from_return", Assert.Throws<DomainConflictException>(() => refund.Reverse(null, Guid.NewGuid(), Now)).Code);
        Assert.Equal("payment.method_not_allowed", Assert.ThrowsAny<DomainException>(() => Payment.ForRefund(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 10m, PaymentMethod.Cod, Today, Today, Guid.NewGuid(), Now)).Code);
    }

    [Fact]
    public void Pre_order_schedule_rules()
    {
        var (product, variant) = Item("كيكة", 10m, 0);
        var order = Order.Create(Guid.NewGuid(), 1003, Guid.NewGuid(), SalesChannel.Instagram, [OrderLine.From(product, variant, 3, null)], 0m, 0m, null, NoDelivery, null, Now);

        order.Schedule(Today.AddDays(3), new TimeOnly(14, 30), Today);
        Assert.Equal((true, Today.AddDays(3), new TimeOnly(14, 30)), (order.IsPreOrder, order.ExpectedDeliveryOn!.Value, order.ExpectedDeliveryTime!.Value));

        Assert.Equal("order.invalid_schedule", Assert.ThrowsAny<DomainException>(() => order.Schedule(Today.AddDays(-1), null, Today)).Code);
        Assert.Equal("order.invalid_schedule", Assert.ThrowsAny<DomainException>(() => order.Schedule(null, new TimeOnly(9, 0), Today)).Code);
        order.Schedule(Today.AddDays(3), new TimeOnly(14, 30), Today.AddDays(5)); // unchanged past date is kept
        order.Schedule(null, null, Today);
        Assert.False(order.IsPreOrder);
    }
}
