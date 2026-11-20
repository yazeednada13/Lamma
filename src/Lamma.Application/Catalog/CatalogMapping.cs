using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Application.Catalog;

/// <summary>Builds catalog DTOs from domain read models (server-computed figures only).</summary>
public static class CatalogMapping
{
    public const string ImageRoute = "/api/v1/products/{0}/image?v={1}";

    /// <summary>Image URL with a version (the stored file name), so browsers can cache it safely.</summary>
    public static string? ImageUrl(Guid productId, string? imagePath)
        => imagePath is null ? null : string.Format(System.Globalization.CultureInfo.InvariantCulture, ImageRoute, productId, Path.GetFileNameWithoutExtension(imagePath));

    public static string VariantLabel(ProductVariant variant) => variant.IsDefault ? "—" : string.Join(" · ", variant.Values);

    public static TemplateFieldDto ToDto(TemplateField field)
        => new(field.Key, field.LabelAr, field.Type.ToCode(), field.Options, field.IsRequired, field.IsCustom);

    public static ProductTemplateDto ToDto(ProductTemplate template, IEnumerable<TemplateField> customFields)
        => new(
            template.Code,
            template.NameAr,
            template.SupportsExpiry,
            template.SupportsGiftBox,
            template.DefaultAxes.Select(a => new TemplateAxisDto(a.Name, a.SuggestedValues)).ToList(),
            template.Fields.Concat(customFields).Select(ToDto).ToList());

    public static ProductDetailsDto ToDetails(ProductDetailsRow row)
    {
        var product = row.Product;
        var active = product.ActiveVariants.OrderBy(v => v.SortOrder).ToList();
        var onHand = active.Sum(v => v.OnHand);
        var reserved = active.Sum(v => v.Reserved);
        var available = onHand - reserved;
        var prices = active.Select(product.EffectivePrice).DefaultIfEmpty(product.SellingPrice).ToList();
        var margin = product.SellingPrice - product.Cost;
        var marginPercent = product.SellingPrice == 0 ? 0 : Math.Round(margin / product.SellingPrice * 100, 1, MidpointRounding.AwayFromZero);

        var options = product.OptionNames
            .Select((name, axis) => new ProductOptionDto(
                name,
                active.Where(v => !v.IsDefault).Select(v => v.Values[axis]).Distinct(StringComparer.OrdinalIgnoreCase).ToList()))
            .ToList();

        var variantLabels = product.Variants.ToDictionary(v => v.Id, VariantLabel);
        var variants = product.Variants
            .OrderBy(v => v.IsArchived)
            .ThenBy(v => v.SortOrder)
            .Select(v => new VariantDto(
                v.Id,
                v.Values,
                VariantLabel(v),
                product.EffectivePrice(v),
                product.EffectiveCost(v),
                v.PriceOverride,
                v.CostOverride,
                v.OnHand,
                v.Reserved,
                v.Available,
                StockStatusRules.For(v.Available, StockStatusRules.VariantLowThreshold).ToCode(),
                v.ExpiryDate,
                v.IsArchived,
                v.IsDefault))
            .ToList();

        var movements = row.RecentMovements
            .Select(m => new StockMovementDto(
                m.Id,
                m.VariantId,
                variantLabels.GetValueOrDefault(m.VariantId, "—"),
                m.Type.ToCode(),
                m.ReferenceKind?.ToCode(),
                m.ReferenceLabel,
                m.OnHandDelta,
                m.ReservedDelta,
                m.UnitCost,
                m.IsAutomatic,
                m.CreatedAt))
            .ToList();

        return new ProductDetailsDto(
            product.Id,
            product.Name,
            product.CategoryId,
            row.CategoryName,
            product.TemplateCode,
            ImageUrl(product.Id, product.ImagePath),
            product.SellingPrice,
            product.Cost,
            margin,
            marginPercent,
            prices.Min(),
            prices.Max(),
            product.LowStockThreshold,
            onHand,
            reserved,
            available,
            StockStatusRules.For(available, product.LowStockThreshold).ToCode(),
            row.Sold,
            product.IsArchived,
            ProductAttributes.Read(product.AttributesJson),
            options,
            variants,
            movements,
            product.CreatedAt,
            product.UpdatedAt);
    }
}
