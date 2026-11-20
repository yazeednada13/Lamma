namespace Lamma.Domain.Customers;

/// <summary>Automatic customer segments (D-114, D-115). Codes: vip, owes, new, dormant.</summary>
public enum CustomerSegment
{
    Vip,
    Owes,
    New,
    Dormant,
}

/// <summary>Figures derived from orders and payments (D-033): never stored on the customer.</summary>
public sealed class CustomerStats
{
    public static readonly CustomerStats None = new(0, 0m, 0m, null);

    public CustomerStats(int orderCount, decimal totalSpent, decimal balanceDue, DateOnly? lastOrderOn)
    {
        OrderCount = orderCount;
        TotalSpent = totalSpent;
        BalanceDue = balanceDue;
        LastOrderOn = lastOrderOn;
    }

    /// <summary>Non-cancelled orders (returned ones still count).</summary>
    public int OrderCount { get; }

    public decimal TotalSpent { get; }

    public decimal BalanceDue { get; }

    /// <summary>Local date (business time zone) of the latest non-cancelled order.</summary>
    public DateOnly? LastOrderOn { get; }
}

/// <summary>The single place for segment rules (D-114, D-115). A customer can be in several segments.</summary>
public static class CustomerSegmentPolicy
{
    public const int NewMaxOrders = 2;
    public const int DormantAfterDays = 14;
    public const decimal VipShare = 0.34m;

    /// <summary>
    /// Spend of the customer at rank ⌈n × 0.34⌉ among all customers sorted by spend (the prototype rule), or null when
    /// nobody has spent yet. A customer is VIP when their spend is &gt; 0 and ≥ the cut-off.
    /// </summary>
    public static decimal? VipCutoff(IEnumerable<decimal> spentPerCustomer)
    {
        var sorted = spentPerCustomer.OrderByDescending(s => s).ToList();
        if (sorted.Count == 0 || sorted[0] <= 0)
        {
            return null;
        }

        var rank = (int)Math.Ceiling(sorted.Count * VipShare);
        return sorted[Math.Clamp(rank, 1, sorted.Count) - 1];
    }

    public static IReadOnlyList<CustomerSegment> For(CustomerStats stats, DateOnly today, decimal? vipCutoff)
    {
        var segments = new List<CustomerSegment>();
        if (vipCutoff is { } cutoff && stats.TotalSpent > 0 && stats.TotalSpent >= cutoff)
        {
            segments.Add(CustomerSegment.Vip);
        }

        if (stats.BalanceDue > 0)
        {
            segments.Add(CustomerSegment.Owes);
        }

        if (stats.OrderCount <= NewMaxOrders)
        {
            segments.Add(CustomerSegment.New);
        }

        if (IsDormant(stats.LastOrderOn, today))
        {
            segments.Add(CustomerSegment.Dormant);
        }

        return segments;
    }

    /// <summary>Has ordered, and the last order was more than 14 days ago; never ordered is not dormant.</summary>
    public static bool IsDormant(DateOnly? lastOrderOn, DateOnly today)
        => lastOrderOn is { } last && today.DayNumber - last.DayNumber > DormantAfterDays;
}
