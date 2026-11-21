using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Orders;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;

namespace Lamma.Application.Payments;

// ---------- Requests (API-DESIGN §16). Money: ≤ 2 dp in, 3-dp strings out (D-080). ----------

/// <summary>
/// Records money received against an order or a customer (D-131–D-138). Requires an Idempotency-Key.
/// <c>PaidOn</c> is the business-local date (back-dating allowed, never the future).
/// </summary>
public sealed record RecordPaymentRequest(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Method,
    DateOnly PaidOn,
    string? Note);

/// <summary>Voids a mistaken payment (D-136). Requires an Idempotency-Key.</summary>
public sealed record ReversePaymentRequest(string? Reason);

/// <summary>Optional deposit taken when an order is created (D-135), dated today.</summary>
public sealed record InitialPaymentRequest(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Method);

public sealed class PaymentListQuery
{
    /// <summary>Paid on or after this business-local date.</summary>
    public DateOnly? From { get; set; }

    public DateOnly? To { get; set; }

    public string? Method { get; set; }

    public Guid? CustomerId { get; set; }

    /// <summary>Payments with an allocation on this order (order-level or customer-level).</summary>
    public Guid? OrderId { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

public sealed class ReceivableListQuery
{
    /// <summary>Order number, customer name or ≥ 3 phone digits.</summary>
    public string? Search { get; set; }

    /// <summary>fresh | late | overdue (D-038).</summary>
    public string? Bucket { get; set; }

    public Guid? CustomerId { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

// ---------- Responses ----------

public sealed record PaymentAllocationDto(
    Guid OrderId,
    int OrderNumber,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount);

public sealed record PaymentDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    Guid? OrderId,
    int? OrderNumber,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Method,
    DateOnly PaidOn,
    DateTime RecordedAt,
    string? Note,
    bool IsReversed,
    DateTime? ReversedAt,
    string? ReversalReason,
    IReadOnlyList<PaymentAllocationDto> Allocations,
    /// <summary>Set for a payment created by a courier settlement (D-141): reversed only with its settlement.</summary>
    Guid? SettlementId,
    /// <summary>payment | refund (D-148).</summary>
    string Kind);

/// <summary>Server-computed payment figures of one order after a write (D-133).</summary>
public sealed record OrderPaymentSummaryDto(
    Guid OrderId,
    int Number,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Paid,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Remaining,
    string? PaymentStatus);

/// <summary>Result of recording or reversing: the payment, every touched order, and the customer's balance (D-134).</summary>
public sealed record PaymentResultDto(
    PaymentDto Payment,
    IReadOnlyList<OrderPaymentSummaryDto> Orders,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CustomerBalance);

public sealed record ReceivableDto(
    Guid OrderId,
    int Number,
    Guid CustomerId,
    string CustomerName,
    string? CustomerPhone,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Paid,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Remaining,
    string PaymentStatus,
    DateTime DeliveredAt,
    int AgeDays,
    string Bucket);

public sealed record AgingBucketDto(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    int Count);

/// <summary>Receivables aging (D-038, D-134) plus the courier-held amount shown for information (settled in Phase 7).</summary>
public sealed record ReceivablesAgingDto(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    int Count,
    int CustomerCount,
    AgingBucketDto Fresh,
    AgingBucketDto Late,
    AgingBucketDto Overdue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CourierHeld,
    int CourierHeldCount);

// ---------- Ports (Infrastructure) ----------

/// <summary>The payment figures of one order, read under its lock.</summary>
public sealed record OrderPaymentState(
    Guid OrderId,
    Guid CustomerId,
    int Number,
    OrderStatus Status,
    PaymentMethod? ExpectedMethod,
    decimal Total,
    decimal Paid,
    DateTime CreatedAt,
    DateTime? DeliveredAt)
{
    public decimal Remaining => Total - Paid;
}

public interface IPaymentRepository
{
    void Add(Payment payment);

    /// <summary>
    /// Takes an exclusive lock on the order row until commit (and bumps its rowversion, so a concurrent status change
    /// retries and sees the payment), then reads its figures. Null when the order is not in the current business.
    /// </summary>
    Task<OrderPaymentState?> LockOrderAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>Locks the customer row, then every delivered order of the customer; returns false when not found.</summary>
    Task<bool> LockCustomerAsync(Guid customerId, CancellationToken cancellationToken);

    /// <summary>The customer's delivered orders with their paid amounts (call after <see cref="LockCustomerAsync"/>).</summary>
    Task<IReadOnlyList<OrderPaymentState>> DeliveredOrdersAsync(Guid customerId, CancellationToken cancellationToken);

    /// <summary>Locks the payment row, then loads it with its allocations, tracked for update.</summary>
    Task<Payment?> LockForUpdateAsync(Guid paymentId, CancellationToken cancellationToken);

    Task<bool> HasActivePaymentsAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>The payments a settlement created, with allocations, tracked for update.</summary>
    Task<IReadOnlyList<Payment>> BySettlementForUpdateAsync(Guid settlementId, CancellationToken cancellationToken);

    /// <summary>Σ active allocations of the order (D-131).</summary>
    Task<decimal> PaidAsync(Guid orderId, CancellationToken cancellationToken);
}

public interface IPaymentQueries
{
    Task<PagedResult<PaymentDto>> ListAsync(PaymentListQuery query, CancellationToken cancellationToken);

    Task<PaymentDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<ReceivableDto>> ReceivablesAsync(ReceivableListQuery query, DateOnly today, CancellationToken cancellationToken);

    Task<ReceivablesAgingDto> AgingAsync(DateOnly today, CancellationToken cancellationToken);

    Task<IReadOnlyList<OrderPaymentSummaryDto>> OrderSummariesAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken cancellationToken);

    /// <summary>Σ remaining over the customer's receivable orders (D-134).</summary>
    Task<decimal> CustomerBalanceAsync(Guid customerId, CancellationToken cancellationToken);
}

// ---------- Validators ----------

public sealed class RecordPaymentRequestValidator : AbstractValidator<RecordPaymentRequest>
{
    public RecordPaymentRequestValidator()
    {
        RuleFor(x => x.Amount).Must(a => OrderValidation.IsMoneyInput(a, allowZero: false)).WithMessage("المبلغ لازم يكون أكبر من صفر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.Method).Must(m => m is not null && EnumCode.TryParse<PaymentMethod>(m, out _)).WithMessage("اختار طريقة الدفع.");
        RuleFor(x => x.PaidOn).NotEmpty().WithMessage("اختار تاريخ الدفعة.");
        RuleFor(x => x.Note).MaximumLength(Payment.NoteMaxLength).WithMessage($"الملاحظة لازم تكون {Payment.NoteMaxLength} حرف أو أقل.");
    }
}

public sealed class InitialPaymentRequestValidator : AbstractValidator<InitialPaymentRequest>
{
    public InitialPaymentRequestValidator()
    {
        RuleFor(x => x.Amount).Must(a => OrderValidation.IsMoneyInput(a, allowZero: false)).OverridePropertyName("payment.amount").WithMessage("المدفوع لازم يكون أكبر من صفر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.Method).Must(m => m is not null && EnumCode.TryParse<PaymentMethod>(m, out _)).OverridePropertyName("payment.method").WithMessage("اختار طريقة الدفع.");
    }
}

public sealed class ReversePaymentRequestValidator : AbstractValidator<ReversePaymentRequest>
{
    public ReversePaymentRequestValidator()
        => RuleFor(x => x.Reason).MaximumLength(Payment.ReversalReasonMaxLength).WithMessage($"سبب الإلغاء لازم يكون {Payment.ReversalReasonMaxLength} حرف أو أقل.");
}

public sealed class PaymentListQueryValidator : AbstractValidator<PaymentListQuery>
{
    public PaymentListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Method).Must(OrderValidation.IsOptionalCode<PaymentMethod>).WithMessage("طريقة الدفع غير معروفة.");
        RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From).WithMessage("تاريخ النهاية قبل تاريخ البداية.");
    }
}

public sealed class ReceivableListQueryValidator : AbstractValidator<ReceivableListQuery>
{
    public ReceivableListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Bucket).Must(OrderValidation.IsOptionalCode<AgingBucket>).WithMessage("الفئة غير معروفة.");
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل كثير.");
    }
}
