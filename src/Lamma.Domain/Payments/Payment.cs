using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Domain.Payments;

/// <summary>A payment brings money in; a refund gives it back on a return (D-148).</summary>
public enum PaymentKind
{
    Payment,
    Refund,
}

/// <summary>One part of a payment applied to one order (D-131). The reversal flag mirrors the payment's (D-136).</summary>
public readonly record struct AllocationLine(Guid OrderId, decimal Amount);

/// <summary>
/// Money received from a customer (DATABASE-DESIGN §5.6, D-131–D-138). Never edited or deleted: a mistake is reversed,
/// which keeps the row and its allocations and excludes them from every sum (D-136).
/// An order-level payment has <see cref="OrderId"/> and one allocation; a customer-level one has FIFO allocations.
/// </summary>
public sealed class Payment : Entity, IBusinessOwned
{
    public const int NoteMaxLength = 200;
    public const int ReversalReasonMaxLength = 200;

    private readonly List<PaymentAllocation> _allocations = [];

    private Payment(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private Payment()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid CustomerId { get; private set; }

    /// <summary>Set for an order-level payment (or a deposit); null for a customer-level payment.</summary>
    public Guid? OrderId { get; private set; }

    public decimal Amount { get; private set; }

    public PaymentMethod Method { get; private set; }

    /// <summary>Refunds have a negative allocation, so order paid = Σ active allocations stays net of refunds.</summary>
    public PaymentKind Kind { get; private set; } = PaymentKind.Payment;

    /// <summary>The business-local date the money was received (back-dating allowed, D-136).</summary>
    public DateOnly PaidOn { get; private set; }

    public DateTime RecordedAt { get; private set; }

    public string? Note { get; private set; }

    public Guid OperationId { get; private set; }

    public DateTime? ReversedAt { get; private set; }

    public string? ReversalReason { get; private set; }

    public Guid? ReversalOperationId { get; private set; }

    /// <summary>Set when a courier settlement created this payment (D-141); such a payment is reversed only with it.</summary>
    public Guid? SettlementId { get; private set; }

    public IReadOnlyCollection<PaymentAllocation> Allocations => _allocations;

    public bool IsReversed => ReversedAt is not null;

    /// <summary>
    /// A payment on one order (D-132, D-135, D-136). <paramref name="remaining"/> is the order's remaining amount read
    /// under the order lock; <paramref name="orderCreatedOn"/> is the order's business-local creation date.
    /// </summary>
    public static Payment ForOrder(
        Guid businessId,
        Guid customerId,
        Guid orderId,
        decimal remaining,
        decimal amount,
        PaymentMethod method,
        DateOnly paidOn,
        DateOnly today,
        DateOnly orderCreatedOn,
        string? note,
        Guid operationId,
        DateTime nowUtc)
    {
        Guard.NotEmpty(orderId, nameof(orderId));
        if (paidOn < orderCreatedOn)
        {
            throw new DomainException("payment.invalid_date", "تاريخ الدفعة لازم يكون من يوم إنشاء الطلب أو بعده.");
        }

        if (amount > remaining)
        {
            throw new DomainConflictException(
                "payment.exceeds_remaining",
                remaining <= 0 ? "الطلب مدفوع بالكامل." : $"المبلغ أكبر من المتبقي على الطلب ({Format(remaining)} د.أ).");
        }

        var payment = Create(businessId, customerId, amount, method, paidOn, today, note, operationId, nowUtc);
        payment.OrderId = orderId;
        payment._allocations.Add(new PaymentAllocation(payment, orderId, amount));
        return payment;
    }

    /// <summary>A payment against the customer, split over their receivable orders oldest first (D-131, D-132).</summary>
    public static Payment ForCustomer(
        Guid businessId,
        Guid customerId,
        IReadOnlyList<AllocationLine> receivables,
        decimal amount,
        PaymentMethod method,
        DateOnly paidOn,
        DateOnly today,
        string? note,
        Guid operationId,
        DateTime nowUtc)
    {
        var payment = Create(businessId, customerId, amount, method, paidOn, today, note, operationId, nowUtc);
        foreach (var line in PaymentAllocator.Allocate(amount, receivables))
        {
            payment._allocations.Add(new PaymentAllocation(payment, line.OrderId, line.Amount));
        }

        return payment;
    }

    /// <summary>
    /// The COD money of one settled order (D-141): covers what is left on it, so the order becomes paid. Created only
    /// by <see cref="Courier.CourierSettlement"/>; the method is always COD.
    /// </summary>
    internal static Payment ForSettlement(Guid businessId, Guid customerId, Guid orderId, decimal amount, DateOnly settledOn, Guid settlementId, Guid operationId, DateTime nowUtc)
    {
        Guard.NotEmpty(customerId, nameof(customerId));
        PaymentRules.EnsureAmount(amount);
        var payment = new Payment(NewId(), businessId)
        {
            CustomerId = customerId,
            OrderId = orderId,
            Amount = amount,
            Method = PaymentMethod.Cod,
            PaidOn = settledOn,
            RecordedAt = nowUtc,
            Note = "تسوية شركة التوصيل",
            OperationId = operationId,
            SettlementId = settlementId,
        };
        payment._allocations.Add(new PaymentAllocation(payment, orderId, amount));
        return payment;
    }

    /// <summary>
    /// The money given back on a return (D-148): a «استرداد» with a recordable method (never COD) and one negative
    /// allocation on the order. Created only with its return, in the same transaction.
    /// </summary>
    public static Payment ForRefund(Guid businessId, Guid customerId, Guid orderId, decimal amount, PaymentMethod method, DateOnly refundedOn, DateOnly today, Guid operationId, DateTime nowUtc)
    {
        Guard.NotEmpty(orderId, nameof(orderId));
        var payment = Create(businessId, customerId, amount, method, refundedOn, today, "استرداد مرتجع", operationId, nowUtc);
        payment.Kind = PaymentKind.Refund;
        payment.OrderId = orderId;
        payment._allocations.Add(new PaymentAllocation(payment, orderId, -amount));
        return payment;
    }

    /// <summary>Voids the payment and all its allocations (D-136). A second reversal is a conflict.</summary>
    public void Reverse(string? reason, Guid operationId, DateTime nowUtc)
    {
        if (Kind == PaymentKind.Refund)
        {
            throw new DomainConflictException("payment.from_return", "هاد استرداد مرتجع، والمرتجع نهائي (ما بينلغى).");
        }

        if (SettlementId is not null)
        {
            throw new DomainConflictException("payment.from_settlement", "هاي الدفعة من تسوية شركة التوصيل. ألغِ التسوية نفسها من صفحة شركة التوصيل.");
        }

        ReverseCore(reason, operationId, nowUtc);
    }

    internal void ReverseBySettlement(Guid operationId, DateTime nowUtc) => ReverseCore("انلغت التسوية", operationId, nowUtc);

    private void ReverseCore(string? reason, Guid operationId, DateTime nowUtc)
    {
        if (IsReversed)
        {
            throw new DomainConflictException("payment.already_reversed", "هاي الدفعة ملغية من قبل.");
        }

        var cleaned = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (cleaned is { Length: > ReversalReasonMaxLength })
        {
            throw new DomainException("payment.text_too_long", $"سبب الإلغاء لازم يكون {ReversalReasonMaxLength} حرف أو أقل.");
        }

        ReversedAt = nowUtc;
        ReversalReason = cleaned;
        ReversalOperationId = operationId;
        foreach (var allocation in _allocations)
        {
            allocation.MarkReversed();
        }
    }

    private static Payment Create(Guid businessId, Guid customerId, decimal amount, PaymentMethod method, DateOnly paidOn, DateOnly today, string? note, Guid operationId, DateTime nowUtc)
    {
        Guard.NotEmpty(customerId, nameof(customerId));
        Guard.NotEmpty(operationId, nameof(operationId));
        PaymentRules.EnsureAmount(amount);
        PaymentRules.EnsureRecordable(method);
        if (paidOn > today)
        {
            throw new DomainException("payment.invalid_date", "تاريخ الدفعة ما بصير يكون بالمستقبل.");
        }

        var cleaned = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (cleaned is { Length: > NoteMaxLength })
        {
            throw new DomainException("payment.text_too_long", $"الملاحظة لازم تكون {NoteMaxLength} حرف أو أقل.");
        }

        return new Payment(NewId(), businessId)
        {
            CustomerId = customerId,
            Amount = amount,
            Method = method,
            PaidOn = paidOn,
            RecordedAt = nowUtc,
            Note = cleaned,
            OperationId = operationId,
        };
    }

    internal static string Format(decimal amount) => amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
}

/// <summary>The part of a payment applied to one order. Order paid = Σ active allocations (D-131).</summary>
public sealed class PaymentAllocation : Entity, IBusinessOwned
{
    internal PaymentAllocation(Payment payment, Guid orderId, decimal amount)
        : base(NewId())
    {
        BusinessId = payment.BusinessId;
        PaymentId = payment.Id;
        OrderId = orderId;
        Amount = amount;
    }

