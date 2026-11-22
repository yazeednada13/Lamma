using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;

namespace Lamma.Application.Orders;

// ---------- Requests (API-DESIGN §15). Money: 3-dp strings out, ≤ 2 dp in (D-080). ----------

/// <summary>One order line. <c>UnitPrice</c> defaults to the variant's current effective price.</summary>
public sealed record OrderItemRequest(
    Guid VariantId,
    int Quantity,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? UnitPrice);

/// <summary>
/// Creates an order (D-128: <c>Status</c> = new | confirmed). Requires an Idempotency-Key (D-112).
/// The server computes every total from the line snapshots. <c>Payment</c> is an optional deposit dated today (D-135).
/// </summary>
public sealed record CreateOrderRequest(
    Guid CustomerId,
    string Channel,
    IReadOnlyList<OrderItemRequest> Items,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal DeliveryFee,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Discount,
    string? PaymentMethod,
    string? DeliveryAddress,
    bool IsGift,
    string? RecipientName,
    string? RecipientPhone,
    string? GiftMessage,
    string? Note,
    string Status,
    InitialPaymentRequest? Payment = null,
    DateOnly? ExpectedDeliveryOn = null,
    string? ExpectedDeliveryTime = null);

/// <summary>Full edit of a new order (D-127): items, fee, discount, channel, payment method and details.</summary>
public sealed record UpdateOrderRequest(
    string Channel,
    IReadOnlyList<OrderItemRequest> Items,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal DeliveryFee,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Discount,
    string? PaymentMethod,
    string? DeliveryAddress,
    bool IsGift,
    string? RecipientName,
    string? RecipientPhone,
    string? GiftMessage,
    string? Note,
    DateOnly? ExpectedDeliveryOn = null,
    string? ExpectedDeliveryTime = null);

/// <summary>Address, gift details, note and pre-order schedule: editable until delivered or closed (D-127, D-151).</summary>
public sealed record UpdateOrderDetailsRequest(
    string? DeliveryAddress,
    bool IsGift,
    string? RecipientName,
    string? RecipientPhone,
    string? GiftMessage,
    string? Note,
    DateOnly? ExpectedDeliveryOn = null,
    string? ExpectedDeliveryTime = null);

/// <summary>One returned line (D-146, D-147).</summary>
public sealed record ReturnLineInput(Guid OrderItemId, int Quantity, bool Restock);

/// <summary>Money given back with a return (D-148): within the range the order details report.</summary>
public sealed record RefundInput(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Method);

/// <summary>Returns pieces of a delivered order (D-145–D-150). Final. Requires an Idempotency-Key.</summary>
public sealed record ReturnOrderRequest(IReadOnlyList<ReturnLineInput> Lines, DateOnly ReturnedOn, string? Reason, RefundInput? Refund);

/// <summary>Pre-orders whose expected delivery date is in the range (default: today and the next 13 days).</summary>
public sealed class PreOrderQuery
{
    public DateOnly? From { get; set; }

    public DateOnly? To { get; set; }
}

/// <summary>
/// Moves the order to <c>To</c> (D-121). <c>ExpectedStatus</c> is the status the client saw; a stale one returns 409
/// <c>order.status_changed</c>. Cancelling needs <c>CancelReason</c> (D-130).
/// </summary>
public sealed record ChangeOrderStatusRequest(string To, string ExpectedStatus, string? CancelReason, string? CancelNote);

/// <summary>Reverts the change <c>ChangeId</c> (the latest one, within 5 minutes; D-122).</summary>
public sealed record UndoOrderStatusRequest(Guid ChangeId);

public sealed class OrderListQuery
{
    public string? Search { get; set; }

    /// <summary>An order status code.</summary>
    public string? Status { get; set; }

    /// <summary>Created on or after this business-local date (Asia/Amman, D-124).</summary>
    public DateOnly? From { get; set; }

    /// <summary>Created on or before this business-local date.</summary>
    public DateOnly? To { get; set; }

