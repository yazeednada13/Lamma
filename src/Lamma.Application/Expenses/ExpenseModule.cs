using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Orders;
using Lamma.Domain.Common;
using Lamma.Domain.Expenses;

namespace Lamma.Application.Expenses;

// ---------- Contracts (API-DESIGN §17) ----------

public sealed record ExpenseCategoryRequest(string Name);

public sealed record ExpenseCategoryDto(Guid Id, string Name, string? Code, bool IsSystem, bool IsArchived);

/// <summary>Records a manual expense (D-143). Requires an Idempotency-Key.</summary>
public sealed record RecordExpenseRequest(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    Guid CategoryId,
    DateOnly SpentOn,
    string? Note);

public sealed record VoidExpenseRequest(string? Reason);

public sealed class ExpenseListQuery
{
    public DateOnly? From { get; set; }

    public DateOnly? To { get; set; }

    public Guid? CategoryId { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

public sealed class ExpenseSummaryQuery
{
    /// <summary>Defaults to the first day of the business month.</summary>
    public DateOnly? From { get; set; }

    /// <summary>Defaults to business today.</summary>
    public DateOnly? To { get; set; }
}

public sealed record ExpenseDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string? CategoryCode,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    DateOnly SpentOn,
    string? Note,
    string Source,
    Guid? SettlementId,
    DateTime RecordedAt,
    bool IsVoided,
    DateTime? VoidedAt,
    string? VoidReason);

public sealed record ExpenseCategoryTotalDto(
    Guid CategoryId,
    string Name,
    string? Code,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    int Count);

/// <summary>Active expenses of the period by category, biggest first, and the category used last (to preselect).</summary>
public sealed record ExpenseSummaryDto(
    DateOnly From,
    DateOnly To,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    int Count,
    IReadOnlyList<ExpenseCategoryTotalDto> ByCategory,
    Guid? LastCategoryId);

// ---------- Validators ----------

public sealed class ExpenseCategoryRequestValidator : AbstractValidator<ExpenseCategoryRequest>
{
    public ExpenseCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("اكتب اسم التصنيف.");
        RuleFor(x => x.Name).MaximumLength(ExpenseCategory.NameMaxLength).WithMessage($"اسم التصنيف لازم يكون {ExpenseCategory.NameMaxLength} حرف أو أقل.");
    }
}

public sealed class RecordExpenseRequestValidator : AbstractValidator<RecordExpenseRequest>
{
    public RecordExpenseRequestValidator()
    {
        RuleFor(x => x.Amount).Must(a => OrderValidation.IsMoneyInput(a, allowZero: false)).WithMessage("المبلغ لازم يكون أكبر من صفر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("اختار التصنيف.");
        RuleFor(x => x.SpentOn).NotEmpty().WithMessage("اختار التاريخ.");
        RuleFor(x => x.Note).MaximumLength(Expense.NoteMaxLength).WithMessage($"الملاحظة لازم تكون {Expense.NoteMaxLength} حرف أو أقل.");
    }
}

public sealed class VoidExpenseRequestValidator : AbstractValidator<VoidExpenseRequest>
{
    public VoidExpenseRequestValidator()
        => RuleFor(x => x.Reason).MaximumLength(Expense.NoteMaxLength).WithMessage($"السبب لازم يكون {Expense.NoteMaxLength} حرف أو أقل.");
}

public sealed class ExpenseListQueryValidator : AbstractValidator<ExpenseListQuery>
{
    public ExpenseListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From).WithMessage("تاريخ النهاية قبل تاريخ البداية.");
    }
}

public sealed class ExpenseSummaryQueryValidator : AbstractValidator<ExpenseSummaryQuery>
{
    public ExpenseSummaryQueryValidator()
        => RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From).WithMessage("تاريخ النهاية قبل تاريخ البداية.");
}

// ---------- Ports ----------

public interface IExpenseCategoryRepository
{
    /// <summary>Creates the missing default categories of the current business (D-142), safely under concurrency.</summary>
    Task EnsureDefaultsAsync(DateTime nowUtc, CancellationToken cancellationToken);

    Task<ExpenseCategory?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The «توصيل» category (call after <see cref="EnsureDefaultsAsync"/>).</summary>
    Task<Guid> DeliveryIdAsync(CancellationToken cancellationToken);

    Task<int> CountCustomAsync(CancellationToken cancellationToken);

    void Add(ExpenseCategory category);
}

public interface IExpenseRepository
{
    Task<Expense?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    Task<Expense?> BySettlementForUpdateAsync(Guid settlementId, CancellationToken cancellationToken);

    void Add(Expense expense);
}

