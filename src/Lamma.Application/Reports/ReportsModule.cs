using System.Text.Json.Serialization;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Dashboard;
using Lamma.Application.Finance;
using Lamma.Domain.Common;

namespace Lamma.Application.Reports;

// ---------- Period (D-168) ----------

/// <summary>Query string of every report: <c>period=month|last_month|last_7_days|custom</c>, plus <c>from</c>/<c>to</c> for custom.</summary>
public sealed class ReportPeriodQuery
{
    public string? Period { get; set; }

    public DateOnly? From { get; set; }

    public DateOnly? To { get; set; }
}

/// <summary>A resolved report period and its comparison span (D-168). <c>Bucket</c>: day (≤ 92 days) or month (D-171).</summary>
public sealed record ReportPeriod(string Code, DateOnly From, DateOnly To, DateOnly PreviousFrom, DateOnly PreviousTo, bool IncludesToday)
{
    public const string Month = "month";
    public const string LastMonth = "last_month";
    public const string Last7Days = "last_7_days";
    public const string Custom = "custom";
    public const int MaxDays = 366;
    public const int MaxDailyBuckets = 92;

    public int Days => To.DayNumber - From.DayNumber + 1;

    public string Bucket => Days <= MaxDailyBuckets ? "day" : "month";

    /// <summary>Resolves a preset or a custom range in the business calendar; invalid input is a 422 with a field error.</summary>
    public static ReportPeriod Resolve(ReportPeriodQuery query, DateOnly today)
    {
        var code = string.IsNullOrWhiteSpace(query.Period) ? Month : query.Period.Trim().ToLowerInvariant();
        switch (code)
        {
            case Month:
            {
                var (prevFrom, prevTo) = DashboardService.PreviousSpan(today); // the same days of last month (D-153)
                return new ReportPeriod(code, new DateOnly(today.Year, today.Month, 1), today, prevFrom, prevTo, true);
            }

            case LastMonth:
            {
                var first = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
                var before = first.AddMonths(-1);
                return new ReportPeriod(code, first, first.AddMonths(1).AddDays(-1), before, first.AddDays(-1), false);
            }

            case Last7Days:
                return new ReportPeriod(code, today.AddDays(-6), today, today.AddDays(-13), today.AddDays(-7), true);

            case Custom:
            {
                if (query.From is not { } from || query.To is not { } to)
                {
                    throw RequestValidationException.ForField(query.From is null ? "from" : "to", "اختار تاريخ البداية والنهاية.", "report.range_required");
                }

                if (to < from)
                {
                    throw RequestValidationException.ForField("to", "تاريخ النهاية قبل تاريخ البداية.", "report.range_reversed");
                }

                if (to > today)
                {
                    throw RequestValidationException.ForField("to", "ما بنقدر نعرض تقرير لأيام لسا ما إجت.", "report.range_future");
                }

                var days = to.DayNumber - from.DayNumber + 1;
                if (days > MaxDays)
                {
                    throw RequestValidationException.ForField("from", "أطول فترة للتقرير سنة وحدة.", "report.range_too_long");
                }

                return new ReportPeriod(code, from, to, from.AddDays(-days), from.AddDays(-1), to == today);
            }

            default:
                throw RequestValidationException.ForField("period", "الفترة مش معروفة.", "report.invalid_period");
        }
    }

    public ReportPeriodDto ToDto() => new(Code, From, To, PreviousFrom, PreviousTo, IncludesToday, Bucket);
}

public sealed record ReportPeriodDto(string Period, DateOnly From, DateOnly To, DateOnly PreviousFrom, DateOnly PreviousTo, bool IncludesToday, string Bucket);

// ---------- P&L (D-169, D-170) ----------

public sealed record PnlLinesDto(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Sales,
    int DeliveredCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Returns,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetSales,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cogs,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Expenses,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetProfit);

/// <summary>% changes (1 decimal), null when the previous figure is 0 (D-170).</summary>
public sealed record PnlChangesDto(decimal? Sales, decimal? Cogs, decimal? Expenses, decimal? NetProfit);

public sealed record PnlCategoryDto(
    Guid CategoryId,
    string Name,
    string? Code,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Current,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Previous);

