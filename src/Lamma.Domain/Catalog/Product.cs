using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>Option values and price/cost overrides of one variant to create.</summary>
public sealed class VariantSpec
{
    public VariantSpec(IReadOnlyList<string> values, decimal? priceOverride = null, decimal? costOverride = null, DateOnly? expiryDate = null)
    {
        Values = values;
        PriceOverride = priceOverride;
        CostOverride = costOverride;
        ExpiryDate = expiryDate;
    }

    public IReadOnlyList<string> Values { get; }

    public decimal? PriceOverride { get; }

    public decimal? CostOverride { get; }

    public DateOnly? ExpiryDate { get; }
}

/// <summary>
/// Product aggregate root: details, template attributes, 0–2 option axes and its variants.
/// Every product has at least one active variant (D-090). Never hard-deleted (D-100).
/// </summary>
public sealed class Product : Entity, IBusinessOwned, IHasTimestamps
{
    public const int NameMaxLength = 120;
    public const int MaxAxes = 2;
    public const int AxisNameMaxLength = 30;
    public const int OptionValueMaxLength = 40;
    public const int MaxValuesPerAxis = 20;
    public const int MaxVariants = 100;
    public const int LowStockThresholdMax = 1000;
    public const int ImagePathMaxLength = 400;
    public const decimal MaxMoney = 999_999.99m;

    private readonly List<ProductVariant> _variants = [];

