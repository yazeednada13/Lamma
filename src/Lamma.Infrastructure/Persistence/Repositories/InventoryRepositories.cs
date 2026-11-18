using Lamma.Application.Catalog;
using Lamma.Application.Inventory;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class StockReceiptConfiguration : IEntityTypeConfiguration<StockReceipt>
{
    public void Configure(EntityTypeBuilder<StockReceipt> builder)
    {
        builder.ToTable("StockReceipts");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Supplier).HasMaxLength(StockReceipt.SupplierMaxLength);
        builder.Property(r => r.Note).HasMaxLength(StockReceipt.NoteMaxLength);
        builder.HasIndex(r => new { r.BusinessId, r.ReceivedOn }).IsDescending(false, true);
        builder.HasOne<Lamma.Domain.Businesses.Business>().WithMany().HasForeignKey(r => r.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class InventoryRepository(LammaDbContext db) : IInventoryRepository
{
    public async Task<IReadOnlyList<Product>> GetProductsForVariantsAsync(IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken)
    {
        // The tenant filter applies to both sets: another business's variant ids match nothing.
        var productIds = db.ProductVariants.Where(v => variantIds.Contains(v.Id)).Select(v => v.ProductId);
        return await db.Products.Include(p => p.Variants).Where(p => productIds.Contains(p.Id)).ToListAsync(cancellationToken);
    }

    public void AddReceipt(StockReceipt receipt) => db.StockReceipts.Add(receipt);

    public void AddMovements(IEnumerable<StockMovement> movements) => db.StockMovements.AddRange(movements);
}

internal sealed class InventoryQueries(LammaDbContext db) : IInventoryQueries
{
    public async Task<PagedResult<InventoryLevelDto>> LevelsAsync(InventoryLevelsQuery query, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking().Where(p => !p.IsArchived);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            products = products.Where(p => p.Name.Contains(search));
        }

        if (query.CategoryId is { } categoryId)
        {
            products = products.Where(p => p.CategoryId == categoryId);
        }

        var rows = products.Select(p => new LevelRow
        {
            Id = p.Id,
            Name = p.Name,
            CategoryName = db.Categories.Where(c => c.Id == p.CategoryId).Select(c => c.Name).FirstOrDefault(),
            TemplateCode = p.TemplateCode,
            ImagePath = p.ImagePath,
            Threshold = p.LowStockThreshold,
            OnHand = p.Variants.Where(v => !v.IsArchived).Sum(v => v.OnHand),
            Reserved = p.Variants.Where(v => !v.IsArchived).Sum(v => v.Reserved),
        });

        rows = query.Status switch
        {
            "out" => rows.Where(r => r.OnHand - r.Reserved <= 0),
            "low" => rows.Where(r => r.OnHand - r.Reserved > 0 && r.OnHand - r.Reserved <= r.Threshold),
            _ => rows,
        };

        var total = await rows.CountAsync(cancellationToken);

        // Most urgent first: available relative to the product's threshold (prototype ordering).
        var page = await rows
            .OrderBy(r => (r.OnHand - r.Reserved) * 1.0 / (r.Threshold < 1 ? 1 : r.Threshold))
            .ThenBy(r => r.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var ids = page.Select(r => r.Id).ToList();
        var variants = await (from v in db.ProductVariants.AsNoTracking()
                              join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                              where ids.Contains(v.ProductId) && !v.IsArchived
                              orderby v.SortOrder
                              select new { v.ProductId, v.Id, v.Option1Value, v.Option2Value, v.OnHand, v.Reserved, Cost = v.CostOverride ?? p.Cost, v.ExpiryDate })
            .ToListAsync(cancellationToken);

        var items = page.Select(r =>
        {
            var available = r.OnHand - r.Reserved;
            return new InventoryLevelDto(
                r.Id,
                r.Name,
                r.CategoryName,
                r.TemplateCode,
                CatalogMapping.ImageUrl(r.Id, r.ImagePath),
                r.OnHand,
                r.Reserved,
                available,
                r.Threshold,
                StockStatusRules.For(available, r.Threshold).ToCode(),
                variants.Where(v => v.ProductId == r.Id)
                    .Select(v => new VariantLevelDto(v.Id, Label(v.Option1Value, v.Option2Value), v.OnHand, v.Reserved, v.OnHand - v.Reserved, v.Cost, v.ExpiryDate))
                    .ToList());
        }).ToList();

        return new PagedResult<InventoryLevelDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<InventorySummaryDto> SummaryAsync(CancellationToken cancellationToken)
    {
        // Values: a flat join of active variants of active products (D-113).
        var values = await (from v in db.ProductVariants.AsNoTracking()
                            join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                            where !v.IsArchived && !p.IsArchived
                            group new { v, p } by 1 into g
                            select new
                            {
                                Cost = g.Sum(x => x.v.OnHand * (x.v.CostOverride ?? x.p.Cost)),
                                Retail = g.Sum(x => x.v.OnHand * (x.v.PriceOverride ?? x.p.SellingPrice)),
                                Pieces = g.Sum(x => x.v.OnHand),
                                Reserved = g.Sum(x => x.v.Reserved),
                            })
            .FirstOrDefaultAsync(cancellationToken);

        var products = await db.Products.AsNoTracking()
            .Where(p => !p.IsArchived)
            .Select(p => new
            {
                p.Name,
                p.LowStockThreshold,
                Available = p.Variants.Where(v => !v.IsArchived).Sum(v => v.OnHand - v.Reserved),
            })
            .ToListAsync(cancellationToken);

        var low = products.Where(p => p.Available > 0 && p.Available <= p.LowStockThreshold).OrderBy(p => p.Available).ToList();
        var outOfStock = products.Where(p => p.Available <= 0).ToList();
        var cost = MoneyMath.Round(values?.Cost ?? 0);
        var retail = MoneyMath.Round(values?.Retail ?? 0);
        return new InventorySummaryDto(
            cost,
            retail,
            retail - cost,
            values?.Pieces ?? 0,
            values?.Reserved ?? 0,
            products.Count,
            low.Count,
            outOfStock.Count,
            low.Take(2).Select(p => p.Name).ToList(),
            outOfStock.Take(2).Select(p => p.Name).ToList());
    }

    public async Task<PagedResult<MovementLogItemDto>> MovementsAsync(MovementLogQuery query, CancellationToken cancellationToken)
    {
        var movements = db.StockMovements.AsNoTracking();
        movements = query.Direction switch
        {
            "in" => movements.Where(m => m.OnHandDelta > 0),
            "out" => movements.Where(m => m.OnHandDelta < 0),
            _ => movements,
        };
        movements = query.Origin switch
        {
            "auto" => movements.Where(m => m.IsAutomatic),
            "manual" => movements.Where(m => !m.IsAutomatic),
            _ => movements,
        };

        if (query.ProductId is { } productId)
        {
            movements = movements.Where(m => m.ProductId == productId);
        }

        if (query.VariantId is { } variantId)
        {
            movements = movements.Where(m => m.VariantId == variantId);
        }

        var total = await movements.CountAsync(cancellationToken);
        var rows = await (from m in movements
                          join p in db.Products.AsNoTracking() on m.ProductId equals p.Id
                          join v in db.ProductVariants.AsNoTracking() on m.VariantId equals v.Id
                          orderby m.CreatedAt descending, m.Id descending
                          select new { m, p.Name, v.Option1Value, v.Option2Value })
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => new MovementLogItemDto(
            r.m.Id,
            r.m.ProductId,
            r.Name,
            r.m.VariantId,
            Label(r.Option1Value, r.Option2Value),
            r.m.Type.ToCode(),
            r.m.ReferenceKind?.ToCode(),
            r.m.ReferenceLabel,
            r.m.AdjustmentReason?.ToCode(),
            r.m.Reason,
            r.m.OnHandDelta,
            r.m.ReservedDelta,
            r.m.UnitCost,
            r.m.IsAutomatic,
            r.m.CreatedAt)).ToList();

        return new PagedResult<MovementLogItemDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<IReadOnlyList<ExpiringItemDto>> ExpiringAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var rows = await (from v in db.ProductVariants.AsNoTracking()
                          join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                          where !v.IsArchived && !p.IsArchived && v.ExpiryDate != null && v.OnHand > 0
                          orderby v.ExpiryDate, p.Name
                          select new { p.Id, p.Name, p.TemplateCode, p.ImagePath, VariantId = v.Id, v.Option1Value, v.Option2Value, v.OnHand, v.ExpiryDate })
            .ToListAsync(cancellationToken);

        return rows.Select(r =>
        {
            var days = r.ExpiryDate!.Value.DayNumber - today.DayNumber;
            return new ExpiringItemDto(r.Id, r.Name, r.TemplateCode, CatalogMapping.ImageUrl(r.Id, r.ImagePath), r.VariantId, Label(r.Option1Value, r.Option2Value), r.OnHand, r.ExpiryDate.Value, days, StockRules.ExpiryStatus(days));
        }).ToList();
    }

    private static string Label(string? option1, string? option2)
        => option1 is null ? "—" : option2 is null ? option1 : $"{option1} · {option2}";

    private sealed class LevelRow
    {
        public Guid Id { get; init; }

        public string Name { get; init; } = string.Empty;

        public string? CategoryName { get; init; }

        public string TemplateCode { get; init; } = string.Empty;

        public string? ImagePath { get; init; }

        public int Threshold { get; init; }

        public int OnHand { get; init; }

        public int Reserved { get; init; }
    }
}
