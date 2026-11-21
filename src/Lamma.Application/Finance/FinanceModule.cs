using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Domain.Common;

namespace Lamma.Application.Finance;

// ---------- Contracts (API-DESIGN §17) ----------

public sealed class FinanceOverviewQuery
{
    /// <summary>Defaults to the first day of the business month.</summary>
    public DateOnly? From { get; set; }

    /// <summary>Defaults to business today.</summary>
    public DateOnly? To { get; set; }
}

public sealed record ExpenseShareDto(
    Guid CategoryId,
    string Name,
    string? Code,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount);

/// <summary>
/// Finance overview (D-144). Period figures: sales (orders delivered in the period, D-030), COGS, gross, expenses,
/// net, cash received, cash out, cash flow. Snapshot figures (now): customer dues, courier-held, expected sales.
/// </summary>
public sealed record FinanceOverviewDto(
    DateOnly From,
    DateOnly To,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Sales,
    int DeliveredCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cogs,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal GrossProfit,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Expenses,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NetProfit,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CashReceived,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CashOut,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CashFlow,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CustomerDues,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal CourierHeld,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ExpectedSales,
    IReadOnlyList<ExpenseShareDto> ExpensesByCategory);

public sealed class FinanceOverviewQueryValidator : AbstractValidator<FinanceOverviewQuery>
{
    public FinanceOverviewQueryValidator()
        => RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From).WithMessage("تاريخ النهاية قبل تاريخ البداية.");
}

public interface IFinanceQueries
{
    Task<FinanceOverviewDto> OverviewAsync(DateOnly from, DateOnly to, DateOnly today, CancellationToken cancellationToken);
}

public interface IFinanceService
{
    Task<FinanceOverviewDto> OverviewAsync(FinanceOverviewQuery query, CancellationToken cancellationToken);
}

internal sealed class FinanceService(IFinanceQueries queries, IClock clock) : IFinanceService
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public Task<FinanceOverviewDto> OverviewAsync(FinanceOverviewQuery query, CancellationToken cancellationToken)
    {
        var today = BusinessTime.LocalDate(clock.UtcNow, Zone);
        return queries.OverviewAsync(query.From ?? new DateOnly(today.Year, today.Month, 1), query.To ?? today, today, cancellationToken);
    }
}