public interface IExpenseQueries
{
    Task<IReadOnlyList<ExpenseCategoryDto>> CategoriesAsync(bool includeArchived, CancellationToken cancellationToken);

    Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListQuery query, CancellationToken cancellationToken);

    Task<ExpenseDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<ExpenseSummaryDto> SummaryAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface IExpenseService
{
    Task<IReadOnlyList<ExpenseCategoryDto>> CategoriesAsync(bool includeArchived, CancellationToken cancellationToken);

    Task<ExpenseCategoryDto> CreateCategoryAsync(ExpenseCategoryRequest request, CancellationToken cancellationToken);

    Task<ExpenseCategoryDto> RenameCategoryAsync(Guid id, ExpenseCategoryRequest request, CancellationToken cancellationToken);

    Task<ExpenseCategoryDto> SetCategoryArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken);

    Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListQuery query, CancellationToken cancellationToken);

    Task<ExpenseSummaryDto> SummaryAsync(ExpenseSummaryQuery query, CancellationToken cancellationToken);

    Task<ExpenseDto> RecordAsync(Guid idempotencyKey, RecordExpenseRequest request, CancellationToken cancellationToken);

    Task<ExpenseDto> VoidAsync(Guid id, Guid idempotencyKey, VoidExpenseRequest request, CancellationToken cancellationToken);
}

/// <summary>Expense categories and expenses (Phase 7, D-142, D-143). Expenses are never edited; a mistake is voided.</summary>
internal sealed class ExpenseService(
    ICurrentBusiness currentBusiness,
    IExpenseCategoryRepository categories,
    IExpenseRepository expenses,
    IExpenseQueries queries,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : IExpenseService
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<IReadOnlyList<ExpenseCategoryDto>> CategoriesAsync(bool includeArchived, CancellationToken cancellationToken)
    {
        await categories.EnsureDefaultsAsync(clock.UtcNow, cancellationToken);
        return await queries.CategoriesAsync(includeArchived, cancellationToken);
    }

    public async Task<ExpenseCategoryDto> CreateCategoryAsync(ExpenseCategoryRequest request, CancellationToken cancellationToken)
    {
        await categories.EnsureDefaultsAsync(clock.UtcNow, cancellationToken);
        if (await categories.CountCustomAsync(cancellationToken) >= ExpenseCategory.MaxCustom)
        {
            throw new ConflictException("expense_category.limit", $"الحد الأقصى {ExpenseCategory.MaxCustom} تصنيف خاص.");
        }

        var category = ExpenseCategory.Custom(currentBusiness.BusinessId, request.Name);
        categories.Add(category);
        await SaveCategoryAsync(cancellationToken);
        return await CategoryAsync(category.Id, cancellationToken);
    }

    public async Task<ExpenseCategoryDto> RenameCategoryAsync(Guid id, ExpenseCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categories.GetForUpdateAsync(id, cancellationToken) ?? throw CategoryNotFound();
        category.Rename(request.Name);
        await SaveCategoryAsync(cancellationToken);
        return await CategoryAsync(id, cancellationToken);
    }

    public async Task<ExpenseCategoryDto> SetCategoryArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken)
    {
        var category = await categories.GetForUpdateAsync(id, cancellationToken) ?? throw CategoryNotFound();
        if (archived)
        {
            category.Archive();
        }
        else
        {
            category.Restore();
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await CategoryAsync(id, cancellationToken);
    }

    public Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListQuery query, CancellationToken cancellationToken) => queries.ListAsync(query, cancellationToken);

    public Task<ExpenseSummaryDto> SummaryAsync(ExpenseSummaryQuery query, CancellationToken cancellationToken)
    {
        var today = Today();
        return queries.SummaryAsync(query.From ?? new DateOnly(today.Year, today.Month, 1), query.To ?? today, cancellationToken);
    }

    public Task<ExpenseDto> RecordAsync(Guid idempotencyKey, RecordExpenseRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, request, async ct =>
        {
            var category = await categories.GetForUpdateAsync(request.CategoryId, ct) ?? throw CategoryNotFound();
            var now = clock.UtcNow;
            var expense = Expense.Manual(currentBusiness.BusinessId, category, request.Amount, request.SpentOn, BusinessTime.LocalDate(now, Zone), request.Note, Entity.NewId(), now);
            expenses.Add(expense);
            await unitOfWork.SaveChangesAsync(ct);
            return await queries.GetAsync(expense.Id, ct) ?? throw NotFound();
        }, cancellationToken);

    public Task<ExpenseDto> VoidAsync(Guid id, Guid idempotencyKey, VoidExpenseRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { id, request }, async ct =>
        {
            var expense = await expenses.GetForUpdateAsync(id, ct) ?? throw NotFound();
            expense.Void(request.Reason, clock.UtcNow);
            await unitOfWork.SaveChangesAsync(ct);
            return await queries.GetAsync(id, ct) ?? throw NotFound();
        }, cancellationToken);

    private async Task SaveCategoryAsync(CancellationToken cancellationToken)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            throw new ConflictException("expense_category.duplicate", "في تصنيف بنفس الاسم.");
        }
    }

    private async Task<ExpenseCategoryDto> CategoryAsync(Guid id, CancellationToken cancellationToken)
        => (await queries.CategoriesAsync(includeArchived: true, cancellationToken)).Single(c => c.Id == id);

    private DateOnly Today() => BusinessTime.LocalDate(clock.UtcNow, Zone);

    private static NotFoundException CategoryNotFound() => new("expense_category.not_found", "ما لقينا التصنيف.");

    private static NotFoundException NotFound() => new("expense.not_found", "ما لقينا المصروف.");
}
