using System.Collections.Concurrent;
using System.Text;

namespace Lamma.Domain.Common;

/// <summary>
/// Maps enum members to the stable snake_case codes used in the database and the API
/// (e.g. <c>BankTransfer</c> ↔ <c>"bank_transfer"</c>).
/// </summary>
public static class EnumCode
{
    private static readonly ConcurrentDictionary<Type, (Dictionary<string, object> ByCode, Dictionary<object, string> ByValue)> Cache = new();

    public static string ToCode<TEnum>(this TEnum value)
        where TEnum : struct, Enum
        => Maps(typeof(TEnum)).ByValue.TryGetValue(value, out var code)
            ? code
            : throw new ArgumentOutOfRangeException(nameof(value), value, "Undefined enum value.");

    public static bool TryParse<TEnum>(string? code, out TEnum value)
        where TEnum : struct, Enum
    {
        if (code is not null && Maps(typeof(TEnum)).ByCode.TryGetValue(code, out var boxed))
        {
            value = (TEnum)boxed;
            return true;
        }

        value = default;
        return false;
    }

    public static TEnum Parse<TEnum>(string code)
        where TEnum : struct, Enum
        => TryParse<TEnum>(code, out var value)
            ? value
            : throw new ArgumentException($"Unknown code '{code}' for {typeof(TEnum).Name}.", nameof(code));

    public static IReadOnlyList<TEnum> All<TEnum>()
        where TEnum : struct, Enum
        => Enum.GetValues<TEnum>();

    public static string ToSnakeCase(string name)
    {
        var sb = new StringBuilder(name.Length + 4);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0)
                {
                    sb.Append('_');
                }

                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }

        return sb.ToString();
    }

    private static (Dictionary<string, object> ByCode, Dictionary<object, string> ByValue) Maps(Type type)
        => Cache.GetOrAdd(type, static t =>
        {
            var byCode = new Dictionary<string, object>(StringComparer.Ordinal);
            var byValue = new Dictionary<object, string>();
            foreach (var value in Enum.GetValues(t))
            {
                var code = ToSnakeCase(Enum.GetName(t, value)!);
                byCode[code] = value;
                byValue[value] = code;
            }

            return (byCode, byValue);
        });
}
