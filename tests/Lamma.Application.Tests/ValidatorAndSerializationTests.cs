using System.Text.Json;
using System.Text.Json.Serialization;
using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Identity;

namespace Lamma.Application.Tests;

public sealed class AuthValidatorTests
{
    private readonly SignUpRequestValidator _signUp = new();

    [Fact]
    public void A_valid_sign_up_passes()
        => Assert.True(_signUp.Validate(new SignUpRequest("ريم", "reem@example.com", "lamma2026")).IsValid);

    [Theory]
    [InlineData("short1")]       // < 8
    [InlineData("onlyletters")]  // no digit
    [InlineData("12345678")]     // no letter
    [InlineData("")]
    public void Weak_passwords_are_rejected(string password)
    {
        var result = _signUp.Validate(new SignUpRequest("ريم", "reem@example.com", password));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SignUpRequest.Password));
    }

    [Fact]
    public void Arabic_letters_count_as_letters()
        => Assert.True(_signUp.Validate(new SignUpRequest("ريم", "reem@example.com", "كلمةسر2026")).IsValid);

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    public void Invalid_email_is_rejected(string email)
        => Assert.Contains(_signUp.Validate(new SignUpRequest("ريم", email, "lamma2026")).Errors, e => e.PropertyName == "Email");

    [Fact]
    public void Blank_name_is_rejected()
        => Assert.Contains(_signUp.Validate(new SignUpRequest("   ", "a@b.co", "lamma2026")).Errors, e => e.PropertyName == "FullName");

    [Fact]
    public void New_password_must_differ_from_current()
    {
        var result = new ChangePasswordRequestValidator().Validate(new ChangePasswordRequest("lamma2026", "lamma2026"));
        Assert.Contains(result.Errors, e => e.PropertyName == "NewPassword");
    }
}

public sealed class BusinessValidatorTests
{
    private readonly OnboardingRequestValidator _onboarding = new();

    [Fact]
    public void A_valid_onboarding_passes()
        => Assert.True(_onboarding.Validate(new OnboardingRequest("بوتيك ريم", "clothing", ["instagram", "whatsapp"])).IsValid);

    [Fact]
    public void Unknown_business_type_is_rejected()
        => Assert.Contains(_onboarding.Validate(new OnboardingRequest("x", "Clothing", ["instagram"])).Errors, e => e.PropertyName == "BusinessType");

    [Fact]
    public void No_channels_is_rejected()
        => Assert.Contains(_onboarding.Validate(new OnboardingRequest("x", "other", [])).Errors, e => e.PropertyName == "SalesChannels");

    [Fact]
    public void Duplicate_or_unknown_channels_are_rejected()
    {
        Assert.False(_onboarding.Validate(new OnboardingRequest("x", "other", ["instagram", "instagram"])).IsValid);
        Assert.False(_onboarding.Validate(new OnboardingRequest("x", "other", ["tiktok"])).IsValid);
    }

    [Fact]
    public void Channel_settings_must_list_all_four_channels_once()
    {
        var validator = new SalesChannelSettingsValidator();
        var three = new SalesChannelSettings([new("instagram", true), new("whatsapp", true), new("facebook", false)]);
        var four = new SalesChannelSettings([new("instagram", true), new("whatsapp", true), new("facebook", false), new("other", false)]);

        Assert.False(validator.Validate(three).IsValid);
        Assert.True(validator.Validate(four).IsValid);
    }

    [Fact]
    public void Payment_settings_reject_unknown_methods()
    {
        var validator = new PaymentMethodSettingsValidator();
        var request = new PaymentMethodSettings(
            [new("cash", true), new("cliq", true), new("bank_transfer", true), new("cod", true), new("zain_cash", false), new("paypal", false)]);
        Assert.False(validator.Validate(request).IsValid);
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(1000, true)]
    [InlineData(1001, false)]
    public void Low_stock_threshold_range(int threshold, bool valid)
        => Assert.Equal(valid, new UpdateBusinessSettingsRequestValidator().Validate(new UpdateBusinessSettingsRequest("x", "books", threshold)).IsValid);

    [Fact]
    public void Business_type_catalog_has_the_thirteen_types_with_arabic_labels()
    {
        Assert.Equal(13, BusinessTypeCatalog.All.Count);
        Assert.All(BusinessTypeCatalog.All, t => Assert.False(string.IsNullOrWhiteSpace(t.LabelAr)));
        Assert.Equal(13, BusinessTypeCatalog.All.Select(t => t.Code).Distinct().Count());
    }
}

public sealed class MoneyJsonConverterTests
{
    private sealed record Priced([property: JsonConverter(typeof(MoneyJsonConverter))] decimal Price);

    [Theory]
    [InlineData("38", "\"38.000\"")]
    [InlineData("38.5", "\"38.500\"")]
    [InlineData("0.001", "\"0.001\"")]
    public void Writes_exactly_three_decimals(string value, string expectedJson)
    {
        var json = JsonSerializer.Serialize(new Priced(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)));
        Assert.Equal($"{{\"Price\":{expectedJson}}}", json);
    }

    [Fact]
    public void Reads_strings_with_up_to_three_decimals()
        => Assert.Equal(38.5m, JsonSerializer.Deserialize<Priced>("{\"Price\":\"38.5\"}")!.Price);

    [Theory]
    [InlineData("{\"Price\":\"1.2345\"}")]
    [InlineData("{\"Price\":38.5}")]
    [InlineData("{\"Price\":\"abc\"}")]
    public void Rejects_more_than_three_decimals_numbers_and_garbage(string json)
        => Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Priced>(json));
}
