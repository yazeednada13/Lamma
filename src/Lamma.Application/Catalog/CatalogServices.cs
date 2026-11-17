using Lamma.Application.Businesses;
using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Application.Catalog;

internal static class CatalogErrors
{
    public static NotFoundException ProductNotFound() => new("product.not_found", "ما لقينا المنتج.");

    public static NotFoundException VariantNotFound() => new("product.variant_not_found", "ما لقينا النسخة.");

    public static NotFoundException CategoryNotFound() => new("category.not_found", "ما لقينا التصنيف.");

    public static NotFoundException TemplateNotFound() => new("template.not_found", "ما لقينا القالب.");

    public static NotFoundException FieldNotFound() => new("template.field_not_found", "ما لقينا الحقل.");
}

// ---------- Categories ----------

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken);

    Task<CategoryDto> CreateAsync(CategoryRequest request, CancellationToken cancellationToken);

    Task<CategoryDto> RenameAsync(Guid id, CategoryRequest request, CancellationToken cancellationToken);

    /// <summary>Deletes, or archives when only archived products use it; 409 while active products use it (D-095).</summary>
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

internal sealed class CategoryService(
    ICurrentBusiness currentBusiness,
    ICategoryRepository categories,
    ICategoryQueries queries,
    IUnitOfWork unitOfWork) : ICategoryService
{
    public Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken) => queries.ListAsync(cancellationToken);

    public async Task<CategoryDto> CreateAsync(CategoryRequest request, CancellationToken cancellationToken)
    {
        var name = Category.NormalizeName(request.Name);
        await EnsureUniqueAsync(name, null, cancellationToken);
        var category = Category.Create(currentBusiness.BusinessId, name);
        categories.Add(category);
        await SaveAsync(cancellationToken);
        return new CategoryDto(category.Id, category.Name, 0);
    }

    public async Task<CategoryDto> RenameAsync(Guid id, CategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categories.GetForUpdateAsync(id, cancellationToken) ?? throw CatalogErrors.CategoryNotFound();
        var name = Category.NormalizeName(request.Name);
        await EnsureUniqueAsync(name, id, cancellationToken);
        category.Rename(name);
        await SaveAsync(cancellationToken);
        return new CategoryDto(category.Id, category.Name, await categories.CountProductsAsync(id, archived: false, cancellationToken));
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await categories.GetForUpdateAsync(id, cancellationToken) ?? throw CatalogErrors.CategoryNotFound();
        var active = await categories.CountProductsAsync(id, archived: false, cancellationToken);
        if (active > 0)
        {
            throw new ConflictException("category.has_products", $"التصنيف فيه {active} منتج. انقل المنتجات لتصنيف ثاني أو أرشفها قبل ما تحذفه.");
        }

        if (await categories.CountProductsAsync(id, archived: true, cancellationToken) > 0)
        {
            category.Archive(); // archived products keep their history (D-095)
        }
        else
        {
            categories.Remove(category);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureUniqueAsync(string name, Guid? excludeId, CancellationToken cancellationToken)
    {
        if (await categories.ActiveNameExistsAsync(name, excludeId, cancellationToken))
        {
            throw DuplicateName();
        }
    }

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            throw DuplicateName(); // a concurrent request created the same name
        }
    }

    private static ConflictException DuplicateName() => new("category.duplicate_name", "في تصنيف بنفس الاسم.");
}

// ---------- Templates and custom fields ----------

public interface IProductTemplateService
{
    Task<IReadOnlyList<ProductTemplateDto>> ListAsync(CancellationToken cancellationToken);

    Task<TemplateFieldDto> AddFieldAsync(string templateCode, TemplateFieldRequest request, CancellationToken cancellationToken);

    Task<TemplateFieldDto> UpdateFieldAsync(string templateCode, string key, TemplateFieldRequest request, CancellationToken cancellationToken);

    Task DeleteFieldAsync(string templateCode, string key, CancellationToken cancellationToken);
}

