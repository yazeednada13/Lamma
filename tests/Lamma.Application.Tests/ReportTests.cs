using Lamma.Application.Common;
using Lamma.Application.Dashboard;
using Lamma.Application.Reports;

namespace Lamma.Application.Tests;

public sealed class ReportPeriodTests
{
    private static readonly DateOnly Today = new(2026, 11, 22);

    private static ReportPeriod Resolve(string? period, string? from = null, string? to = null, DateOnly? today = null)
        => ReportPeriod.Resolve(new ReportPeriodQuery { Period = period, From = from is null ? null : DateOnly.Parse(from), To = to is null ? null : DateOnly.Parse(to) }, today ?? Today);

    private static string Span(ReportPeriod p) => $"{p.From:yyyy-MM-dd}..{p.To:yyyy-MM-dd} vs {p.PreviousFrom:yyyy-MM-dd}..{p.PreviousTo:yyyy-MM-dd}";

    [Theory]
    [InlineData(null, "2026-11-22", "2026-11-01..2026-11-22 vs 2026-10-01..2026-10-22")]
    [InlineData("month", "2026-03-31", "2026-03-01..2026-03-31 vs 2026-02-01..2026-02-28")] // capped at February's end
    [InlineData("month", "2028-03-31", "2028-03-01..2028-03-31 vs 2028-02-01..2028-02-29")] // leap year
    [InlineData("last_month", "2026-01-15", "2025-12-01..2025-12-31 vs 2025-11-01..2025-11-30")]
    [InlineData("last_month", "2026-03-10", "2026-02-01..2026-02-28 vs 2026-01-01..2026-01-31")]
    [InlineData("last_7_days", "2026-11-22", "2026-11-16..2026-11-22 vs 2026-11-09..2026-11-15")]
    [InlineData("LAST_7_DAYS", "2026-01-03", "2025-12-28..2026-01-03 vs 2025-12-21..2025-12-27")]
    public void Presets_and_their_comparison_spans(string? period, string today, string expected)
        => Assert.Equal(expected, Span(Resolve(period, today: DateOnly.Parse(today))));

    [Fact]
    public void Custom_range_is_compared_with_the_same_length_just_before()
    {
        var p = Resolve("custom", "2026-11-10", "2026-11-19");
        Assert.Equal("2026-11-10..2026-11-19 vs 2026-10-31..2026-11-09", Span(p));
        Assert.False(p.IncludesToday);
        Assert.Equal("day", p.Bucket);
        Assert.True(Resolve("custom", "2026-11-22", "2026-11-22").IncludesToday); // one day, today
    }

    [Fact]
    public void Bucket_is_daily_up_to_92_days_then_monthly()
    {
        Assert.Equal("day", Resolve("custom", "2026-08-23", "2026-11-22").Bucket); // 92 days
        Assert.Equal("month", Resolve("custom", "2026-08-22", "2026-11-22").Bucket); // 93 days
        Assert.Equal(366, Resolve("custom", "2025-11-22", "2026-11-22").Days); // the maximum
    }

    [Theory]
    [InlineData("week", null, null, "report.invalid_period")]
    [InlineData("custom", null, "2026-11-01", "report.range_required")]
    [InlineData("custom", "2026-11-10", "2026-11-01", "report.range_reversed")]
    [InlineData("custom", "2026-11-10", "2026-11-23", "report.range_future")]
    [InlineData("custom", "2025-11-21", "2026-11-22", "report.range_too_long")] // 367 days
    public void Invalid_input_is_a_field_error(string period, string? from, string? to, string code)
        => Assert.Equal(code, Assert.Throws<RequestValidationException>(() => Resolve(period, from, to)).Code);
}

public sealed class ReportBuilderTests
{
    private static PnlLinesDto Lines(decimal netSales, decimal cogs, decimal expenses)
        => new(netSales, 1, 0m, netSales, cogs, netSales - cogs, expenses, netSales - cogs - expenses);

    private static PnlCategoryDto Cat(string name, decimal current, decimal previous) => new(Guid.NewGuid(), name, null, current, previous);

    [Fact]
    public void Driver_is_the_largest_effect_on_net_profit()
    {
        var d = ReportService.Driver(Lines(100, 40, 30), Lines(90, 40, 10), [Cat("إعلانات", 30, 10)]);
        Assert.Equal(("expense", "إعلانات", 20m, -20m), (d!.Kind, d.CategoryName, d.Change, d.Effect)); // ads +20 beats sales +10
    }

    [Fact]
    public void Driver_ties_go_to_sales_then_cogs()
    {
        Assert.Equal("sales", ReportService.Driver(Lines(110, 50, 0), Lines(100, 40, 0), [])!.Kind); // +10 and −10
        Assert.Equal("cogs", ReportService.Driver(Lines(100, 50, 10), Lines(100, 40, 0), [Cat("إعلانات", 10, 0)])!.Kind);
    }

    [Fact]
    public void No_driver_when_nothing_changed() => Assert.Null(ReportService.Driver(Lines(50, 20, 5), Lines(50, 20, 5), [Cat("إعلانات", 5, 5)]));

    [Fact]
    public void Monthly_buckets_sum_days_and_start_inside_the_span()
    {
        var days = new[]
        {
            new SeriesDayDto(new DateOnly(2026, 1, 30), 5m, 2m),
            new SeriesDayDto(new DateOnly(2026, 1, 31), 1m, 1m),
            new SeriesDayDto(new DateOnly(2026, 2, 1), 7m, 3m),
        };
        var buckets = ReportService.Buckets(days, "month");
        Assert.Equal([(new DateOnly(2026, 1, 30), 6m, 3m), (new DateOnly(2026, 2, 1), 7m, 3m)], buckets.Select(b => (b.Start, b.Sales, b.GrossProfit)));
        Assert.Equal(3, ReportService.Buckets(days, "day").Count);
    }

    [Fact]
    public void Products_after_the_first_50_are_summed_and_aov_handles_no_orders()
    {
        var period = ReportPeriod.Resolve(new ReportPeriodQuery(), new DateOnly(2026, 11, 22));
        var products = Enumerable.Range(1, 53).Select(i => new ProductSalesDto(Guid.NewGuid(), $"P{i:00}", 1, i, i / 2m)).ToList();
        var data = new SalesData([new SeriesDayDto(new DateOnly(2026, 11, 1), 100m, 40m)], [], new decimal[7], products, 0m, 3);
        var empty = new SalesData([], [], new decimal[7], [], 0m, 0);

        var report = ReportService.BuildSales(period, data, empty);
        Assert.Equal(50, report.Products.Count);
        Assert.Equal("P53", report.Products[0].Name); // highest revenue first
        Assert.Equal((3, 3, 6m), (report.OtherProducts!.Count, report.OtherProducts.Quantity, report.OtherProducts.Revenue)); // 1 + 2 + 3
        Assert.Equal((33.333m, 0m, (decimal?)null), (report.AverageOrderValue, report.PreviousAverageOrderValue, report.AverageOrderValueChange));
        Assert.Null(report.BestWeekday);
    }
}