    public Guid? CustomerId { get; set; }

    /// <summary>Orders that contain this product.</summary>
    public Guid? ProductId { get; set; }

    /// <summary>-createdAt (default) | createdAt | -total.</summary>
    public string? Sort { get; set; }

    /// <summary>Only pre-orders (D-151).</summary>
    public bool? IsPreOrder { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

// ---------- Responses ----------

public sealed record OrderItemSummaryDto(string ProductName, string? VariantLabel, int Quantity);

public sealed record OrderListItemDto(
    Guid Id,
    int Number,
    Guid CustomerId,
    string CustomerName,
    string? CustomerPhone,
    string Channel,
    string Status,
    string? NextStatus,
    int Pieces,
    IReadOnlyList<OrderItemSummaryDto> Items,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    DateTime CreatedAt,
    DateTime? DeliveredAt,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Paid,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Remaining,
    string? PaymentStatus,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ReturnedAmount,
    DateOnly? ExpectedDeliveryOn,
    string? ExpectedDeliveryTime);

/// <summary>A pre-order on the calendar (D-151).</summary>
public sealed record PreOrderDto(
    Guid Id,
    int Number,
    Guid CustomerId,
    string CustomerName,
    string Status,
    DateOnly ExpectedDeliveryOn,
    string? ExpectedDeliveryTime,
    IReadOnlyList<OrderItemSummaryDto> Items,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total);

public sealed record OrderReturnLineDto(Guid OrderItemId, string ProductName, string? VariantLabel, int Quantity, bool Restocked);

/// <summary>A return of the order (D-145–D-150) and the refund paid with it, if any.</summary>
public sealed record OrderReturnDto(
    Guid Id,
    DateOnly ReturnedOn,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string? Reason,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal RefundAmount,
    string? RefundMethod,
    DateTime RecordedAt,
    IReadOnlyList<OrderReturnLineDto> Lines);

public sealed record OrderStatusCountsDto(int All, int New, int Confirmed, int Preparing, int Courier, int Delivered, int Cancelled, int Returned);

public sealed record OrderCustomerDto(Guid Id, string Name, string? Phone, string? City, string? Area, bool IsArchived);

public sealed record OrderItemDto(
    Guid Id,
    Guid ProductId,
    Guid VariantId,
    string ProductName,
    string? VariantLabel,
    string? ImageUrl,
    int Quantity,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal UnitPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal UnitCost,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal LineTotal,
    int ReturnedQuantity);

public sealed record OrderStatusChangeDto(Guid Id, string? From, string To, DateTime ChangedAt, bool IsUndo, string? CancelReason, string? Note);

/// <summary>The change that can be undone now, and until when (server clock).</summary>
public sealed record OrderUndoDto(Guid ChangeId, string From, string To, DateTime AvailableUntil);

/// <summary>
/// A payment applied to the order (D-131). <c>Amount</c> is the part on this order; <c>PaymentAmount</c> the whole
/// payment (differs for a customer-level payment split over several orders). Reversed payments are listed and flagged.
/// </summary>
public sealed record OrderPaymentDto(
    Guid PaymentId,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal PaymentAmount,
    string Method,
    DateOnly PaidOn,
    DateTime RecordedAt,
    string? Note,
    bool IsCustomerLevel,
    bool IsReversed,
    DateTime? ReversedAt,
    string? ReversalReason,
    /// <summary>Set for a payment from a courier settlement (D-141).</summary>
    Guid? SettlementId,
    /// <summary>payment | refund (a refund's <c>Amount</c> on the order is negative, D-148).</summary>
    string Kind);

public sealed record OrderDetailsDto(
    Guid Id,
    int Number,
    OrderCustomerDto Customer,
    string Channel,
    string Status,
    string? NextStatus,
    IReadOnlyList<string> AllowedStatuses,
    bool CanEditItems,
    bool CanEditDetails,
    IReadOnlyList<OrderItemDto> Items,
    int Pieces,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ItemsSubtotal,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal DeliveryFee,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Discount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ItemsCost,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Profit,
    string? PaymentMethod,
    string? DeliveryAddress,
    bool IsGift,
    string? RecipientName,
    string? RecipientPhone,
    string? GiftMessage,
    string? Note,
    string? CancelReason,
    string? CancelNote,
    IReadOnlyList<OrderStatusChangeDto> Timeline,
    OrderUndoDto? Undo,
    DateTime CreatedAt,
    DateTime? ConfirmedAt,
    DateTime? DeliveredAt,
    DateTime? CancelledAt,
    DateTime UpdatedAt,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Paid,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Remaining,
    string? PaymentStatus,
    IReadOnlyList<OrderPaymentDto> Payments,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ReturnedAmount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetTotal,
    bool IsPartiallyReturned,
    bool CanReturn,
    IReadOnlyList<OrderReturnDto> Returns,
    DateOnly? ExpectedDeliveryOn,
    string? ExpectedDeliveryTime);

// ---------- Validators ----------

public sealed class OrderItemRequestValidator : AbstractValidator<OrderItemRequest>
{
    public OrderItemRequestValidator()
    {
        RuleFor(x => x.VariantId).NotEmpty().WithMessage("اختار المنتج.");
        RuleFor(x => x.Quantity).InclusiveBetween(1, Order.MaxLineQuantity).WithMessage($"الكمية لازم تكون بين 1 و {Order.MaxLineQuantity}.");
        RuleFor(x => x.UnitPrice).Must(p => p is null || OrderValidation.IsMoneyInput(p.Value, allowZero: false)).WithMessage("سعر القطعة لازم يكون أكبر من صفر وبمنزلتين عشريتين بالأكثر.");
    }
}

internal static class OrderValidation
{
    public static bool IsMoneyInput(decimal amount, bool allowZero)
        => (allowZero ? amount >= 0 : amount > 0) && amount <= Domain.Catalog.Product.MaxMoney && Math.Round(amount, 2) == amount;

    public static void Items<T>(AbstractValidator<T> validator, System.Linq.Expressions.Expression<Func<T, IReadOnlyList<OrderItemRequest>>> items)
    {
        validator.RuleFor(items)
            .NotNull().WithMessage("أضف منتج واحد على الأقل.")
            .Must(i => i is { Count: > 0 }).WithMessage("أضف منتج واحد على الأقل.")
            .Must(i => i is null || i.Count <= Order.MaxItems).WithMessage($"الحد الأقصى {Order.MaxItems} منتج بالطلب.")
            .Must(i => i is null || i.Select(x => x.VariantId).Distinct().Count() == i.Count).WithMessage("المنتج مكرر بالطلب. زيد الكمية بدل ما تضيفه مرتين.");
    }

    public static void Details<T>(
        AbstractValidator<T> validator,
        Func<T, string?> address,
        Func<T, bool> isGift,
        Func<T, string?> recipientName,
        Func<T, string?> giftMessage,
        Func<T, string?> note)
    {
        validator.RuleFor(x => address(x)).MaximumLength(Order.AddressMaxLength).OverridePropertyName("deliveryAddress").WithMessage($"العنوان لازم يكون {Order.AddressMaxLength} حرف أو أقل.");
        validator.RuleFor(x => recipientName(x)).Must((x, n) => !isGift(x) || !string.IsNullOrWhiteSpace(n)).OverridePropertyName("recipientName").WithMessage("اكتب اسم مستلم الهدية.");
        validator.RuleFor(x => recipientName(x)).MaximumLength(Order.RecipientNameMaxLength).OverridePropertyName("recipientName").WithMessage($"اسم المستلم لازم يكون {Order.RecipientNameMaxLength} حرف أو أقل.");
        validator.RuleFor(x => giftMessage(x)).MaximumLength(Order.GiftMessageMaxLength).OverridePropertyName("giftMessage").WithMessage($"رسالة الهدية لازم تكون {Order.GiftMessageMaxLength} حرف أو أقل.");
        validator.RuleFor(x => note(x)).MaximumLength(Order.NoteMaxLength).OverridePropertyName("note").WithMessage($"الملاحظة لازم تكون {Order.NoteMaxLength} حرف أو أقل.");
    }

    /// <summary>"HH:mm" (24 hours) or empty.</summary>
    public static bool IsOptionalTime(string? value) => value is null || TimeOnly.TryParseExact(value, "HH:mm", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _);

    public static TimeOnly? ParseTime(string? value) => value is null ? null : TimeOnly.ParseExact(value, "HH:mm", System.Globalization.CultureInfo.InvariantCulture);

    public static bool IsOptionalCode<TEnum>(string? code)
        where TEnum : struct, Enum
        => code is null || EnumCode.TryParse<TEnum>(code, out _);
}

public sealed class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty().WithMessage("اختار العميل.");
        RuleFor(x => x.Channel).Must(c => c is not null && EnumCode.TryParse<SalesChannel>(c, out _)).WithMessage("اختار من وين إجى الطلب.");
        RuleFor(x => x.Status).Must(s => s is "new" or "confirmed").WithMessage("احفظ الطلب «جديد» أو «مؤكد».");
        RuleFor(x => x.DeliveryFee).Must(v => OrderValidation.IsMoneyInput(v, allowZero: true)).WithMessage("رسوم التوصيل لازم تكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.Discount).Must(v => OrderValidation.IsMoneyInput(v, allowZero: true)).WithMessage("الخصم لازم يكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.PaymentMethod).Must(OrderValidation.IsOptionalCode<PaymentMethod>).WithMessage("طريقة الدفع غير معروفة.");
        OrderValidation.Items(this, x => x.Items);
        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());
        OrderValidation.Details(this, x => x.DeliveryAddress, x => x.IsGift, x => x.RecipientName, x => x.GiftMessage, x => x.Note);
        RuleFor(x => x.Payment!).SetValidator(new InitialPaymentRequestValidator()).When(x => x.Payment is not null);
        RuleFor(x => x.ExpectedDeliveryTime).Must(OrderValidation.IsOptionalTime).WithMessage("الوقت لازم يكون مثل 14:30.");
    }
}

