using System.Reflection;
using Lamma.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Lamma.Infrastructure.Persistence.Conventions;

/// <summary>
/// Model-wide conventions (DATABASE-DESIGN §2–3):
/// money decimal(19,3) · enums as snake_case codes in nvarchar(32) · DateTime as UTC datetime2(3).
/// </summary>
public static class LammaModelConventions
{
    public const int MoneyPrecision = 19;
    public const int EnumMaxLength = 32;

    public static void Apply(ModelConfigurationBuilder builder, Assembly domainAssembly)
    {
        builder.Properties<decimal>().HavePrecision(MoneyPrecision, MoneyMath.Scale);
        builder.Properties<decimal?>().HavePrecision(MoneyPrecision, MoneyMath.Scale);

        builder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>().HavePrecision(3);
        builder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>().HavePrecision(3);

        var configure = typeof(LammaModelConventions).GetMethod(nameof(ConfigureEnum), BindingFlags.NonPublic | BindingFlags.Static)!;
        foreach (var enumType in domainAssembly.GetTypes().Where(t => t.IsEnum && t.IsPublic))
        {
            configure.MakeGenericMethod(enumType).Invoke(null, [builder]);
        }
    }

    private static void ConfigureEnum<TEnum>(ModelConfigurationBuilder builder)
        where TEnum : struct, Enum
        => builder.Properties<TEnum>().HaveConversion<EnumCodeConverter<TEnum>>().HaveMaxLength(EnumMaxLength).AreUnicode(false);
}

/// <summary>Stores an enum as its stable snake_case code (e.g. "bank_transfer").</summary>
public sealed class EnumCodeConverter<TEnum>() : ValueConverter<TEnum, string>(v => v.ToCode(), v => EnumCode.Parse<TEnum>(v))
    where TEnum : struct, Enum;

/// <summary>All DateTime values are UTC; values read back are marked Kind=Utc.</summary>
public sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v.ToUniversalTime(), DateTimeKind.Utc),
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

public sealed class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
    v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : DateTime.SpecifyKind(v.Value.ToUniversalTime(), DateTimeKind.Utc)) : v,
    v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
