using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lamma.Application.Common.Serialization;

/// <summary>A list of money values written as 3-decimal strings (P-005), e.g. the weekday sales of a report. Write-only.</summary>
public sealed class MoneyListJsonConverter : JsonConverter<IReadOnlyList<decimal>>
{
    public override IReadOnlyList<decimal> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => throw new NotSupportedException("Money lists are response-only.");

    public override void Write(Utf8JsonWriter writer, IReadOnlyList<decimal> value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var amount in value)
        {
            writer.WriteStringValue(MoneyJsonConverter.Format(amount));
        }

        writer.WriteEndArray();
    }
}
