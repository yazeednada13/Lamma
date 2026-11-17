using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Lamma.Domain.Common;

namespace Lamma.Application.Common.Serialization;

/// <summary>
/// Money on the wire (API-DESIGN §7, P-005): a JSON string with exactly 3 decimals, e.g. "38.000".
/// Reading accepts "38", "38.5", "38.500" and rejects more than 3 decimals, numbers, and negatives are left to validators.
/// Apply with <c>[JsonConverter(typeof(MoneyJsonConverter))]</c> on money properties.
/// </summary>
public sealed class MoneyJsonConverter : JsonConverter<decimal>
{
    public static string Format(decimal amount) => MoneyMath.Round(amount).ToString("0.000", CultureInfo.InvariantCulture);

    public static bool TryParse(string? text, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(text) || text.Length > 24)
        {
            return false;
        }

        if (!decimal.TryParse(text, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value))
        {
            return false;
        }

        if (!MoneyMath.HasValidScale(value))
        {
            return false;
        }

        amount = value;
        return true;
    }

    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("Money must be a string such as \"38.500\".");
        }

        return TryParse(reader.GetString(), out var amount)
            ? amount
            : throw new JsonException("Money must have at most 3 decimals.");
    }

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options)
        => writer.WriteStringValue(Format(value));
}