public sealed class UpdateOrderRequestValidator : AbstractValidator<UpdateOrderRequest>
{
    public UpdateOrderRequestValidator()
    {
        RuleFor(x => x.Channel).Must(c => c is not null && EnumCode.TryParse<SalesChannel>(c, out _)).WithMessage("اختار من وين إجى الطلب.");
        RuleFor(x => x.DeliveryFee).Must(v => OrderValidation.IsMoneyInput(v, allowZero: true)).WithMessage("رسوم التوصيل لازم تكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.Discount).Must(v => OrderValidation.IsMoneyInput(v, allowZero: true)).WithMessage("الخصم لازم يكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.PaymentMethod).Must(OrderValidation.IsOptionalCode<PaymentMethod>).WithMessage("طريقة الدفع غير معروفة.");
        OrderValidation.Items(this, x => x.Items);
        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());
        OrderValidation.Details(this, x => x.DeliveryAddress, x => x.IsGift, x => x.RecipientName, x => x.GiftMessage, x => x.Note);
        RuleFor(x => x.ExpectedDeliveryTime).Must(OrderValidation.IsOptionalTime).WithMessage("الوقت لازم يكون مثل 14:30.");
    }
}

public sealed class UpdateOrderDetailsRequestValidator : AbstractValidator<UpdateOrderDetailsRequest>
{
    public UpdateOrderDetailsRequestValidator()
    {
        OrderValidation.Details(this, x => x.DeliveryAddress, x => x.IsGift, x => x.RecipientName, x => x.GiftMessage, x => x.Note);
        RuleFor(x => x.ExpectedDeliveryTime).Must(OrderValidation.IsOptionalTime).WithMessage("الوقت لازم يكون مثل 14:30.");
    }
}

