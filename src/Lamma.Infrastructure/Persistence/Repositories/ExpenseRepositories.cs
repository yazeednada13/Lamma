using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Expenses;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Courier;
using Lamma.Domain.Expenses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> builder)
    {
        builder.ToTable("ExpenseCategories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(ExpenseCategory.NameMaxLength).IsRequired();
        builder.Ignore(c => c.IsSystem);

        // One row per default code (D-142), and unique names within a business.
        builder.HasIndex(c => new { c.BusinessId, c.Code }).IsUnique().HasFilter("[Code] IS NOT NULL");
        builder.HasIndex(c => new { c.BusinessId, c.Name }).IsUnique();
        builder.HasOne<Business>().WithMany().HasForeignKey(c => c.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("Expenses", t => t.HasCheckConstraint("CK_Expenses_Amount", "[Amount] > 0"));
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Note).HasMaxLength(Expense.NoteMaxLength);
        builder.Property(e => e.VoidReason).HasMaxLength(Expense.NoteMaxLength);
        builder.Ignore(e => e.IsVoided);

        builder.HasIndex(e => new { e.BusinessId, e.SpentOn });
        builder.HasIndex(e => new { e.BusinessId, e.OperationId }).IsUnique();
        // A settlement has at most one difference expense (D-035: never twice).
        builder.HasIndex(e => e.SettlementId).IsUnique().HasFilter("[SettlementId] IS NOT NULL");
        builder.HasOne<Business>().WithMany().HasForeignKey(e => e.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ExpenseCategory>().WithMany().HasForeignKey(e => e.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CourierSettlement>().WithMany().HasForeignKey(e => e.SettlementId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ExpenseCategoryRepository(LammaDbContext db, ICurrentBusiness currentBusiness) : IExpenseCategoryRepository
{
    /// <summary>
    /// MERGE under HOLDLOCK on (BusinessId, Code): concurrent first uses insert each default once. Skipped once all
    /// defaults exist (renamed or archived defaults keep their code, so they are never recreated).
    /// </summary>
    public async Task EnsureDefaultsAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var defaults = ExpenseCategory.Defaults;
        if (await db.ExpenseCategories.CountAsync(c => c.Code != null, cancellationToken) >= defaults.Count)
        {
            return;
        }

        var businessId = currentBusiness.BusinessId;
        string Code(int i) => defaults[i].Code.ToCode();
        string Name(int i) => defaults[i].Name;
        int Sort(int i) => ExpenseCategory.DefaultSortOrder(defaults[i].Code);
        Guid Id() => Entity.NewId();
        await db.Database.ExecuteSqlAsync($"""
            MERGE [ExpenseCategories] WITH (HOLDLOCK) AS t
            USING (VALUES
                ({Id()}, {Code(0)}, {Name(0)}, {Sort(0)}),
                ({Id()}, {Code(1)}, {Name(1)}, {Sort(1)}),
                ({Id()}, {Code(2)}, {Name(2)}, {Sort(2)}),
                ({Id()}, {Code(3)}, {Name(3)}, {Sort(3)}),
                ({Id()}, {Code(4)}, {Name(4)}, {Sort(4)})
            ) AS s ([Id], [Code], [Name], [SortOrder])
            ON t.[BusinessId] = {businessId} AND t.[Code] = s.[Code]
            WHEN NOT MATCHED THEN
                INSERT ([Id], [BusinessId], [Code], [Name], [IsArchived], [SortOrder], [CreatedAt], [UpdatedAt])
                VALUES (s.[Id], {businessId}, s.[Code], s.[Name], 0, s.[SortOrder], {nowUtc}, {nowUtc});
            """, cancellationToken);
    }

    public Task<ExpenseCategory?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Guid> DeliveryIdAsync(CancellationToken cancellationToken)
        => db.ExpenseCategories.Where(c => c.Code == ExpenseCategoryCode.Delivery).Select(c => c.Id).SingleAsync(cancellationToken);

    public Task<int> CountCustomAsync(CancellationToken cancellationToken)
        => db.ExpenseCategories.CountAsync(c => c.Code == null, cancellationToken);

    public void Add(ExpenseCategory category) => db.ExpenseCategories.Add(category);
}

internal sealed class ExpenseRepository(LammaDbContext db) : IExpenseRepository
{
    public Task<Expense?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.Expenses.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public Task<Expense?> BySettlementForUpdateAsync(Guid settlementId, CancellationToken cancellationToken)
        => db.Expenses.FirstOrDefaultAsync(e => e.SettlementId == settlementId, cancellationToken);

    public void Add(Expense expense) => db.Expenses.Add(expense);
}

internal sealed class ExpenseQueries(LammaDbContext db) : IExpenseQueries
{
    public async Task<IReadOnlyList<ExpenseCategoryDto>> CategoriesAsync(bool includeArchived, CancellationToken cancellationToken)
    {
        var rows = await db.ExpenseCategories.AsNoTracking()
            .Where(c => includeArchived || !c.IsArchived)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Code, c.IsArchived })
            .ToListAsync(cancellationToken);
        return rows.Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.Code?.ToCode(), c.Code == ExpenseCategoryCode.Delivery, c.IsArchived)).ToList();
    }

    public async Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListQuery query, CancellationToken cancellationToken)
    {
        var rows = Rows();
        if (query.From is { } from)
        {
            rows = rows.Where(r => r.SpentOn >= from);
        }

        if (query.To is { } to)
        {
            rows = rows.Where(r => r.SpentOn <= to);
        }

        if (query.CategoryId is { } categoryId)
        {
            rows = rows.Where(r => r.CategoryId == categoryId);
        }

        var total = await rows.CountAsync(cancellationToken);
        var page = await rows.OrderByDescending(r => r.SpentOn).ThenByDescending(r => r.RecordedAt).ThenByDescending(r => r.Id)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<ExpenseDto>(page.Select(ToDto).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<ExpenseDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await Rows().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<ExpenseSummaryDto> SummaryAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var groups = await db.Expenses.AsNoTracking()
            .Where(e => e.VoidedAt == null && e.SpentOn >= from && e.SpentOn <= to)
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Amount = g.Sum(e => e.Amount), Count = g.Count() })
            .Join(db.ExpenseCategories.AsNoTracking(), g => g.CategoryId, c => c.Id, (g, c) => new { g.CategoryId, c.Name, c.Code, g.Amount, g.Count })
            .ToListAsync(cancellationToken);
        var last = await db.Expenses.AsNoTracking()
            .Where(e => e.VoidedAt == null && e.Source == ExpenseSource.Manual)
            .OrderByDescending(e => e.RecordedAt)
            .Select(e => (Guid?)e.CategoryId)
            .FirstOrDefaultAsync(cancellationToken);
        var byCategory = groups
            .OrderByDescending(g => g.Amount).ThenBy(g => g.Name)
            .Select(g => new ExpenseCategoryTotalDto(g.CategoryId, g.Name, g.Code?.ToCode(), g.Amount, g.Count))
            .ToList();
        return new ExpenseSummaryDto(from, to, byCategory.Sum(c => c.Amount), byCategory.Sum(c => c.Count), byCategory, last);
    }

    private IQueryable<ExpenseRow> Rows()
        => db.Expenses.AsNoTracking().Join(db.ExpenseCategories.AsNoTracking(), e => e.CategoryId, c => c.Id, (e, c) => new ExpenseRow
        {
            Id = e.Id,
            CategoryId = c.Id,
            CategoryName = c.Name,
            CategoryCode = c.Code,
            Amount = e.Amount,
            SpentOn = e.SpentOn,
            Note = e.Note,
            Source = e.Source,
            SettlementId = e.SettlementId,
            RecordedAt = e.RecordedAt,
            VoidedAt = e.VoidedAt,
            VoidReason = e.VoidReason,
        });

    private static ExpenseDto ToDto(ExpenseRow r)
        => new(r.Id, r.CategoryId, r.CategoryName, r.CategoryCode?.ToCode(), r.Amount, r.SpentOn, r.Note, r.Source.ToCode(), r.SettlementId, r.RecordedAt, r.VoidedAt is not null, r.VoidedAt, r.VoidReason);

    private sealed class ExpenseRow
    {
        public Guid Id { get; init; }

        public Guid CategoryId { get; init; }

        public string CategoryName { get; init; } = string.Empty;

        public ExpenseCategoryCode? CategoryCode { get; init; }

        public decimal Amount { get; init; }

        public DateOnly SpentOn { get; init; }

        public string? Note { get; init; }

        public ExpenseSource Source { get; init; }

        public Guid? SettlementId { get; init; }

        public DateTime RecordedAt { get; init; }

        public DateTime? VoidedAt { get; init; }

        public string? VoidReason { get; init; }
    }
}