/// <summary>
/// The largest driver of the change in net profit (D-170). <c>Kind</c>: sales (net sales) | cogs | expense (with the
/// category). <c>Change</c> is the item's own change (current − previous); <c>Effect</c> is its effect on net profit
/// (+ for sales, − for costs). The UI writes the Arabic sentence from these fields.
/// </summary>
public sealed record PnlDriverDto(
    string Kind,
    string? CategoryName,
    string? CategoryCode,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Change,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Effect);

public sealed record PnlReportDto(
    ReportPeriodDto Period,
    PnlLinesDto Current,
    PnlLinesDto Previous,
    bool HasPrevious,
    PnlChangesDto Changes,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetProfitChange,
    PnlDriverDto? Driver,
    IReadOnlyList<PnlCategoryDto> ExpensesByCategory,
    /// <summary>Confirmed, preparing and with-courier orders; only when the period includes today (D-169).</summary>
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? ExpectedSales);

// ---------- Sales (D-171) ----------

public sealed record SalesBucketDto(
    DateOnly Start,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Sales,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit);

public sealed record ChannelSalesDto(string Channel, [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount, int Orders);

public sealed record ProductSalesDto(
    Guid ProductId,
    string Name,
    int Quantity,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Revenue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit);

/// <summary>Everything after the first <see cref="ReportService.ProductRows"/> products, summed («باقي المنتجات»).</summary>
public sealed record OtherProductsDto(
    int Count,
    int Quantity,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Revenue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit);

public sealed record SalesReportDto(
    ReportPeriodDto Period,
    IReadOnlyList<SalesBucketDto> Series,
    IReadOnlyList<ChannelSalesDto> Channels,
    /// <summary>Net sales per weekday, index 0 = Sunday … 6 = Saturday.</summary>
    [property: JsonConverter(typeof(MoneyListJsonConverter))] IReadOnlyList<decimal> Weekdays,
    int? BestWeekday,
    IReadOnlyList<ProductSalesDto> Products,
    OtherProductsDto? OtherProducts,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal DeliveryFees,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetSales,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit,
    int Orders,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal AverageOrderValue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal PreviousNetSales,
    int PreviousOrders,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal PreviousAverageOrderValue,
    decimal? NetSalesChange,
    decimal? OrdersChange,
    decimal? AverageOrderValueChange);

/// <summary>Raw sales figures of one span, read in SQL by Infrastructure (D-171). Daily rows cover every day of the span.</summary>
public sealed record SalesData(
    IReadOnlyList<SeriesDayDto> Days,
    IReadOnlyList<ChannelSalesDto> Channels,
    IReadOnlyList<decimal> Weekdays,
    IReadOnlyList<ProductSalesDto> Products,
    decimal DeliveryFees,
    int Orders);

// ---------- Hub (D-172) ----------

public sealed record SummaryCustomerDto(Guid Id, string Name);

public sealed record ReportsSummaryDto(
    DateOnly From,
    DateOnly To,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetProfit,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetSales,
    IReadOnlyList<SeriesDayDto> Series,
    IReadOnlyList<ProductSalesDto> TopProducts,
    int Customers,
    IReadOnlyList<SummaryCustomerDto> RecentCustomers,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal StockValue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CourierHeld);

/// <summary>Non-financial hub figures read by Infrastructure.</summary>
public sealed record SummaryData(int Customers, IReadOnlyList<SummaryCustomerDto> RecentCustomers, decimal StockValue);

// ---------- Ports ----------

public interface IReportQueries
{
    /// <summary>Sales of [from, to] net of the returns recorded in it (D-171).</summary>
    Task<SalesData> SalesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);

    Task<SummaryData> SummaryAsync(CancellationToken cancellationToken);
}

// ---------- Services ----------

public interface IReportService
{
    Task<ReportsSummaryDto> SummaryAsync(CancellationToken cancellationToken);

    Task<PnlReportDto> PnlAsync(ReportPeriodQuery query, CancellationToken cancellationToken);

    Task<SalesReportDto> SalesAsync(ReportPeriodQuery query, CancellationToken cancellationToken);
}

