using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>Stock status shown for products and variants (D-099). Codes: in, low, out.</summary>
public enum StockStatus
{
    In,
    Low,
    Out,
}

public static class StockStatusRules
{
    /// <summary>
    /// Variants are shown as "low" when one piece or less is left: the prototype's heatmap rule.
    /// The product-level threshold applies to the product total (D-099).
    /// </summary>
    public const int VariantLowThreshold = 1;

    public static StockStatus For(int available, int lowStockThreshold)
        => available <= 0 ? StockStatus.Out : available <= lowStockThreshold ? StockStatus.Low : StockStatus.In;
}

/// <summary>
/// One sellable combination of a product (e.g. M · زيتي). The default variant of a simple product has no option values.
/// Stock always lives here (D-090). OnHand/Reserved are an operational cache of the StockMovement log.
/// </summary>
public sealed class ProductVariant : Entity, IBusinessOwned
{
    public const int MaxQuantity = 100_000;
    public const string OptionsKeySeparator = "|";

    internal ProductVariant(Guid id, Guid businessId, Guid productId, int sortOrder, string? option1Value, string? option2Value, decimal? priceOverride, decimal? costOverride, DateOnly? expiryDate)
        : base(id)
    {
        BusinessId = businessId;
        SortOrder = sortOrder;
        ProductId = productId;
        Option1Value = option1Value;
        Option2Value = option2Value;
        OptionsKey = BuildOptionsKey(new[] { option1Value, option2Value }.Where(v => v is not null).Select(v => v!).ToList());
        PriceOverride = priceOverride;
        CostOverride = costOverride;
        ExpiryDate = expiryDate;
    }

    private ProductVariant()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid ProductId { get; private set; }

    /// <summary>Creation order within the product (matrix display order).</summary>
    public int SortOrder { get; private set; }

    public string? Option1Value { get; private set; }

    public string? Option2Value { get; private set; }

    /// <summary>Normalized combination key, unique per product ("" for the default variant).</summary>
    public string OptionsKey { get; private set; } = string.Empty;

    public decimal? PriceOverride { get; private set; }

    public decimal? CostOverride { get; private set; }

    public int OnHand { get; private set; }

    public int Reserved { get; private set; }

    public DateOnly? ExpiryDate { get; private set; }

    public bool IsArchived { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public bool IsDefault => Option1Value is null;

    public int Available => OnHand - Reserved;

    public IReadOnlyList<string> Values => new[] { Option1Value, Option2Value }.Where(v => v is not null).Select(v => v!).ToList();

    public static string BuildOptionsKey(IReadOnlyList<string> values)
        => string.Join(OptionsKeySeparator, values.Select(v => v.Trim().ToLowerInvariant()));

    internal string? ValueAt(int axis) => axis == 0 ? Option1Value : Option2Value;

    internal void SetOverrides(decimal? priceOverride, decimal? costOverride, DateOnly? expiryDate)
    {
        PriceOverride = priceOverride;
        CostOverride = costOverride;
        ExpiryDate = expiryDate;
    }

    internal void SetArchived(bool archived) => IsArchived = archived;

    internal void SetCost(decimal cost) => CostOverride = cost;

    internal void SetExpiry(DateOnly? expiryDate) => ExpiryDate = expiryDate;

    internal void ApplyOnHand(int delta)
    {
        var result = OnHand + delta;
        if (result < 0 || result > MaxQuantity)
        {
            throw new DomainException("stock.invalid_quantity", "الكمية بالمخزون ما بتصير أقل من صفر.");
        }

        OnHand = result;
    }

    /// <summary>
    /// Applies an order's stock effect (D-024–D-026). Keeps 0 ≤ Reserved ≤ OnHand; the caller checks Available first.
    /// </summary>
    internal void ApplyOrderEffect(int onHandDelta, int reservedDelta)
    {
        var onHand = OnHand + onHandDelta;
        var reserved = Reserved + reservedDelta;
        if (onHand < 0 || reserved < 0 || reserved > onHand || onHand > MaxQuantity)
        {
            throw new DomainConflictException("stock.not_available", "الكمية المتوفرة ما بتكفي.");
        }

        OnHand = onHand;
        Reserved = reserved;
    }
}
