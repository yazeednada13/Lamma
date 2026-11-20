using Lamma.Application.Catalog;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Persistence.Repositories;

// The tenant query filter applies to every query below; no business id is taken from callers.

internal sealed class CategoryRepository(LammaDbContext db) : ICategoryRepository
{
    public Task<Category?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.Categories.FirstOrDefaultAsync(c => c.Id == id && !c.IsArchived, cancellationToken);

    public Task<bool> ExistsActiveAsync(Guid id, CancellationToken cancellationToken)
        => db.Categories.AsNoTracking().AnyAsync(c => c.Id == id && !c.IsArchived, cancellationToken);

    public Task<bool> ActiveNameExistsAsync(string name, Guid? excludeId, CancellationToken cancellationToken)
        => db.Categories.AsNoTracking().AnyAsync(c => !c.IsArchived && c.Name == name && (excludeId == null || c.Id != excludeId), cancellationToken);

    public Task<int> CountProductsAsync(Guid categoryId, bool archived, CancellationToken cancellationToken)
        => db.Products.AsNoTracking().CountAsync(p => p.CategoryId == categoryId && p.IsArchived == archived, cancellationToken);

    public void Add(Category category) => db.Categories.Add(category);

    public void Remove(Category category) => db.Categories.Remove(category);
}

internal sealed class CategoryQueries(LammaDbContext db) : ICategoryQueries
{
    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken)
        => await db.Categories.AsNoTracking()
            .Where(c => !c.IsArchived)
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, db.Products.Count(p => p.CategoryId == c.Id && !p.IsArchived)))
            .ToListAsync(cancellationToken);
}

internal sealed class TemplateFieldRepository(LammaDbContext db) : ITemplateFieldRepository
{
    public async Task<IReadOnlyList<ProductTemplateCustomField>> ListAsync(string? templateCode, CancellationToken cancellationToken)
        => await db.ProductTemplateCustomFields
            .Where(f => templateCode == null || f.TemplateCode == templateCode)
            .OrderBy(f => f.TemplateCode).ThenBy(f => f.SortOrder)
            .ToListAsync(cancellationToken);

    public Task<ProductTemplateCustomField?> GetForUpdateAsync(string templateCode, string key, CancellationToken cancellationToken)
        => db.ProductTemplateCustomFields.FirstOrDefaultAsync(f => f.TemplateCode == templateCode && f.Key == key, cancellationToken);

    public void Add(ProductTemplateCustomField field) => db.ProductTemplateCustomFields.Add(field);

    public void Remove(ProductTemplateCustomField field) => db.ProductTemplateCustomFields.Remove(field);
}

internal sealed class ProductRepository(LammaDbContext db) : IProductRepository
{
    public Task<Product?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public void Add(Product product) => db.Products.Add(product);

    public void AddMovements(IEnumerable<StockMovement> movements) => db.StockMovements.AddRange(movements);
}