public sealed class ReturnOrderRequestValidator : AbstractValidator<ReturnOrderRequest>
{
    public ReturnOrderRequestValidator()
    {
        RuleFor(x => x.Lines).Must(l => l is { Count: > 0 }).WithMessage("اختار قطعة وحدة على الأقل.");
        RuleFor(x => x.Lines).Must(l => l is null || l.Select(x => x.OrderItemId).Distinct().Count() == l.Count).WithMessage("المنتج مكرر بالمرتجع.");
        RuleForEach(x => x.Lines).Must(l => l.Quantity is >= 1 and <= Order.MaxLineQuantity).WithMessage("الكمية لازم تكون 1 أو أكثر.");
        RuleFor(x => x.ReturnedOn).NotEmpty().WithMessage("اختار تاريخ المرتجع.");
        RuleFor(x => x.Reason).MaximumLength(OrderReturn.ReasonMaxLength).WithMessage($"السبب لازم يكون {OrderReturn.ReasonMaxLength} حرف أو أقل.");
        RuleFor(x => x.Refund!.Amount).Must(a => OrderValidation.IsMoneyInput(a, allowZero: true)).When(x => x.Refund is not null).WithMessage("المبلغ لازم يكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.Refund!.Method).Must(m => m is not null && EnumCode.TryParse<PaymentMethod>(m, out _)).When(x => x.Refund is { Amount: > 0 }).WithMessage("اختار طريقة الاسترداد.");
    }
}

public sealed class PreOrderQueryValidator : AbstractValidator<PreOrderQuery>
{
    public PreOrderQueryValidator()
        => RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || (to >= q.From && to.Value.DayNumber - q.From.Value.DayNumber <= 62)).WithMessage("الفترة لازم تكون 62 يوم بالأكثر.");
}