    private PaymentAllocation()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid PaymentId { get; private set; }

    public Guid OrderId { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>Copied from the payment when it is reversed, so order sums need no join (same aggregate, same transaction).</summary>
    public bool IsReversed { get; private set; }

    internal void MarkReversed() => IsReversed = true;
}

/// <summary>Shared payment input rules (D-132, D-138).</summary>
public static class PaymentRules
{
    /// <summary>Methods a merchant records by hand: COD is collected by the courier and settled in Phase 7 (D-138).</summary>
    public static bool IsRecordable(PaymentMethod method) => method != PaymentMethod.Cod;

    public static void EnsureRecordable(PaymentMethod method)
    {
        if (!IsRecordable(method))
        {
            throw new DomainException("payment.method_not_allowed", "الدفع عند الاستلام بيجمعه المندوب، وبينسجّل مع تسوية شركة التوصيل.");
        }
    }

    public static void EnsureAmount(decimal amount)
    {
        if (amount <= 0 || amount > Product.MaxMoney || !MoneyMath.HasValidScale(amount))
        {
            throw new DomainException("payment.invalid_amount", "المبلغ لازم يكون أكبر من صفر.");
        }
    }
}

/// <summary>FIFO split of a customer payment over their receivable orders (D-131), exact to the fils.</summary>
public static class PaymentAllocator
{
    /// <param name="receivables">Orders in FIFO order (oldest delivery first) with their remaining amounts.</param>
    public static IReadOnlyList<AllocationLine> Allocate(decimal amount, IReadOnlyList<AllocationLine> receivables)
    {
        PaymentRules.EnsureAmount(amount);
        var balance = receivables.Where(r => r.Amount > 0).Sum(r => r.Amount);
        if (amount > balance)
        {
            throw new DomainConflictException(
                "payment.exceeds_balance",
                balance <= 0 ? "ما على العميل ذمم مستحقة." : $"المبلغ أكبر من المستحق على العميل ({Payment.Format(balance)} د.أ).");
        }

        var lines = new List<AllocationLine>();
        var left = amount;
        foreach (var receivable in receivables)
        {
            if (left == 0)
            {
                break;
            }

            if (receivable.Amount <= 0)
            {
                continue;
            }

            var part = Math.Min(left, receivable.Amount);
            lines.Add(new AllocationLine(receivable.OrderId, part));
            left -= part;
        }

        return lines;
    }
}
