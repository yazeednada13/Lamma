using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Domain.Tests;

public sealed class MoneyMathTests
{
    [Theory]
    [InlineData("1.0005", "1.001")]
    [InlineData("-1.0005", "-1.001")]
    [InlineData("2.0004", "2.000")]
    [InlineData("38.5", "38.500")]
    [InlineData("0.0004999", "0.000")]
    public void Round_uses_three_decimals_midpoint_away_from_zero(string input, string expected)
        => Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), MoneyMath.Round(decimal.Parse(input, System.Globalization.CultureInfo.InvariantCulture)));

    [Theory]
    [InlineData("1.234", true)]
    [InlineData("1.2345", false)]
    [InlineData("100", true)]
    public void HasValidScale_allows_at_most_three_decimals(string input, bool expected)
        => Assert.Equal(expected, MoneyMath.HasValidScale(decimal.Parse(input, System.Globalization.CultureInfo.InvariantCulture)));
}

public sealed class EnumCodeTests
{
    [Fact]
    public void Codes_are_snake_case_of_member_names()
    {
        Assert.Equal("bank_transfer", PaymentMethod.BankTransfer.ToCode());
        Assert.Equal("cod", PaymentMethod.Cod.ToCode());
        Assert.Equal("zain_cash", PaymentMethod.ZainCash.ToCode());
        Assert.Equal("shoes_bags", BusinessType.ShoesBags.ToCode());
        Assert.Equal("home_decor", BusinessType.HomeDecor.ToCode());
        Assert.Equal("whatsapp", SalesChannel.Whatsapp.ToCode());
    }

    [Fact]
    public void Every_code_round_trips()
    {
        foreach (var type in EnumCode.All<BusinessType>())
        {
            Assert.True(EnumCode.TryParse<BusinessType>(type.ToCode(), out var parsed));
            Assert.Equal(type, parsed);
        }

        foreach (var method in EnumCode.All<PaymentMethod>())
        {
            Assert.Equal(method, EnumCode.Parse<PaymentMethod>(method.ToCode()));
        }
    }

    [Theory]
    [InlineData("Clothing")]
    [InlineData("unknown")]
    [InlineData("")]
    [InlineData(null)]
    public void Unknown_or_differently_cased_codes_are_rejected(string? code)
        => Assert.False(EnumCode.TryParse<BusinessType>(code, out _));

    [Fact]
    public void There_are_exactly_thirteen_business_types_four_channels_six_methods()
    {
        Assert.Equal(13, EnumCode.All<BusinessType>().Count);
        Assert.Equal(4, EnumCode.All<SalesChannel>().Count);
        Assert.Equal(6, EnumCode.All<PaymentMethod>().Count);
    }
}