internal sealed class ProductTemplateService(
    ICurrentBusiness currentBusiness,
    ITemplateFieldRepository fields,
    IUnitOfWork unitOfWork) : IProductTemplateService
{
    public async Task<IReadOnlyList<ProductTemplateDto>> ListAsync(CancellationToken cancellationToken)
    {
        var custom = await fields.ListAsync(null, cancellationToken);
        return ProductTemplateCatalog.All
            .Select(t => CatalogMapping.ToDto(t, custom.Where(f => f.TemplateCode == t.Code).Select(f => f.ToTemplateField())))
            .ToList();
    }

    public async Task<TemplateFieldDto> AddFieldAsync(string templateCode, TemplateFieldRequest request, CancellationToken cancellationToken)
    {
        var template = ProductTemplateCatalog.Find(templateCode) ?? throw CatalogErrors.TemplateNotFound();
        var existing = await fields.ListAsync(template.Code, cancellationToken);
        if (existing.Count >= ProductTemplateCustomField.MaxPerTemplate)
        {
            throw new ConflictException("template.field_limit", $"الحد الأقصى {ProductTemplateCustomField.MaxPerTemplate} حقل خاص لكل قالب.");
        }

        EnsureUniqueLabel(template, existing, request.LabelAr, exceptKey: null);
        var field = ProductTemplateCustomField.Create(
            currentBusiness.BusinessId,
            template.Code,
            request.LabelAr,
            EnumCode.Parse<TemplateFieldType>(request.Type),
            request.Options ?? [],
            request.IsRequired,
            existing.Count == 0 ? 1 : existing.Max(f => f.SortOrder) + 1);
        fields.Add(field);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return CatalogMapping.ToDto(field.ToTemplateField());
    }

    public async Task<TemplateFieldDto> UpdateFieldAsync(string templateCode, string key, TemplateFieldRequest request, CancellationToken cancellationToken)
    {
        var template = ProductTemplateCatalog.Find(templateCode) ?? throw CatalogErrors.TemplateNotFound();
        var field = await fields.GetForUpdateAsync(template.Code, key, cancellationToken) ?? throw CatalogErrors.FieldNotFound();
        EnsureUniqueLabel(template, await fields.ListAsync(template.Code, cancellationToken), request.LabelAr, exceptKey: key);
        field.Update(request.LabelAr, EnumCode.Parse<TemplateFieldType>(request.Type), request.Options ?? [], request.IsRequired);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return CatalogMapping.ToDto(field.ToTemplateField());
    }

    public async Task DeleteFieldAsync(string templateCode, string key, CancellationToken cancellationToken)
    {
        var template = ProductTemplateCatalog.Find(templateCode) ?? throw CatalogErrors.TemplateNotFound();
        var field = await fields.GetForUpdateAsync(template.Code, key, cancellationToken) ?? throw CatalogErrors.FieldNotFound();

        // Stored product values stay in the attributes JSON but are no longer shown or validated (plan 2.A2).
        fields.Remove(field);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static void EnsureUniqueLabel(ProductTemplate template, IEnumerable<ProductTemplateCustomField> existing, string label, string? exceptKey)
    {
        var trimmed = label.Trim();
        var taken = template.Fields.Select(f => f.LabelAr)
            .Concat(existing.Where(f => f.Key != exceptKey).Select(f => f.LabelAr))
            .Any(l => string.Equals(l, trimmed, StringComparison.OrdinalIgnoreCase));
        if (taken)
        {
            throw new ConflictException("template.duplicate_field_label", "في حقل بنفس الاسم بهذا القالب.");
        }
    }
}

// ---------- Products ----------

public interface IProductService
{
    Task<PagedResult<ProductListItemDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken);

    Task<ProductDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<ProductDetailsDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken);

    Task<ProductDetailsDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken);

    Task<ProductDetailsDto> SetArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken);

    Task<ProductDetailsDto> AddVariantAsync(Guid id, AddVariantRequest request, CancellationToken cancellationToken);

    Task<ProductDetailsDto> UpdateVariantAsync(Guid id, Guid variantId, UpdateVariantRequest request, CancellationToken cancellationToken);

    Task<ProductDetailsDto> SetVariantArchivedAsync(Guid id, Guid variantId, bool archived, CancellationToken cancellationToken);
}