    private Product(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private Product()
    {
    }

    public Guid BusinessId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public Guid? CategoryId { get; private set; }

    public string TemplateCode { get; private set; } = ProductTemplateCatalog.Other;

    public decimal SellingPrice { get; private set; }

    public decimal Cost { get; private set; }

    public int LowStockThreshold { get; private set; }

    /// <summary>Descriptive template fields (validated against the template in Application).</summary>
    public string AttributesJson { get; private set; } = "{}";

    public string? Option1Name { get; private set; }

    public string? Option2Name { get; private set; }

    /// <summary>Relative storage path of the product image (D-094), or null.</summary>
    public string? ImagePath { get; private set; }

    public bool IsArchived { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<ProductVariant> Variants => _variants;

    public IReadOnlyList<string> OptionNames => new[] { Option1Name, Option2Name }.Where(n => n is not null).Select(n => n!).ToList();

    public IEnumerable<ProductVariant> ActiveVariants => _variants.Where(v => !v.IsArchived);

    /// <summary>
    /// Creates a product. With no axes, the single default variant is created (D-090) and <paramref name="variants"/>
    /// may hold at most one spec without values. With axes, at least one variant is required (D-093).
    /// </summary>
    public static Product Create(
        Guid businessId,
        string name,
        Guid? categoryId,
        string templateCode,
        decimal sellingPrice,
        decimal cost,
        int lowStockThreshold,
        string attributesJson,
        IReadOnlyList<string> optionNames,
        IReadOnlyList<VariantSpec> variants)
    {
        var product = new Product(NewId(), businessId);
        product.SetDetails(name, categoryId, templateCode, sellingPrice, cost, lowStockThreshold, attributesJson);
        product.SetAxes(optionNames);

        if (product.OptionNames.Count == 0)
        {
            if (variants.Count > 1 || variants.Any(v => v.Values.Count > 0))
            {
                throw new DomainException("product.variants_without_options", "المنتج البسيط ما إله نسخ.");
            }

            var spec = variants.Count == 1 ? variants[0] : new VariantSpec([]);
            product.AddVariantInternal(spec);
        }
        else
        {
            if (variants.Count == 0)
            {
                throw new DomainException("product.variant_required", "أضف نسخة وحدة على الأقل.");
            }

            foreach (var spec in variants)
            {
                product.AddVariantInternal(spec);
            }
        }

        return product;
    }

    public void UpdateDetails(string name, Guid? categoryId, string templateCode, decimal sellingPrice, decimal cost, int lowStockThreshold, string attributesJson, IReadOnlyList<string> optionNames)
    {
        if (optionNames.Count != OptionNames.Count)
        {
            throw new DomainException("product.axes_fixed", "ما بتقدر تضيف أو تشيل خيار بعد إنشاء المنتج، بس بتقدر تغيّر اسمه.");
        }

        SetDetails(name, categoryId, templateCode, sellingPrice, cost, lowStockThreshold, attributesJson);
        SetAxes(optionNames);
    }

    /// <summary>Adds a variant to a product that already has option axes.</summary>
    public ProductVariant AddVariant(VariantSpec spec)
    {
        if (OptionNames.Count == 0)
        {
            throw new DomainException("product.no_options", "المنتج ما إله خيارات (مقاسات/ألوان). حدد الخيارات أول.");
        }

        return AddVariantInternal(spec);
    }

    /// <summary>
    /// Turns a simple product into one with option axes: the default variant is archived and the first variant added.
    /// Allowed only while the default variant holds no stock (D-090 conversion rule).
    /// </summary>
    public ProductVariant ConvertToVariants(IReadOnlyList<string> optionNames, VariantSpec firstVariant)
    {
        if (OptionNames.Count > 0)
        {
            throw new DomainException("product.already_has_options", "المنتج إله خيارات من قبل.");
        }

        if (optionNames.Count == 0)
        {
            throw new DomainException("product.option_names_required", "حدد اسم الخيار (مثلًا المقاس).");
        }

        var defaultVariant = _variants.Single(v => v.IsDefault);
        if (defaultVariant.OnHand != 0 || defaultVariant.Reserved != 0)
        {
            throw new DomainConflictException("product.convert_has_stock", "المنتج فيه مخزون. ما بتقدر تحوّله لنسخ إلا لما يكون مخزونه صفر.");
        }

        SetAxes(optionNames);
        try
        {
            var added = AddVariantInternal(firstVariant);
            defaultVariant.SetArchived(true);
            return added;
        }
        catch
        {
            SetAxes([]); // leave the aggregate unchanged when the first variant is rejected
            throw;
        }
    }

    public ProductVariant UpdateVariant(Guid variantId, decimal? priceOverride, decimal? costOverride, DateOnly? expiryDate)
    {
        var variant = FindVariant(variantId);
        variant.SetOverrides(ValidOptionalMoney(priceOverride, mustBePositive: true), ValidOptionalMoney(costOverride, mustBePositive: false), expiryDate);
        return variant;
    }

    public void ArchiveVariant(Guid variantId)
    {
        var variant = FindVariant(variantId);
        if (variant.IsArchived)
        {
            return;
        }

        if (ActiveVariants.Count() == 1)
        {
            throw new DomainConflictException("product.last_variant", "ما بتقدر تأرشف آخر نسخة بالمنتج. أرشف المنتج نفسه.");
        }

        variant.SetArchived(true);
    }

    public void RestoreVariant(Guid variantId)
    {
        var variant = FindVariant(variantId);
        if (!variant.IsArchived)
        {
            return;
        }

        if (variant.IsDefault && OptionNames.Count > 0)
        {
            throw new DomainConflictException("product.default_variant_retired", "هاي النسخة انلغت لما انضافت الخيارات للمنتج.");
        }

        if (ActiveVariants.Count() >= MaxVariants)
        {
            throw new DomainConflictException("product.too_many_variants", $"الحد الأقصى {MaxVariants} نسخة للمنتج.");
        }

        variant.SetArchived(false);
    }

    public void Archive() => IsArchived = true;

    public void Restore() => IsArchived = false;

    /// <summary>Sets a new image path and returns the previous one (to delete after commit).</summary>
    public string? SetImage(string path)
    {
        Guard.NotBlank(path, nameof(path));
        var previous = ImagePath;
        ImagePath = path;
        return previous;
    }

    public string? RemoveImage()
    {
        var previous = ImagePath;
        ImagePath = null;
        return previous;
    }

    /// <summary>
    /// Records the opening quantity of a new variant as a <c>receive</c> movement with reference kind <c>opening</c> (D-096).
    /// </summary>
    public StockMovement RecordOpeningStock(ProductVariant variant, int quantity, Guid operationId, DateTime nowUtc)
    {
        if (!_variants.Contains(variant))
        {
            throw new InvalidOperationException("The variant does not belong to this product.");
        }

        if (quantity <= 0 || quantity > ProductVariant.MaxQuantity)
        {
            throw new DomainException("product.invalid_opening_quantity", $"الكمية الافتتاحية لازم تكون بين 1 و {ProductVariant.MaxQuantity}.");
        }

        variant.ApplyOnHand(quantity);
        return StockMovement.Opening(BusinessId, Id, variant.Id, quantity, EffectiveCost(variant), operationId, nowUtc);
    }

    public decimal EffectivePrice(ProductVariant variant) => variant.PriceOverride ?? SellingPrice;

    public decimal EffectiveCost(ProductVariant variant) => variant.CostOverride ?? Cost;

    private ProductVariant FindVariant(Guid variantId)
        => _variants.FirstOrDefault(v => v.Id == variantId)
           ?? throw new DomainException("product.variant_not_found", "النسخة مش موجودة.");

    private ProductVariant AddVariantInternal(VariantSpec spec)
    {
        var names = OptionNames;
        var values = (spec.Values ?? []).Select(v => v?.Trim() ?? string.Empty).ToList();
        if (values.Count != names.Count)
        {
            throw new DomainException("product.variant_values_mismatch", "لازم تحدد قيمة لكل خيار.");
        }

        if (values.Any(v => v.Length == 0 || v.Length > OptionValueMaxLength))
        {
            throw new DomainException("product.invalid_option_value", $"قيمة الخيار لازم تكون من 1 لـ {OptionValueMaxLength} حرف.");
        }

        var key = ProductVariant.BuildOptionsKey(values);
        if (_variants.Any(v => v.OptionsKey == key))
        {
            throw new DomainConflictException("product.duplicate_variant", "هاي النسخة موجودة من قبل.");
        }

        if (ActiveVariants.Count() >= MaxVariants)
        {
            throw new DomainConflictException("product.too_many_variants", $"الحد الأقصى {MaxVariants} نسخة للمنتج.");
        }

        for (var axis = 0; axis < values.Count; axis++)
        {
            var distinct = _variants.Where(v => !v.IsDefault).Select(v => v.ValueAt(axis)).Append(values[axis])
                .Distinct(StringComparer.OrdinalIgnoreCase).Count();
            if (distinct > MaxValuesPerAxis)
            {
                throw new DomainException("product.too_many_values", $"الحد الأقصى {MaxValuesPerAxis} قيمة لكل خيار.");
            }
        }

        var variant = new ProductVariant(
            NewId(),
            BusinessId,
            Id,
            _variants.Count,
            values.ElementAtOrDefault(0),
            values.ElementAtOrDefault(1),
            ValidOptionalMoney(spec.PriceOverride, mustBePositive: true),
            ValidOptionalMoney(spec.CostOverride, mustBePositive: false),
            spec.ExpiryDate);
        _variants.Add(variant);
        return variant;
    }

    private void SetDetails(string name, Guid? categoryId, string templateCode, decimal sellingPrice, decimal cost, int lowStockThreshold, string attributesJson)
    {
        var trimmed = Guard.NotBlank(name, nameof(name)).Trim();
        if (trimmed.Length > NameMaxLength)
        {
            throw new DomainException("product.name_too_long", $"اسم المنتج لازم يكون {NameMaxLength} حرف أو أقل.");
        }

        if (!ProductTemplateCatalog.Exists(templateCode))
        {
            throw new DomainException("template.not_found", "القالب غير معروف.");
        }

        if (lowStockThreshold < 0 || lowStockThreshold > LowStockThresholdMax)
        {
            throw new DomainException("product.invalid_low_stock_threshold", $"حد «قرب يخلص» لازم يكون بين 0 و {LowStockThresholdMax}.");
        }

        Name = trimmed;
        CategoryId = categoryId;
        TemplateCode = templateCode;
        SellingPrice = ValidMoney(sellingPrice, mustBePositive: true);
        Cost = ValidMoney(cost, mustBePositive: false);
        LowStockThreshold = lowStockThreshold;
        AttributesJson = string.IsNullOrWhiteSpace(attributesJson) ? "{}" : attributesJson;
    }

    private void SetAxes(IReadOnlyList<string> optionNames)
    {
        var names = (optionNames ?? []).Select(n => n?.Trim() ?? string.Empty).ToList();
        if (names.Count > MaxAxes)
        {
            throw new DomainException("product.too_many_axes", $"الحد الأقصى {MaxAxes} خيارات للمنتج.");
        }

        if (names.Any(n => n.Length == 0 || n.Length > AxisNameMaxLength))
        {
            throw new DomainException("product.invalid_axis_name", $"اسم الخيار لازم يكون من 1 لـ {AxisNameMaxLength} حرف.");
        }

        if (names.Distinct(StringComparer.OrdinalIgnoreCase).Count() != names.Count)
        {
            throw new DomainException("product.duplicate_axis_name", "في خيار مكرر.");
        }

        Option1Name = names.ElementAtOrDefault(0);
        Option2Name = names.ElementAtOrDefault(1);
    }

    private static decimal ValidMoney(decimal amount, bool mustBePositive)
    {
        if ((mustBePositive ? amount <= 0 : amount < 0) || amount > MaxMoney || !MoneyMath.HasValidScale(amount))
        {
            throw new DomainException("product.invalid_amount", mustBePositive ? "السعر لازم يكون أكبر من صفر." : "التكلفة لازم تكون صفر أو أكثر.");
        }

        return amount;
    }

    private static decimal? ValidOptionalMoney(decimal? amount, bool mustBePositive)
        => amount is null ? null : ValidMoney(amount.Value, mustBePositive);
}