public sealed class ChangeOrderStatusRequestValidator : AbstractValidator<ChangeOrderStatusRequest>
{
    public ChangeOrderStatusRequestValidator()
    {
        RuleFor(x => x.To).Must(s => s is not null && EnumCode.TryParse<OrderStatus>(s, out _)).WithMessage("الحالة غير معروفة.");
        RuleFor(x => x.ExpectedStatus).Must(s => s is not null && EnumCode.TryParse<OrderStatus>(s, out _)).WithMessage("الحالة غير معروفة.");
        RuleFor(x => x.CancelReason).Must(OrderValidation.IsOptionalCode<CancelReason>).WithMessage("اختار سبب الإلغاء من القائمة.");
        RuleFor(x => x.CancelReason).NotEmpty().When(x => x.To == "cancelled").WithMessage("اختار سبب الإلغاء.");
        RuleFor(x => x.CancelNote).NotEmpty().When(x => x.To == "cancelled" && x.CancelReason == "other").WithMessage("اكتب سبب الإلغاء.");
        RuleFor(x => x.CancelNote).MaximumLength(Order.CancelNoteMaxLength).WithMessage($"سبب الإلغاء لازم يكون {Order.CancelNoteMaxLength} حرف أو أقل.");
    }
}

public sealed class UndoOrderStatusRequestValidator : AbstractValidator<UndoOrderStatusRequest>
{
    public UndoOrderStatusRequestValidator()
        => RuleFor(x => x.ChangeId).NotEmpty().WithMessage("ما في تغيير نتراجع عنه.");
}

public sealed class OrderListQueryValidator : AbstractValidator<OrderListQuery>
{
    public OrderListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Status).Must(OrderValidation.IsOptionalCode<OrderStatus>).WithMessage("الحالة غير معروفة.");
        RuleFor(x => x.Sort).Must(s => s is null or "-createdAt" or "createdAt" or "-total").WithMessage("الترتيب غير معروف.");
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل كثير.");
        RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From).WithMessage("تاريخ النهاية قبل تاريخ البداية.");
    }
}
