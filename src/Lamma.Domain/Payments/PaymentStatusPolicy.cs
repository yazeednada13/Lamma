using Lamma.Domain.Businesses;
using Lamma.Domain.Orders;

namespace Lamma.Domain.Payments;

/// <summary>Order payment statuses (D-021). Always derived, never stored (D-133).</summary>
public enum PaymentStatus
{
    Paid,
    Partial,
    Unpaid,
    Courier,
}

/// <summary>Receivables aging buckets (D-038): fresh 0–7 days, late 8–30, overdue over 30.</summary>
public enum AgingBucket
{
    Fresh,
    Late,
    Overdue,
}

/// <summary>Derives payment status, courier-held and receivable state from an order's figures (D-133, D-134).</summary>
public static class PaymentStatusPolicy
{
    public const int FreshMaxDays = 7;
    public const int LateMaxDays = 30;

    /// <summary>Null for a cancelled order (no payment status). First match wins: paid, courier, partial, unpaid.</summary>
    public static PaymentStatus? For(OrderStatus status, PaymentMethod? expectedMethod, decimal total, decimal paid)
    {
        if (status == OrderStatus.Cancelled)
        {
            return null;
        }

        var remaining = total - paid;
        if (remaining <= 0)
        {
            return PaymentStatus.Paid;
        }

        if (IsCourierHeld(status, expectedMethod, remaining))
        {
            return PaymentStatus.Courier;
        }

        return paid > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid;
    }

    /// <summary>COD money the courier collects or holds: COD, with the courier or delivered, something still due (D-133).</summary>
    public static bool IsCourierHeld(OrderStatus status, PaymentMethod? expectedMethod, decimal remaining)
        => expectedMethod == PaymentMethod.Cod && status is OrderStatus.Courier or OrderStatus.Delivered or OrderStatus.Returned && remaining > 0;

    /// <summary>A customer receivable: delivered, something still due, not courier-held (D-134).</summary>
    public static bool IsReceivable(OrderStatus status, PaymentMethod? expectedMethod, decimal remaining)
        => status is OrderStatus.Delivered or OrderStatus.Returned && remaining > 0 && !IsCourierHeld(status, expectedMethod, remaining);

    /// <summary>
    /// Order statuses that accept a payment or deposit (D-135, D-137). A returned order may still owe its delivery fee
    /// (D-148), so only cancelled orders refuse payments.
    /// </summary>
    public static bool CanReceivePayment(OrderStatus status) => status != OrderStatus.Cancelled;

    public static AgingBucket BucketOf(int ageDays) => ageDays switch
    {
        <= FreshMaxDays => AgingBucket.Fresh,
        <= LateMaxDays => AgingBucket.Late,
        _ => AgingBucket.Overdue,
    };

    /// <summary>Age in days = business today − business-local delivery date (never negative).</summary>
    public static int AgeDays(DateOnly deliveredOn, DateOnly today) => Math.Max(0, today.DayNumber - deliveredOn.DayNumber);
}
