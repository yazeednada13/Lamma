using FluentValidation;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Catalog;

namespace Lamma.Application.Catalog;

/// <summary>Money input rules (D-080, D-097): at most 2 decimals and the catalog maximum.</summary>
internal static class MoneyInput
{
    public static bool IsValid(decimal amount, bool allowZero)
        => (allowZero ? amount >= 0 : amount > 0) && amount <= Product.MaxMoney && Math.Round(amount, 2) == amount;

    public static string Message(bool allowZero, string label)
        => allowZero
            ? $"{label} لازم تكون صفر أو أكثر، بخانتين عشريتين كحد أقصى."
            : $"{label} لازم يكون أكبر من صفر، بخانتين عشريتين كحد أقصى.";
}

internal static class CatalogMessages
{
    public const string ProductNameRequired = "اسم المنتج مطلوب.";
    public static readonly string ProductNameTooLong = $"اسم المنتج لازم يكون {Product.NameMaxLength} حرف أو أقل.";
    public const string TemplateInvalid = "اختار قالب من القائمة.";
    public static readonly string ThresholdInvalid = $"حد «قرب يخلص» لازم يكون بين 0 و {Product.LowStockThresholdMax}.";
    public static readonly string QuantityInvalid = $"الكمية لازم تكون بين 0 و {ProductVariant.MaxQuantity}.";
}

public sealed class CategoryRequestValidator : AbstractValidator<CategoryRequest>
{
    public CategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("اسم التصنيف مطلوب.")
            .Must(n => n is null || n.Trim().Length <= Category.NameMaxLength).WithMessage($"اسم التصنيف لازم يكون {Category.NameMaxLength} حرف أو أقل.");
    }
}

public sealed class TemplateFieldRequestValidator : AbstractValidator<TemplateFieldRequest>
{
    public TemplateFieldRequestValidator()
    {
        RuleFor(x => x.LabelAr)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("اسم الحقل مطلوب.")
            .Must(n => n is null || n.Trim().Length <= ProductTemplateCustomField.LabelMaxLength).WithMessage($"اسم الحقل لازم يكون {ProductTemplateCustomField.LabelMaxLength} حرف أو أقل.");
        RuleFor(x => x.Type).IsCodeOf<TemplateFieldRequest, TemplateFieldType>("نوع الحقل غير معروف.");
        RuleFor(x => x.Options)
            .Must(o => o is { Count: > 0 and <= ProductTemplateCustomField.MaxOptions }
                       && o.All(v => !string.IsNullOrWhiteSpace(v) && v.Trim().Length <= ProductTemplateCustomField.OptionMaxLength)
                       && o.Select(v => v.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() == o.Count)
            .When(x => x.Type == "select")
            .WithMessage($"حقل الاختيار لازم يكون فيه من 1 لـ {ProductTemplateCustomField.MaxOptions} خيارات مختلفة.");
    }
}

public sealed class ProductOptionRequestValidator : AbstractValidator<ProductOptionRequest>
{
    public ProductOptionRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n) && n.Trim().Length <= Product.AxisNameMaxLength)
            .WithMessage($"اسم الخيار لازم يكون من 1 لـ {Product.AxisNameMaxLength} حرف.");
        RuleFor(x => x.Values)
            .Must(v => v is { Count: > 0 and <= Product.MaxValuesPerAxis })
            .WithMessage($"لكل خيار من 1 لـ {Product.MaxValuesPerAxis} قيمة.")
            .Must(v => v is null || v.All(s => !string.IsNullOrWhiteSpace(s) && s.Trim().Length <= Product.OptionValueMaxLength))
            .WithMessage($"قيمة الخيار لازم تكون من 1 لـ {Product.OptionValueMaxLength} حرف.")
            .Must(v => v is null || v.Select(s => s?.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() == v.Count)
            .WithMessage("في قيمة مكررة.");
    }
}

public sealed class VariantRequestValidator : AbstractValidator<VariantRequest>
{
    public VariantRequestValidator()
    {
        RuleFor(x => x.OpeningQuantity).InclusiveBetween(0, ProductVariant.MaxQuantity).WithMessage(CatalogMessages.QuantityInvalid);
        RuleFor(x => x.PriceOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: false)).WithMessage(MoneyInput.Message(false, "سعر النسخة"));
        RuleFor(x => x.CostOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: true)).WithMessage(MoneyInput.Message(true, "تكلفة النسخة"));
    }
}

