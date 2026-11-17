using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lamma.Application.Common.Serialization;

/// <summary>Nullable money on the wire: a 3-decimal string such as "38.000", or null (same rules as <see cref="MoneyJsonConverter"/>).</summary>
public sealed class NullableMoneyJsonConverter : JsonConverter<decimal?>
{
    public override bool HandleNull => true;

    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("Money must be a string such as \"38.500\".");
        }

        var text = reader.GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        return MoneyJsonConverter.TryParse(text, out var amount)
            ? amount
            : throw new JsonException("Money must have at most 3 decimals.");
    }

    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value is null)
        {
            writer.WriteNullValue();
        }
        else
        {
            writer.WriteStringValue(MoneyJsonConverter.Format(value.Value));
        }
    }
}
