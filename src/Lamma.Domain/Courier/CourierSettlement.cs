using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Expenses;
using Lamma.Domain.Payments;

namespace Lamma.Domain.Courier;

/// <summary>A courier-held order picked for a settlement: what is left on it, read under its lock (D-141).</summary>
public readonly record struct HeldOrder(Guid OrderId, Guid CustomerId, int Number, decimal Remaining, DateOnly DeliveredOn);

/// <summary>What a new settlement writes besides itself: one COD payment per order and, if any, the difference expense.</summary>
public sealed class SettlementWrites(IReadOnlyList<Payment> payments, Expense? differenceExpense)
{
    public IReadOnlyList<Payment> Payments { get; } = payments;

    public Expense? DifferenceExpense { get; } = differenceExpense;
}

/// <summary>
/// A transfer from the courier company (D-139–D-141). Expected = Σ what is left on the picked orders; the courier may
/// keep fees, so 0 ≤ received ≤ expected and the difference becomes one «توصيل» expense (D-035). Never edited or
/// deleted: undo is a reversal that voids its payments and its expense.
/// </summary>
public sealed class CourierSettlement : Entity, IBusinessOwned
{
    public const int MaxOrders = 200;
    public const int NoteMaxLength = 200;
    public const string DefaultCompanyName = "شركة التوصيل";

    private readonly List<CourierSettlementOrder> _orders = [];

    private CourierSettlement(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private CourierSettlement()
    {
    }

    public Guid BusinessId { get; private set; }

    public DateOnly SettledOn { get; private set; }

    public decimal ExpectedAmount { get; private set; }

    public decimal ReceivedAmount { get; private set; }

    /// <summary>Expected − received: what the courier kept (its fees). Recorded as a delivery expense when > 0.</summary>
    public decimal Difference { get; private set; }

    public string? Note { get; private set; }

    public DateTime RecordedAt { get; private set; }

    public Guid OperationId { get; private set; }

    public DateTime? ReversedAt { get; private set; }

    public string? ReversalReason { get; private set; }

    public IReadOnlyCollection<CourierSettlementOrder> Orders => _orders;

    public bool IsReversed => ReversedAt is not null;

    /// <summary>Builds the settlement and what it writes (D-141). Every order must still be due; the date is not before any delivery.</summary>
    public static (CourierSettlement Settlement, SettlementWrites Writes) Create(
        Guid businessId,
        IReadOnlyList<HeldOrder> orders,
        decimal received,
        DateOnly settledOn,
        DateOnly today,
        string? note,
        Guid deliveryCategoryId,
        Guid operationId,
        DateTime nowUtc)
    {
        Guard.NotEmpty(operationId, nameof(operationId));
        if (orders.Count == 0)
        {
            throw new DomainException("settlement.orders_required", "اختار طلب واحد على الأقل.");
        }

        if (orders.Count > MaxOrders)
        {
            throw new DomainException("settlement.too_many_orders", $"الحد الأقصى {MaxOrders} طلب بالتسوية.");
        }

        if (orders.Select(o => o.OrderId).Distinct().Count() != orders.Count)
        {
            throw new DomainException("settlement.duplicate_order", "الطلب مكرر بالتسوية.");
        }

        foreach (var order in orders.Where(o => o.Remaining <= 0))
        {
            throw new DomainConflictException("settlement.order_not_held", $"الطلب #{order.Number} مش عند شركة التوصيل (مدفوع أو متسوّى).");
        }

        if (received < 0 || received > Product.MaxMoney || !MoneyMath.HasValidScale(received))
        {
            throw new DomainException("settlement.invalid_amount", "المبلغ اللي وصلك لازم يكون صفر أو أكثر.");
        }

        var expected = orders.Sum(o => o.Remaining);
        if (received > expected)
        {
            throw new DomainConflictException("settlement.received_too_high", "المبلغ اللي وصلك أكبر من المتوقع. تأكد من الطلبات المختارة.");
        }

        if (settledOn > today)
        {
            throw new DomainException("settlement.invalid_date", "تاريخ التحويل ما بصير يكون بالمستقبل.");
        }

        if (orders.Any(o => settledOn < o.DeliveredOn))
        {
            throw new DomainException("settlement.invalid_date", "تاريخ التحويل قبل توصيل بعض الطلبات.");
        }

        var settlement = new CourierSettlement(NewId(), businessId)
        {
            SettledOn = settledOn,
            ExpectedAmount = expected,
            ReceivedAmount = received,
            Difference = expected - received,
            Note = Expense.Clean(note, NoteMaxLength),
            RecordedAt = nowUtc,
            OperationId = operationId,
        };
        foreach (var order in orders)
        {
            settlement._orders.Add(new CourierSettlementOrder(settlement, order.OrderId, order.Remaining));
        }

        var payments = orders
            .Select(o => Payment.ForSettlement(businessId, o.CustomerId, o.OrderId, o.Remaining, settledOn, settlement.Id, Entity.NewId(), nowUtc))
            .ToList();
        var expense = settlement.Difference > 0
            ? Expense.ForSettlement(businessId, deliveryCategoryId, settlement.Difference, settledOn, settlement.Id, Entity.NewId(), nowUtc)
            : null;
        return (settlement, new SettlementWrites(payments, expense));
    }

    /// <summary>
    /// Undo (D-141): voids the settlement, its order lines, its payments and its difference expense, so the orders are
    /// courier-held again. <paramref name="payments"/> and <paramref name="expense"/> are the ones it created.
    /// </summary>
    public void Reverse(IReadOnlyList<Payment> payments, Expense? expense, string? reason, DateTime nowUtc)
    {
        if (IsReversed)
        {
            throw new DomainConflictException("settlement.already_reversed", "هاي التسوية ملغية من قبل.");
        }

        if (payments.Any(p => p.SettlementId != Id) || (expense is not null && expense.SettlementId != Id))
        {
            throw new InvalidOperationException("Only the settlement's own payments and expense can be reversed with it.");
        }

        ReversedAt = nowUtc;
        ReversalReason = Expense.Clean(reason, NoteMaxLength);
        foreach (var line in _orders)
        {
            line.MarkReversed();
        }

        foreach (var payment in payments.Where(p => !p.IsReversed))
        {
            payment.ReverseBySettlement(Entity.NewId(), nowUtc);
        }

        if (expense is { IsVoided: false })
        {
            expense.VoidBySettlement(nowUtc);
        }
    }
}

/// <summary>One order of a settlement with the amount expected for it. An order is in at most one active settlement.</summary>
public sealed class CourierSettlementOrder : Entity, IBusinessOwned
{
    internal CourierSettlementOrder(CourierSettlement settlement, Guid orderId, decimal expectedAmount)
        : base(NewId())
    {
        BusinessId = settlement.BusinessId;
        SettlementId = settlement.Id;
        OrderId = orderId;
        ExpectedAmount = expectedAmount;
    }

    private CourierSettlementOrder()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid SettlementId { get; private set; }

    public Guid OrderId { get; private set; }

    public decimal ExpectedAmount { get; private set; }

    /// <summary>Copied from the settlement on reversal; the unique "settled once" index covers active lines only.</summary>
    public bool IsReversed { get; private set; }

    internal void MarkReversed() => IsReversed = true;
}
