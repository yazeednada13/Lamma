using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Lamma.Application.Common;
using Lamma.Domain.Catalog;

namespace Lamma.Application.Catalog;

/// <summary>
/// Validates and normalizes a product's descriptive attributes against its template's fields (D-105, plan 2.A5).
/// Values travel as strings: text ≤ 200, number (invariant decimal), select ∈ options, date yyyy-MM-dd.
/// </summary>
public static class ProductAttributes
{
    public const int TextMaxLength = 200;
    public const int MaxAttributes = 40;

    private static readonly JsonSerializerOptions Json = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>Returns the normalized JSON, or throws <see cref="RequestValidationException"/> with <c>attributes.{key}</c> errors.</summary>
    public static string Normalize(IReadOnlyList<TemplateField> fields, IReadOnlyDictionary<string, string?>? input)
    {
        var errors = new Dictionary<string, string[]>();
        var result = new SortedDictionary<string, string>(StringComparer.Ordinal);
        var byKey = fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        input ??= new Dictionary<string, string?>();

        if (input.Count > MaxAttributes)
        {
            throw RequestValidationException.ForField("attributes", "في حقول كثيرة.");
        }

        foreach (var (key, raw) in input)
        {
            var path = $"attributes.{key}";
            if (!byKey.TryGetValue(key, out var field))
            {
                errors[path] = ["هذا الحقل مش موجود بقالب المنتج."];
                continue;
            }

            var value = raw?.Trim();
            if (string.IsNullOrEmpty(value))
            {
                continue;
            }

            var (normalized, error) = NormalizeValue(field, value);
            if (error is not null)
            {
                errors[path] = [error];
            }
            else
            {
                result[key] = normalized!;
            }
        }

        foreach (var field in fields.Where(f => f.IsRequired && !result.ContainsKey(f.Key) && !errors.ContainsKey($"attributes.{f.Key}")))
        {
            errors[$"attributes.{field.Key}"] = [$"«{field.LabelAr}» مطلوب."];
        }

        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors);
        }

        return JsonSerializer.Serialize(result, Json);
    }

    public static IReadOnlyDictionary<string, string> Read(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();

    private static (string? Value, string? Error) NormalizeValue(TemplateField field, string value) => field.Type switch
    {
        TemplateFieldType.Text => value.Length <= TextMaxLength ? (value, null) : (null, $"النص لازم يكون {TextMaxLength} حرف أو أقل."),
        TemplateFieldType.Number => decimal.TryParse(value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var number)
            ? (number.ToString(CultureInfo.InvariantCulture), null)
            : (null, "اكتب رقم صحيح."),
        TemplateFieldType.Select => field.Options.Contains(value, StringComparer.Ordinal) ? (value, null) : (null, "اختار قيمة من القائمة."),
        TemplateFieldType.Date => DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? (date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), null)
            : (null, "اكتب تاريخ صحيح."),
        _ => (null, "نوع الحقل غير معروف."),
    };
}