internal sealed class ProductQueries(LammaDbContext db) : IProductQueries
{
    public async Task<PagedResult<ProductListItemDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking().Where(p => p.IsArchived == query.Archived);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            products = products.Where(p => p.Name.Contains(search));
        }

        if (query.Uncategorized)
        {
            products = products.Where(p => p.CategoryId == null);
        }
        else if (query.CategoryId is { } categoryId)
        {
            products = products.Where(p => p.CategoryId == categoryId);
        }

        // One SQL statement: stock totals and the price range are aggregated over active variants (D-099).
        var rows = products.Select(p => new ProductListRow
        {
            Id = p.Id,
            Name = p.Name,
            CategoryId = p.CategoryId,
            CategoryName = db.Categories.Where(c => c.Id == p.CategoryId).Select(c => c.Name).FirstOrDefault(),
            TemplateCode = p.TemplateCode,
            ImagePath = p.ImagePath,
            LowStockThreshold = p.LowStockThreshold,
            IsArchived = p.IsArchived,
            CreatedAt = p.CreatedAt,
            OnHand = p.Variants.Where(v => !v.IsArchived).Sum(v => v.OnHand),
            Reserved = p.Variants.Where(v => !v.IsArchived).Sum(v => v.Reserved),
            VariantCount = p.Variants.Count(v => !v.IsArchived && v.Option1Value != null),
            SellingPrice = p.SellingPrice,

            // SQL Server cannot aggregate an expression mixing inner and outer columns, so overrides are aggregated alone.
            MinOverride = p.Variants.Where(v => !v.IsArchived).Min(v => v.PriceOverride),
            MaxOverride = p.Variants.Where(v => !v.IsArchived).Max(v => v.PriceOverride),
            AnyBasePrice = p.Variants.Any(v => !v.IsArchived && v.PriceOverride == null),
        });

        rows = query.StockStatus switch
        {
            "out" => rows.Where(r => r.OnHand - r.Reserved <= 0),
            "low" => rows.Where(r => r.OnHand - r.Reserved > 0 && r.OnHand - r.Reserved <= r.LowStockThreshold),
            "in" => rows.Where(r => r.OnHand - r.Reserved > r.LowStockThreshold),
            _ => rows,
        };

        var total = await rows.CountAsync(cancellationToken);

        var ordered = query.Sort switch
        {
            "createdAt" => rows.OrderBy(r => r.CreatedAt).ThenBy(r => r.Id),
            "name" => rows.OrderBy(r => r.Name).ThenBy(r => r.Id),
            "-name" => rows.OrderByDescending(r => r.Name).ThenBy(r => r.Id),
            "available" => rows.OrderBy(r => r.OnHand - r.Reserved).ThenBy(r => r.Id),
            "-available" => rows.OrderByDescending(r => r.OnHand - r.Reserved).ThenBy(r => r.Id),
            _ => rows.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id),
        };

        var page = await ordered.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        var items = page.Select(r =>
        {
            var available = r.OnHand - r.Reserved;
            var prices = new[] { r.AnyBasePrice || r.MinOverride is null ? r.SellingPrice : (decimal?)null, r.MinOverride, r.MaxOverride }
                .Where(x => x.HasValue).Select(x => x!.Value).ToList();
            return new ProductListItemDto(
                r.Id,
                r.Name,
                r.CategoryId,
                r.CategoryName,
                r.TemplateCode,
                CatalogMapping.ImageUrl(r.Id, r.ImagePath),
                prices.Min(),
                prices.Max(),
                r.OnHand,
                r.Reserved,
                available,
                r.LowStockThreshold,
                StockStatusRules.For(available, r.LowStockThreshold).ToCode(),
                r.VariantCount,
                r.IsArchived,
                r.CreatedAt);
        }).ToList();

        return new PagedResult<ProductListItemDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<ProductDetailsRow?> GetDetailsAsync(Guid id, int recentMovements, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking()
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
        {
            return null;
        }

        var categoryName = product.CategoryId is null
            ? null
            : await db.Categories.AsNoTracking().Where(c => c.Id == product.CategoryId).Select(c => c.Name).FirstOrDefaultAsync(cancellationToken);

        var movements = await db.StockMovements.AsNoTracking()
            .Where(m => m.ProductId == id)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(recentMovements)
            .ToListAsync(cancellationToken);

        var sold = await (from i in db.OrderItems.AsNoTracking()
                          join o in db.Orders.AsNoTracking() on i.OrderId equals o.Id
                          where i.ProductId == id && o.Status == OrderStatus.Delivered
                          select (int?)i.Quantity).SumAsync(cancellationToken) ?? 0;

        return new ProductDetailsRow(product, categoryName, movements, sold);
    }

    private sealed class ProductListRow
    {
        public Guid Id { get; init; }

        public string Name { get; init; } = string.Empty;

        public Guid? CategoryId { get; init; }

        public string? CategoryName { get; init; }

        public string TemplateCode { get; init; } = string.Empty;

        public string? ImagePath { get; init; }

        public int LowStockThreshold { get; init; }

        public bool IsArchived { get; init; }

        public DateTime CreatedAt { get; init; }

        public int OnHand { get; init; }

        public int Reserved { get; init; }

        public int VariantCount { get; init; }

        public decimal SellingPrice { get; init; }

        public decimal? MinOverride { get; init; }

        public decimal? MaxOverride { get; init; }

        public bool AnyBasePrice { get; init; }
    }
}
