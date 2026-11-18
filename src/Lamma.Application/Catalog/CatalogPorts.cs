using Lamma.Domain.Catalog;

namespace Lamma.Application.Catalog;

// Ports implemented in Infrastructure (focused repositories and read-side queries; no generic repository).

public interface ICategoryRepository
{
    /// <summary>A non-archived category of the current business, tracked for update.</summary>
    Task<Category?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    Task<bool> ExistsActiveAsync(Guid id, CancellationToken cancellationToken);

    Task<bool> ActiveNameExistsAsync(string name, Guid? excludeId, CancellationToken cancellationToken);

    /// <summary>Number of products (archived or active, per <paramref name="archived"/>) in the category.</summary>
    Task<int> CountProductsAsync(Guid categoryId, bool archived, CancellationToken cancellationToken);

    void Add(Category category);

    void Remove(Category category);
}

public interface ICategoryQueries
{
    /// <summary>Non-archived categories with their active-product counts, ordered by name.</summary>
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken);
}

public interface ITemplateFieldRepository
{
    /// <summary>Custom fields of the current business (optionally for one template), ordered by SortOrder.</summary>
    Task<IReadOnlyList<ProductTemplateCustomField>> ListAsync(string? templateCode, CancellationToken cancellationToken);

    Task<ProductTemplateCustomField?> GetForUpdateAsync(string templateCode, string key, CancellationToken cancellationToken);

    void Add(ProductTemplateCustomField field);

    void Remove(ProductTemplateCustomField field);
}

public interface IProductRepository
{
    /// <summary>The product with all its variants, tracked for update.</summary>
    Task<Product?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    void Add(Product product);

    void AddMovements(IEnumerable<StockMovement> movements);
}

/// <summary>Read model of one product for the details screen (no tracking).</summary>
public sealed record ProductDetailsRow(Product Product, string? CategoryName, IReadOnlyList<StockMovement> RecentMovements);

public interface IProductQueries
{
    Task<PagedResult<ProductListItemDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken);

    Task<ProductDetailsRow?> GetDetailsAsync(Guid id, int recentMovements, CancellationToken cancellationToken);
}
