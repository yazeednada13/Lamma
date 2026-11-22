using Lamma.Application.Dashboard;

namespace Lamma.Application.Tests;

public sealed class DashboardPeriodTests
{
    [Theory]
    [InlineData("2026-11-22", "2026-10-01", "2026-10-22")]
    [InlineData("2026-03-31", "2026-02-01", "2026-02-28")] // capped at the end of a short month
    [InlineData("2026-01-15", "2025-12-01", "2025-12-15")]
    public void Previous_span_is_the_same_days_of_last_month(string today, string from, string to)
        => Assert.Equal((DateOnly.Parse(from), DateOnly.Parse(to)), DashboardService.PreviousSpan(DateOnly.Parse(today)));

    [Theory]
    [InlineData(15, 13, 15.4)]
    [InlineData(10, 20, -50.0)]
    [InlineData(-5, 10, -150.0)]
    [InlineData(5, -10, 150.0)] // from a loss to a profit is an improvement
    public void Change_is_a_one_decimal_percent(decimal current, decimal previous, double expected)
        => Assert.Equal((decimal)expected, DashboardService.Change(current, previous));

    [Fact]
    public void No_change_without_an_earlier_figure() => Assert.Null(DashboardService.Change(12m, 0m));
}