/// <summary>
/// Reports (Phase 10, D-168–D-172). Money lines come from the finance overview (D-144, D-149), so the P&amp;L, the
/// finance page and the dashboard always agree.
/// </summary>
internal sealed class ReportService(IReportQueries queries, IFinanceQueries finance, IClock clock) : IReportService
{
    public const int ProductRows = 50;
    public const int SummaryDays = 14;
    public const int SummaryProducts = 6;

    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    private DateOnly Today => BusinessTime.LocalDate(clock.UtcNow, Zone);

    public async Task<ReportsSummaryDto> SummaryAsync(CancellationToken cancellationToken)
    {
        var today = Today;
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var overview = await finance.OverviewAsync(monthStart, today, today, cancellationToken);
        var month = await queries.SalesAsync(monthStart, today, cancellationToken);
        var series = monthStart > today.AddDays(-(SummaryDays - 1))
            ? (await queries.SalesAsync(today.AddDays(-(SummaryDays - 1)), today, cancellationToken)).Days
            : month.Days.TakeLast(SummaryDays).ToList();
        var data = await queries.SummaryAsync(cancellationToken);
        return new ReportsSummaryDto(
            monthStart,
            today,
            overview.NetProfit,
            overview.NetSales,
            series,
            Rank(month.Products).Take(SummaryProducts).ToList(),
            data.Customers,
            data.RecentCustomers,
            data.StockValue,
            overview.CourierHeld);
    }

    public async Task<PnlReportDto> PnlAsync(ReportPeriodQuery query, CancellationToken cancellationToken)
    {
        var today = Today;
        var period = ReportPeriod.Resolve(query, today);
        var current = await finance.OverviewAsync(period.From, period.To, today, cancellationToken, withSnapshot: period.IncludesToday);
        var previous = await finance.OverviewAsync(period.PreviousFrom, period.PreviousTo, today, cancellationToken, withSnapshot: false);
        return BuildPnl(period, current, previous);
    }

    public async Task<SalesReportDto> SalesAsync(ReportPeriodQuery query, CancellationToken cancellationToken)
    {
        var period = ReportPeriod.Resolve(query, Today);
        var current = await queries.SalesAsync(period.From, period.To, cancellationToken);
        var previous = await queries.SalesAsync(period.PreviousFrom, period.PreviousTo, cancellationToken);
        return BuildSales(period, current, previous);
    }

    /// <summary>P&amp;L from two finance overviews: lines, % changes and the D-170 driver.</summary>
    public static PnlReportDto BuildPnl(ReportPeriod period, FinanceOverviewDto current, FinanceOverviewDto previous)
    {
        var cur = Lines(current);
        var prev = Lines(previous);
        var hasPrevious = prev.Sales != 0 || prev.Returns != 0 || prev.Cogs != 0 || prev.Expenses != 0;

        var categories = current.ExpensesByCategory.Select(c => c.CategoryId)
            .Union(previous.ExpensesByCategory.Select(c => c.CategoryId))
            .Select(id =>
            {
                var c = current.ExpensesByCategory.FirstOrDefault(x => x.CategoryId == id);
                var p = previous.ExpensesByCategory.FirstOrDefault(x => x.CategoryId == id);
                var any = c ?? p!;
                return new PnlCategoryDto(id, any.Name, any.Code, c?.Amount ?? 0m, p?.Amount ?? 0m);
            })
            .OrderByDescending(c => c.Current).ThenByDescending(c => c.Previous).ThenBy(c => c.Name, StringComparer.Ordinal)
            .ToList();

        return new PnlReportDto(
            period.ToDto(),
            cur,
            prev,
            hasPrevious,
            new PnlChangesDto(
                DashboardService.Change(cur.NetSales, prev.NetSales),
                DashboardService.Change(cur.Cogs, prev.Cogs),
                DashboardService.Change(cur.Expenses, prev.Expenses),
                DashboardService.Change(cur.NetProfit, prev.NetProfit)),
            cur.NetProfit - prev.NetProfit,
            hasPrevious ? Driver(cur, prev, categories) : null,
            categories,
            period.IncludesToday ? current.ExpectedSales : null);
    }

