using System.Text.Json;
using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>A business's own descriptive field added to a system template (D-092).</summary>
public sealed class ProductTemplateCustomField : Entity, IBusinessOwned, IHasTimestamps
{
    public const int MaxPerTemplate = 20;
    public const int LabelMaxLength = 40;
    public const int MaxOptions = 20;
    public const int OptionMaxLength = 40;
    public const string KeyPrefix = "c_";

    private ProductTemplateCustomField(Guid id, Guid businessId, string templateCode, string key)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
        TemplateCode = templateCode;
        Key = key;
    }

    private ProductTemplateCustomField()
    {
    }

    public Guid BusinessId { get; private set; }

    public string TemplateCode { get; private set; } = string.Empty;

    /// <summary>Stable key used in product attributes (e.g. "c_1a2b3c4d").</summary>
    public string Key { get; private set; } = string.Empty;

    public string LabelAr { get; private set; } = string.Empty;

    public TemplateFieldType FieldType { get; private set; }

    /// <summary>JSON array of options (select fields only; "[]" otherwise).</summary>
    public string OptionsJson { get; private set; } = "[]";

    public bool IsRequired { get; private set; }

    public int SortOrder { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyList<string> Options => JsonSerializer.Deserialize<string[]>(OptionsJson) ?? [];

    public static ProductTemplateCustomField Create(Guid businessId, string templateCode, string labelAr, TemplateFieldType type, IReadOnlyList<string> options, bool isRequired, int sortOrder)
    {
        if (!ProductTemplateCatalog.Exists(templateCode))
        {
            throw new DomainException("template.not_found", "القالب غير معروف.");
        }

        var field = new ProductTemplateCustomField(NewId(), businessId, templateCode, KeyPrefix + Guid.NewGuid().ToString("N")[..8]) { SortOrder = sortOrder };
        field.Update(labelAr, type, options, isRequired);
        return field;
    }

    public void Update(string labelAr, TemplateFieldType type, IReadOnlyList<string> options, bool isRequired)
    {
        var label = Guard.NotBlank(labelAr, nameof(labelAr)).Trim();
        if (label.Length > LabelMaxLength)
        {
            throw new DomainException("template.field_label_too_long", $"اسم الحقل لازم يكون {LabelMaxLength} حرف أو أقل.");
        }

        var cleaned = (options ?? []).Select(o => o.Trim()).Where(o => o.Length > 0).ToArray();
        if (type == TemplateFieldType.Select)
        {
            if (cleaned.Length == 0 || cleaned.Length > MaxOptions || cleaned.Any(o => o.Length > OptionMaxLength)
                || cleaned.Distinct(StringComparer.OrdinalIgnoreCase).Count() != cleaned.Length)
            {
                throw new DomainException("template.field_invalid_options", $"حقل الاختيار لازم يكون فيه من 1 لـ {MaxOptions} خيارات مختلفة.");
            }
        }
        else
        {
            cleaned = [];
        }

        LabelAr = label;
        FieldType = type;
        OptionsJson = JsonSerializer.Serialize(cleaned);
        IsRequired = isRequired;
    }

    public TemplateField ToTemplateField() => new(Key, LabelAr, FieldType, Options, IsRequired, isCustom: true);
}
