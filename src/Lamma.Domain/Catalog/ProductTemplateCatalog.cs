using Lamma.Domain.Businesses;

namespace Lamma.Domain.Catalog;

/// <summary>Type of a descriptive template field. Codes: text, number, select, date.</summary>
public enum TemplateFieldType
{
    Text,
    Number,
    Select,
    Date,
}

/// <summary>A default variant axis of a template (e.g. المقاس with suggested sizes).</summary>
public sealed class TemplateAxis
{
    public TemplateAxis(string name, IReadOnlyList<string> suggestedValues)
    {
        Name = name;
        SuggestedValues = suggestedValues;
    }

    public string Name { get; }

    public IReadOnlyList<string> SuggestedValues { get; }
}

/// <summary>A descriptive field of a template (system field, or a business's custom field).</summary>
public sealed class TemplateField
{
    public TemplateField(string key, string labelAr, TemplateFieldType type, IReadOnlyList<string> options, bool isRequired, bool isCustom)
    {
        Key = key;
        LabelAr = labelAr;
        Type = type;
        Options = options;
        IsRequired = isRequired;
        IsCustom = isCustom;
    }

    public string Key { get; }

    public string LabelAr { get; }

    public TemplateFieldType Type { get; }

    public IReadOnlyList<string> Options { get; }

    public bool IsRequired { get; }

    public bool IsCustom { get; }
}

/// <summary>A system product template (D-091). Fixed, defined in code (D-092).</summary>
public sealed class ProductTemplate
{
    public ProductTemplate(string code, string nameAr, bool supportsExpiry, bool supportsGiftBox, IReadOnlyList<TemplateAxis> defaultAxes, IReadOnlyList<TemplateField> fields)
    {
        Code = code;
        NameAr = nameAr;
        SupportsExpiry = supportsExpiry;
        SupportsGiftBox = supportsGiftBox;
        DefaultAxes = defaultAxes;
        Fields = fields;
    }

    public string Code { get; }

    public string NameAr { get; }

    public bool SupportsExpiry { get; }

    /// <summary>Capability flag only; gift-box behaviour is not built in Phase 2 (D-102).</summary>
    public bool SupportsGiftBox { get; }

    public IReadOnlyList<TemplateAxis> DefaultAxes { get; }

    public IReadOnlyList<TemplateField> Fields { get; }
}

/// <summary>The six system templates and the business type → default template map (D-091).</summary>
public static class ProductTemplateCatalog
{
    public const string Clothing = "clothing";
    public const string Perfume = "perfume";
    public const string Beauty = "beauty";
    public const string Jewelry = "jewelry";
    public const string Gift = "gift";
    public const string Other = "other";

    private static readonly string[] NoValues = [];

    private static TemplateField Field(string key, string label, TemplateFieldType type, params string[] options)
        => new(key, label, type, options, isRequired: false, isCustom: false);

    public static readonly IReadOnlyList<ProductTemplate> All =
    [
        new(Clothing, "ملابس", false, false,
            [new("المقاس", ["XS", "S", "M", "L", "XL", "XXL"]), new("اللون", ["زيتي", "كريمي", "طوبي", "أسود", "سماوي"])],
            [Field("fabric", "الخامة", TemplateFieldType.Text), Field("gender", "الفئة", TemplateFieldType.Select, "نسائي", "رجالي", "أطفال", "للجنسين"), Field("cut", "القصّة", TemplateFieldType.Text)]),
        new(Perfume, "عطور", false, false, [new("الحجم", ["10 مل", "50 مل", "100 مل"])], []),
        new(Beauty, "تجميل", true, false, [new("الدرجة", NoValues)], []),
        new(Jewelry, "إكسسوارات", false, false, [], [Field("material", "الخامة", TemplateFieldType.Text), Field("weight", "الوزن بالغرام", TemplateFieldType.Number)]),
        new(Gift, "بوكس هدايا", false, true, [], [Field("contents", "المكوّنات", TemplateFieldType.Text)]),
        new(Other, "عام", false, false, [], []),
    ];

    public static ProductTemplate? Find(string? code) => All.FirstOrDefault(t => t.Code == code);

    public static bool Exists(string? code) => Find(code) is not null;

    /// <summary>Default template for a business type (prototype mapping, D-091).</summary>
    public static string DefaultFor(BusinessType type) => type switch
    {
        BusinessType.Clothing or BusinessType.Kids => Clothing,
        BusinessType.Perfume => Perfume,
        BusinessType.Beauty => Beauty,
        BusinessType.Accessories => Jewelry,
        BusinessType.Gifts => Gift,
        _ => Other,
    };
}