internal sealed class ProductService(
    ICurrentBusiness currentBusiness,
    IProductRepository products,
    IProductQueries queries,
    ICategoryRepository categories,
    ITemplateFieldRepository templateFields,
    IBusinessSettingsQueries businessSettings,
    IUnitOfWork unitOfWork,
    IClock clock) : IProductService
{
    public const int RecentMovements = 10;

    public Task<PagedResult<ProductListItemDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken)
        => queries.ListAsync(query, cancellationToken);

    public async Task<ProductDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await queries.GetDetailsAsync(id, RecentMovements, cancellationToken) ?? throw CatalogErrors.ProductNotFound();
        return CatalogMapping.ToDetails(row);
    }

    public async Task<ProductDetailsDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var businessId = currentBusiness.BusinessId;
        var profile = await businessSettings.GetProfileAsync(businessId, cancellationToken) ?? throw new NotFoundException("business.not_found", "ما لقينا المشروع.");
        var templateCode = request.TemplateCode ?? ProductTemplateCatalog.DefaultFor(EnumCode.Parse<BusinessType>(profile.BusinessType));
        var template = ProductTemplateCatalog.Find(templateCode)!;

        await EnsureCategoryAsync(request.CategoryId, currentCategoryId: null, cancellationToken);
        EnsureExpiryAllowed(template, request.ExpiryDate);
        var attributes = ProductAttributes.Normalize(await FieldsOfAsync(template, cancellationToken), request.Attributes);

        var options = request.Options ?? [];
        var variantRequests = request.Variants ?? [];
        var specs = variantRequests.Select(v => new VariantSpec(v.Values ?? [], v.PriceOverride, v.CostOverride, request.ExpiryDate)).ToList();
        if (options.Count == 0 && specs.Count == 0 && request.ExpiryDate is not null)
        {
            specs.Add(new VariantSpec([], expiryDate: request.ExpiryDate));
        }

        var product = Product.Create(
            businessId,
            request.Name,
            request.CategoryId,
            template.Code,
            request.SellingPrice,
            request.Cost,
            request.LowStockThreshold ?? profile.DefaultLowStockThreshold,
            attributes,
            options.Select(o => o.Name).ToList(),
            specs);

        // Variants are created in request order; the default variant of a simple product takes the single entry.
        var operationId = Entity.NewId();
        var now = clock.UtcNow;
        var variants = product.Variants.OrderBy(v => v.SortOrder).ToList();
        var movements = new List<StockMovement>();
        for (var i = 0; i < variantRequests.Count && i < variants.Count; i++)
        {
            if (variantRequests[i].OpeningQuantity > 0)
            {
                movements.Add(product.RecordOpeningStock(variants[i], variantRequests[i].OpeningQuantity, operationId, now));
            }
        }

        products.Add(product);
        products.AddMovements(movements);
        await unitOfWork.SaveChangesAsync(cancellationToken); // one transaction: product + variants + movements (D-096)
        return await GetAsync(product.Id, cancellationToken);
    }

    public async Task<ProductDetailsDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await LoadAsync(id, cancellationToken);
        var template = ProductTemplateCatalog.Find(request.TemplateCode)!;
        await EnsureCategoryAsync(request.CategoryId, product.CategoryId, cancellationToken);
        var attributes = ProductAttributes.Normalize(await FieldsOfAsync(template, cancellationToken), request.Attributes);

        product.UpdateDetails(
            request.Name,
            request.CategoryId,
            template.Code,
            request.SellingPrice,
            request.Cost,
            request.LowStockThreshold,
            attributes,
            request.OptionNames ?? product.OptionNames);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<ProductDetailsDto> SetArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken)
    {
        var product = await LoadAsync(id, cancellationToken);
        if (archived)
        {
            product.Archive();
        }
        else
        {
            product.Restore();
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<ProductDetailsDto> AddVariantAsync(Guid id, AddVariantRequest request, CancellationToken cancellationToken)
    {
        var product = await LoadAsync(id, cancellationToken);
        EnsureExpiryAllowed(ProductTemplateCatalog.Find(product.TemplateCode)!, request.ExpiryDate);
        var spec = new VariantSpec(request.Values, request.PriceOverride, request.CostOverride, request.ExpiryDate);

        ProductVariant variant;
        if (product.OptionNames.Count == 0)
        {
            if (request.OptionNames is not { Count: > 0 })
            {
                throw RequestValidationException.ForField("optionNames", "المنتج بسيط. حدد اسم الخيار (مثلًا المقاس) عشان تضيف نسخ.");
            }

            variant = product.ConvertToVariants(request.OptionNames, spec);
        }
        else
        {
            variant = product.AddVariant(spec);
        }

        if (request.OpeningQuantity > 0)
        {
            products.AddMovements([product.RecordOpeningStock(variant, request.OpeningQuantity, Entity.NewId(), clock.UtcNow)]);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<ProductDetailsDto> UpdateVariantAsync(Guid id, Guid variantId, UpdateVariantRequest request, CancellationToken cancellationToken)
    {
        var product = await LoadAsync(id, cancellationToken);
        EnsureVariant(product, variantId);
        EnsureExpiryAllowed(ProductTemplateCatalog.Find(product.TemplateCode)!, request.ExpiryDate);
        product.UpdateVariant(variantId, request.PriceOverride, request.CostOverride, request.ExpiryDate);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<ProductDetailsDto> SetVariantArchivedAsync(Guid id, Guid variantId, bool archived, CancellationToken cancellationToken)
    {
        var product = await LoadAsync(id, cancellationToken);
        EnsureVariant(product, variantId);
        if (archived)
        {
            product.ArchiveVariant(variantId);
        }
        else
        {
            product.RestoreVariant(variantId);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private async Task<Product> LoadAsync(Guid id, CancellationToken cancellationToken)
        => await products.GetForUpdateAsync(id, cancellationToken) ?? throw CatalogErrors.ProductNotFound();

    private static void EnsureVariant(Product product, Guid variantId)
    {
        if (product.Variants.All(v => v.Id != variantId))
        {
            throw CatalogErrors.VariantNotFound();
        }
    }

    /// <summary>A new category must be active and belong to the business; keeping the current one is always allowed.</summary>
    private async Task EnsureCategoryAsync(Guid? categoryId, Guid? currentCategoryId, CancellationToken cancellationToken)
    {
        if (categoryId is { } id && id != currentCategoryId && !await categories.ExistsActiveAsync(id, cancellationToken))
        {
            throw CatalogErrors.CategoryNotFound();
        }
    }

    private static void EnsureExpiryAllowed(ProductTemplate template, DateOnly? expiryDate)
    {
        if (expiryDate is not null && !template.SupportsExpiry)
        {
            throw RequestValidationException.ForField("expiryDate", "هذا القالب ما بيدعم تاريخ انتهاء.");
        }
    }

    private async Task<IReadOnlyList<TemplateField>> FieldsOfAsync(ProductTemplate template, CancellationToken cancellationToken)
    {
        var custom = await templateFields.ListAsync(template.Code, cancellationToken);
        return template.Fields.Concat(custom.Select(f => f.ToTemplateField())).ToList();
    }
}
