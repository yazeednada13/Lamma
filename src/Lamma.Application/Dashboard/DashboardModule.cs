using System.Text.Json.Serialization;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Finance;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Application.Dashboard;

// ---------- Contracts (API-DESIGN §19) ----------

/// <summary>Month to date and the same days of last month (D-153); <c>Change</c> is a % (1 decimal), null without an earlier figure.</summary>
public sealed record PeriodFigure(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Current,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Previous,
    decimal? Change);

/// <summary>The journey (D-154): open orders by stage now, plus products, delivered this month and active customers.</summary>
public sealed record JourneyDto(int Products, int LowStock, int NewOrders, int Preparing, int Courier, int DeliveredThisMonth, int ActiveCustomers);

public sealed record SeriesDayDto(
    DateOnly Day,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Sales,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit);

/// <summary>
/// One «يحتاج انتباهك» item (D-157). <c>Kind</c>: prepare | confirm | low_stock | courier | due. The UI writes the
/// sentence from the fields; <c>Priority</c>: high | mid | low.
/// </summary>
public sealed record AttentionDto(
    string Kind,
    string Priority,
    int? Count,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? Amount,
    Guid? RefId,
    string? Name,
    int? OrderNumber,
    DateTime? Since,
    int? Available,
    int? Threshold);

public sealed record ChannelShareDto(string Channel, [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount);

public sealed record TopProductDto(Guid ProductId, string Name, int Quantity, [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Revenue);

public sealed record LatestOrderDto(Guid Id, int Number, string CustomerName, string Status, [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total, DateTime CreatedAt);

/// <summary>
/// A recent event. <c>Kind</c>: order (Number, Name = customer, Amount) | movement (Type, Name = product, Quantity,
/// Label) | expense (Name = category, Label = note, Amount).
/// </summary>
public sealed record ActivityDto(
    string Kind,
    DateTime At,
    string? Name,
    int? Number,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? Amount,
    string? Type,
    int? Quantity,
    string? Label);

/// <summary>Data for the rule-based «ملاحظة لمّة» sentence (D-157). <c>BestWeekday</c>: 0 = Sunday … 6 = Saturday.</summary>
public sealed record InsightDto(string? TopChannel, int? TopChannelShare, string? TopProduct, int? BestWeekday);

public sealed record DashboardDto(
    DateOnly Today,
    DateOnly MonthStart,
    PeriodFigure NetProfit,
    PeriodFigure Sales,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CashReceived,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Receivables,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CourierHeld,
    int OpenOrders,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal OpenValue,
    JourneyDto Journey,
    IReadOnlyList<SeriesDayDto> Series,
    IReadOnlyList<AttentionDto> Attention,
    IReadOnlyList<ChannelShareDto> Channels,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<LatestOrderDto> LatestOrders,
    IReadOnlyList<ActivityDto> Activity,
    InsightDto Insight,
    int TrialDaysLeft,
    bool IsEmpty);

/// <summary>Sidebar counters (D-158).</summary>
public sealed record DashboardIndicatorsDto(int NewOrders, int LowStock, bool HasDues);

/// <summary>The non-financial part of the dashboard, read in SQL by Infrastructure.</summary>
public sealed record DashboardActivityData(
    JourneyDto Journey,
    int OpenOrders,
    decimal OpenValue,
    IReadOnlyList<SeriesDayDto> Series,
    IReadOnlyList<AttentionDto> Attention,
    IReadOnlyList<ChannelShareDto> Channels,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<LatestOrderDto> LatestOrders,
    IReadOnlyList<ActivityDto> Activity,
    InsightDto Insight,
    bool IsEmpty);

// ---------- Ports ----------

public interface IDashboardQueries
{
    /// <param name="monthStart">First business-local day of this month.</param>
    /// <param name="seriesFrom">First day of the 14-day series.</param>
    Task<DashboardActivityData> ActivityAsync(DateOnly today, DateOnly monthStart, DateOnly seriesFrom, CancellationToken cancellationToken);

    Task<DashboardIndicatorsDto> IndicatorsAsync(CancellationToken cancellationToken);

    Task<DateTime?> TrialEndsAtAsync(CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(CancellationToken cancellationToken);

    Task<DashboardIndicatorsDto> IndicatorsAsync(CancellationToken cancellationToken);
}

/// <summary>
/// «لمّة اليوم» (Phase 9, D-153–D-158). Money figures come from the finance overview (D-144, D-149), so the dashboard
/// and the finance pages never disagree; the previous span is the same days of last month (D-153).
/// </summary>
internal sealed class DashboardService(IDashboardQueries queries, IFinanceQueries finance, IClock clock) : IDashboardService
{
    public const int SeriesDays = 14;

    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<DashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var today = BusinessTime.LocalDate(now, Zone);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var (prevFrom, prevTo) = PreviousSpan(today);

        var current = await finance.OverviewAsync(monthStart, today, today, cancellationToken);
        var previous = await finance.OverviewAsync(prevFrom, prevTo, today, cancellationToken, withSnapshot: false); // only its period figures are compared
        var data = await queries.ActivityAsync(today, monthStart, today.AddDays(-(SeriesDays - 1)), cancellationToken);
        var trialEnds = await queries.TrialEndsAtAsync(cancellationToken);

        return new DashboardDto(
            today,
            monthStart,
            Figure(current.NetProfit, previous.NetProfit),
            Figure(current.NetSales, previous.NetSales),
            current.GrossProfit,
            current.CashReceived,
            current.CustomerDues,
            current.CourierHeld,
            data.OpenOrders,
            data.OpenValue,
            data.Journey,
            data.Series,
            data.Attention,
            data.Channels,
            data.TopProducts,
            data.LatestOrders,
            data.Activity,
            data.Insight,
            trialEnds is { } ends ? Business.TrialDaysRemaining(ends, now, Zone) : 0,
            data.IsEmpty);
    }

    public Task<DashboardIndicatorsDto> IndicatorsAsync(CancellationToken cancellationToken) => queries.IndicatorsAsync(cancellationToken);

    /// <summary>The same days of last month (D-153): 1 … today's day, capped at last month's end (e.g. 31 March → 1–28/29 February).</summary>
    public static (DateOnly From, DateOnly To) PreviousSpan(DateOnly today)
    {
        var prevStart = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var prevEnd = prevStart.AddMonths(1).AddDays(-1);
        var to = prevStart.AddDays(today.Day - 1);
        return (prevStart, to > prevEnd ? prevEnd : to);
    }

    /// <summary>% change rounded to 1 decimal; null when there is no earlier figure to compare with (D-153).</summary>
    public static decimal? Change(decimal current, decimal previous)
        => previous == 0 ? null : Math.Round((current - previous) / Math.Abs(previous) * 100m, 1, MidpointRounding.AwayFromZero);

    private static PeriodFigure Figure(decimal current, decimal previous) => new(current, previous, Change(current, previous));
}
