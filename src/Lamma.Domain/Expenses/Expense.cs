using Lamma.Domain.Common;

namespace Lamma.Domain.Expenses;

/// <summary>Default categories created for every business (D-142). <see cref="Delivery"/> is the system one used by settlements.</summary>
public enum ExpenseCategoryCode
{
    Ads,
    Delivery,
    Packaging,
    Rent,
    Other,
}

public enum ExpenseSource
{
    Manual,
    CourierSettlement,
}

/// <summary>An expense category (D-142). Defaults carry a <see cref="Code"/>; custom ones have none. Archive only, never deleted.</summary>
public sealed class ExpenseCategory : Entity, IBusinessOwned, IHasTimestamps
{
    public const int NameMaxLength = 40;
    public const int MaxCustom = 30;

    /// <summary>Default code, Arabic name and display order (D-142; no «مشتريات», D-107).</summary>
    public static readonly IReadOnlyList<(ExpenseCategoryCode Code, string Name)> Defaults =
    [
        (ExpenseCategoryCode.Ads, "إعلانات"),
        (ExpenseCategoryCode.Delivery, "توصيل"),
        (ExpenseCategoryCode.Packaging, "تغليف"),
        (ExpenseCategoryCode.Rent, "إيجار"),
        (ExpenseCategoryCode.Other, "أخرى"),
    ];

    private ExpenseCategory(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private ExpenseCategory()
    {
    }

    public Guid BusinessId { get; private set; }

    public ExpenseCategoryCode? Code { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public bool IsArchived { get; private set; }

    /// <summary>Defaults first in their fixed order, then custom ones (100).</summary>
    public int SortOrder { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    /// <summary>«توصيل» is fixed: settlement differences are recorded there (D-035, D-142).</summary>
    public bool IsSystem => Code == ExpenseCategoryCode.Delivery;

    public static ExpenseCategory Custom(Guid businessId, string name)
        => new(NewId(), businessId) { Name = CleanName(name), SortOrder = 100 };

    public void Rename(string name)
    {
        EnsureNotSystem();
        Name = CleanName(name);
    }

    public void Archive()
    {
        EnsureNotSystem();
        IsArchived = true;
    }

    public void Restore() => IsArchived = false;

    public static int DefaultSortOrder(ExpenseCategoryCode code) => (int)code + 1;

    public static string CleanName(string? name)
    {
        var cleaned = string.IsNullOrWhiteSpace(name) ? null : string.Join(' ', name.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (cleaned is null)
        {
            throw new DomainException("expense_category.name_required", "اكتب اسم التصنيف.");
        }

        if (cleaned.Length > NameMaxLength)
        {
            throw new DomainException("expense_category.name_too_long", $"اسم التصنيف لازم يكون {NameMaxLength} حرف أو أقل.");
        }

        return cleaned;
    }

    private void EnsureNotSystem()
    {
        if (IsSystem)
        {
            throw new DomainConflictException("expense_category.system", "تصنيف «توصيل» ثابت، لأنه فروقات تسوية شركة التوصيل بتنسجّل عليه.");
        }
    }
}

/// <summary>
/// Money spent (D-143). Never edited; a mistake is voided and stays in history. A settlement's difference expense
/// (<see cref="ExpenseSource.CourierSettlement"/>) is voided only by reversing its settlement (D-141).
/// </summary>
public sealed class Expense : Entity, IBusinessOwned
{
    public const int NoteMaxLength = 200;

    private Expense(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private Expense()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid CategoryId { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>Business-local date of the expense (back-dating allowed, never the future).</summary>
    public DateOnly SpentOn { get; private set; }

    public string? Note { get; private set; }

    public ExpenseSource Source { get; private set; }

    /// <summary>The settlement whose difference this is (unique: one expense per settlement, D-035).</summary>
    public Guid? SettlementId { get; private set; }

    public DateTime RecordedAt { get; private set; }

    public Guid OperationId { get; private set; }

    public DateTime? VoidedAt { get; private set; }

    public string? VoidReason { get; private set; }

    public bool IsVoided => VoidedAt is not null;

    public static Expense Manual(Guid businessId, ExpenseCategory category, decimal amount, DateOnly spentOn, DateOnly today, string? note, Guid operationId, DateTime nowUtc)
    {
        if (category.IsArchived)
        {
            throw new DomainConflictException("expense_category.archived", "التصنيف مؤرشف. استرجعه أو اختار تصنيف ثاني.");
        }

        if (spentOn > today)
        {
            throw new DomainException("expense.invalid_date", "تاريخ المصروف ما بصير يكون بالمستقبل.");
        }

        return Create(businessId, category.Id, amount, spentOn, Clean(note, NoteMaxLength), ExpenseSource.Manual, null, operationId, nowUtc);
    }

    /// <summary>The settlement difference as a «توصيل» expense (D-035, D-141).</summary>
    internal static Expense ForSettlement(Guid businessId, Guid deliveryCategoryId, decimal difference, DateOnly settledOn, Guid settlementId, Guid operationId, DateTime nowUtc)
        => Create(businessId, deliveryCategoryId, difference, settledOn, "فرق تسوية شركة التوصيل", ExpenseSource.CourierSettlement, settlementId, operationId, nowUtc);

    /// <summary>Voids a manual expense (D-143). A settlement's expense goes only with its settlement.</summary>
    public void Void(string? reason, DateTime nowUtc)
    {
        if (Source == ExpenseSource.CourierSettlement)
        {
            throw new DomainConflictException("expense.from_settlement", "هاد المصروف من تسوية شركة التوصيل. ألغِ التسوية نفسها من صفحة شركة التوصيل.");
        }

        VoidCore(Clean(reason, NoteMaxLength), nowUtc);
    }

    internal void VoidBySettlement(DateTime nowUtc) => VoidCore("انلغت التسوية", nowUtc);

    private void VoidCore(string? reason, DateTime nowUtc)
    {
        if (IsVoided)
        {
            throw new DomainConflictException("expense.already_voided", "هاد المصروف ملغي من قبل.");
        }

        VoidedAt = nowUtc;
        VoidReason = reason;
    }

    private static Expense Create(Guid businessId, Guid categoryId, decimal amount, DateOnly spentOn, string? note, ExpenseSource source, Guid? settlementId, Guid operationId, DateTime nowUtc)
    {
        Guard.NotEmpty(categoryId, nameof(categoryId));
        Guard.NotEmpty(operationId, nameof(operationId));
        if (amount <= 0 || amount > Catalog.Product.MaxMoney || !MoneyMath.HasValidScale(amount))
        {
            throw new DomainException("expense.invalid_amount", "المبلغ لازم يكون أكبر من صفر.");
        }

        return new Expense(NewId(), businessId)
        {
            CategoryId = categoryId,
            Amount = amount,
            SpentOn = spentOn,
            Note = note,
            Source = source,
            SettlementId = settlementId,
            RecordedAt = nowUtc,
            OperationId = operationId,
        };
    }

    internal static string? Clean(string? value, int max)
    {
        var cleaned = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (cleaned is { Length: var length } && length > max)
        {
            throw new DomainException("expense.text_too_long", $"النص لازم يكون {max} حرف أو أقل.");
        }

        return cleaned;
    }
}