public sealed class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(CatalogMessages.ProductNameRequired)
            .Must(n => n is null || n.Trim().Length <= Product.NameMaxLength).WithMessage(CatalogMessages.ProductNameTooLong);
        RuleFor(x => x.TemplateCode).Must(c => c is null || ProductTemplateCatalog.Exists(c)).WithMessage(CatalogMessages.TemplateInvalid);
        RuleFor(x => x.SellingPrice).Must(v => MoneyInput.IsValid(v, allowZero: false)).WithMessage(MoneyInput.Message(false, "سعر البيع"));
        RuleFor(x => x.Cost).Must(v => MoneyInput.IsValid(v, allowZero: true)).WithMessage(MoneyInput.Message(true, "التكلفة"));
        RuleFor(x => x.LowStockThreshold)
            .Must(t => t is null or >= 0 and <= Product.LowStockThresholdMax).WithMessage(CatalogMessages.ThresholdInvalid);

        RuleFor(x => x.Options)
            .Must(o => o is null || o.Count <= Product.MaxAxes).WithMessage($"الحد الأقصى {Product.MaxAxes} خيارات للمنتج.")
            .Must(o => o is null || o.Select(a => a.Name?.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() == o.Count).WithMessage("في خيار مكرر.");
        RuleForEach(x => x.Options).SetValidator(new ProductOptionRequestValidator());

        RuleFor(x => x.Variants)
            .Must(v => v is null || v.Count <= Product.MaxVariants).WithMessage($"الحد الأقصى {Product.MaxVariants} نسخة للمنتج.");
        RuleForEach(x => x.Variants).SetValidator(new VariantRequestValidator());

        RuleFor(x => x)
            .Must(HaveConsistentVariants)
            .WithName("variants")
            .OverridePropertyName("variants")
            .WithMessage("النسخ لازم تطابق الخيارات: كل نسخة إلها قيمة من كل خيار، وبدون تكرار. المنتج اللي إله خيارات لازم يكون فيه نسخة وحدة على الأقل.");
    }

    private static bool HaveConsistentVariants(CreateProductRequest request)
    {
        var options = request.Options ?? [];
        var variants = request.Variants ?? [];
        if (options.Count == 0)
        {
            return variants.Count <= 1 && variants.All(v => v.Values is null || v.Values.Count == 0);
        }

        if (variants.Count == 0 || options.Any(o => o.Values is null))
        {
            return false;
        }

        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var variant in variants)
        {
            if (variant.Values is null || variant.Values.Count != options.Count)
            {
                return false;
            }

            for (var axis = 0; axis < options.Count; axis++)
            {
                if (!options[axis].Values.Any(v => string.Equals(v?.Trim(), variant.Values[axis]?.Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    return false;
                }
            }

            if (!keys.Add(string.Join("|", variant.Values.Select(v => v?.Trim()))))
            {
                return false;
            }
        }

        return true;
    }
}

public sealed class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(CatalogMessages.ProductNameRequired)
            .Must(n => n is null || n.Trim().Length <= Product.NameMaxLength).WithMessage(CatalogMessages.ProductNameTooLong);
        RuleFor(x => x.TemplateCode).Must(ProductTemplateCatalog.Exists).WithMessage(CatalogMessages.TemplateInvalid);
        RuleFor(x => x.SellingPrice).Must(v => MoneyInput.IsValid(v, allowZero: false)).WithMessage(MoneyInput.Message(false, "سعر البيع"));
        RuleFor(x => x.Cost).Must(v => MoneyInput.IsValid(v, allowZero: true)).WithMessage(MoneyInput.Message(true, "التكلفة"));
        RuleFor(x => x.LowStockThreshold).InclusiveBetween(0, Product.LowStockThresholdMax).WithMessage(CatalogMessages.ThresholdInvalid);
        RuleFor(x => x.OptionNames)
            .Must(n => n is null || (n.Count <= Product.MaxAxes && n.All(s => !string.IsNullOrWhiteSpace(s) && s.Trim().Length <= Product.AxisNameMaxLength)))
            .WithMessage($"اسم الخيار لازم يكون من 1 لـ {Product.AxisNameMaxLength} حرف.");
    }
}

public sealed class AddVariantRequestValidator : AbstractValidator<AddVariantRequest>
{
    public AddVariantRequestValidator()
    {
        RuleFor(x => x.Values)
            .Must(v => v is { Count: > 0 and <= Product.MaxAxes } && v.All(s => !string.IsNullOrWhiteSpace(s) && s.Trim().Length <= Product.OptionValueMaxLength))
            .WithMessage($"لازم تحدد قيمة لكل خيار (من 1 لـ {Product.OptionValueMaxLength} حرف).");
        RuleFor(x => x.OpeningQuantity).InclusiveBetween(0, ProductVariant.MaxQuantity).WithMessage(CatalogMessages.QuantityInvalid);
        RuleFor(x => x.PriceOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: false)).WithMessage(MoneyInput.Message(false, "سعر النسخة"));
        RuleFor(x => x.CostOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: true)).WithMessage(MoneyInput.Message(true, "تكلفة النسخة"));
        RuleFor(x => x.OptionNames)
            .Must((request, names) => names is null || (names.Count == request.Values?.Count && names.All(s => !string.IsNullOrWhiteSpace(s) && s.Trim().Length <= Product.AxisNameMaxLength)))
            .WithMessage("لازم يكون لكل قيمة اسم خيار.");
    }
}

public sealed class UpdateVariantRequestValidator : AbstractValidator<UpdateVariantRequest>
{
    public UpdateVariantRequestValidator()
    {
        RuleFor(x => x.PriceOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: false)).WithMessage(MoneyInput.Message(false, "سعر النسخة"));
        RuleFor(x => x.CostOverride).Must(v => v is null || MoneyInput.IsValid(v.Value, allowZero: true)).WithMessage(MoneyInput.Message(true, "تكلفة النسخة"));
    }
}

public sealed class ProductListQueryValidator : AbstractValidator<ProductListQuery>
{
    public static readonly string[] Sorts = ["-createdAt", "createdAt", "name", "-name", "available", "-available"];

    public ProductListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل كثير.");
        RuleFor(x => x.StockStatus).Must(s => s is null or "in" or "low" or "out").WithMessage("حالة المخزون غير معروفة.");
        RuleFor(x => x.Sort).Must(s => s is null || Sorts.Contains(s)).WithMessage("الترتيب غير معروف.");
    }
}