    /// <summary>
    /// D-170: the item with the largest absolute effect on net profit among net sales, COGS and each expense category.
    /// Ties go to sales, then COGS, then the category list order. Null when nothing changed.
    /// </summary>
    public static PnlDriverDto? Driver(PnlLinesDto current, PnlLinesDto previous, IReadOnlyList<PnlCategoryDto> categories)
    {
        var candidates = new List<PnlDriverDto>
        {
            new("sales", null, null, current.NetSales - previous.NetSales, current.NetSales - previous.NetSales),
            new("cogs", null, null, current.Cogs - previous.Cogs, -(current.Cogs - previous.Cogs)),
        };
        candidates.AddRange(categories.Select(c => new PnlDriverDto("expense", c.Name, c.Code, c.Current - c.Previous, -(c.Current - c.Previous))));

        PnlDriverDto? best = null;
        foreach (var candidate in candidates) // stable: the first of equal effects wins
        {
            if (candidate.Effect != 0 && (best is null || Math.Abs(candidate.Effect) > Math.Abs(best.Effect)))
            {
                best = candidate;
            }
        }

        return best;
    }

    /// <summary>Sales report from two spans: buckets, ranking with «باقي المنتجات», AOV and changes (D-171).</summary>
    public static SalesReportDto BuildSales(ReportPeriod period, SalesData current, SalesData previous)
    {
        var netSales = current.Days.Sum(d => d.Sales);
        var gross = current.Days.Sum(d => d.GrossProfit);
        var prevNet = previous.Days.Sum(d => d.Sales);
        var aov = Aov(netSales, current.Orders);
        var prevAov = Aov(prevNet, previous.Orders);
        var ranked = Rank(current.Products).ToList();
        var rest = ranked.Skip(ProductRows).ToList();
        var bestWeekday = current.Weekdays.Any(w => w > 0) ? current.Weekdays.Select((v, i) => (v, i)).OrderByDescending(x => x.v).ThenBy(x => x.i).First().i : (int?)null;

        return new SalesReportDto(
            period.ToDto(),
            Buckets(current.Days, period.Bucket),
            current.Channels.OrderByDescending(c => c.Amount).ThenBy(c => c.Channel, StringComparer.Ordinal).ToList(),
            current.Weekdays,
            bestWeekday,
            ranked.Take(ProductRows).ToList(),
            rest.Count == 0 ? null : new OtherProductsDto(rest.Count, rest.Sum(p => p.Quantity), rest.Sum(p => p.Revenue), rest.Sum(p => p.GrossProfit)),
            current.DeliveryFees,
            netSales,
            gross,
            current.Orders,
            aov,
            prevNet,
            previous.Orders,
            prevAov,
            DashboardService.Change(netSales, prevNet),
            DashboardService.Change(current.Orders, previous.Orders),
            DashboardService.Change(aov, prevAov));
    }

    /// <summary>Daily rows as they are, or summed per calendar month (each bucket starts on its first day in the span).</summary>
    public static IReadOnlyList<SalesBucketDto> Buckets(IReadOnlyList<SeriesDayDto> days, string bucket)
        => bucket == "day"
            ? days.Select(d => new SalesBucketDto(d.Day, d.Sales, d.GrossProfit)).ToList()
            : days.GroupBy(d => (d.Day.Year, d.Day.Month))
                .Select(g => new SalesBucketDto(g.Min(d => d.Day), g.Sum(d => d.Sales), g.Sum(d => d.GrossProfit)))
                .OrderBy(b => b.Start)
                .ToList();

    public static decimal Aov(decimal netSales, int orders) => orders == 0 ? 0m : MoneyMath.Round(netSales / orders);

    private static IEnumerable<ProductSalesDto> Rank(IEnumerable<ProductSalesDto> products)
        => products.OrderByDescending(p => p.Revenue).ThenByDescending(p => p.Quantity).ThenBy(p => p.Name, StringComparer.Ordinal);

    private static PnlLinesDto Lines(FinanceOverviewDto o)
        => new(o.Sales, o.DeliveredCount, o.Returns, o.NetSales, o.Cogs, o.GrossProfit, o.Expenses, o.NetProfit);
}
