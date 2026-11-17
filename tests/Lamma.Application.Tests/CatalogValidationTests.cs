using System.Text.Json;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Domain.Catalog;

namespace Lamma.Application.Tests;

public sealed class ProductAttributesTests
{
    private static readonly TemplateField[] Fields =
    [
        new("fabric", "الخامة", TemplateFieldType.Text, [], false, false),
        new("gender", "الفئة", TemplateFieldType.Select, ["نسائي", "رجالي"], false, false),
        new("weight", "الوزن", TemplateFieldType.Number, [], false, false),
        new("c_made", "تاريخ الصنع", TemplateFieldType.Date, [], true, true),
    ];

    [Fact]
    public void Valid_values_are_normalized_and_empty_values_dropped()
    {
        var json = ProductAttributes.Normalize(Fields, new Dictionary<string, string?>
        {
            ["fabric"] = "  كتان 100% ",
            ["gender"] = "نسائي",
            ["weight"] = "12.50",
            ["c_made"] = "2026-11-01",
        });

        var values = ProductAttributes.Read(json);
        Assert.Equal("كتان 100%", values["fabric"]);
        Assert.Equal("12.50", values["weight"]);
        Assert.Equal("2026-11-01", values["c_made"]);
        Assert.Contains("كتان", json); // stored readable, not \u-escaped
    }

    [Fact]
    public void Each_invalid_value_gets_a_field_error()
    {
        var ex = Assert.Throws<RequestValidationException>(() => ProductAttributes.Normalize(Fields, new Dictionary<string, string?>
        {
            ["fabric"] = new string('x', 201),
            ["gender"] = "أطفال",
            ["weight"] = "ثقيل",
            ["c_made"] = "01/11/2026",
            ["unknown"] = "x",
        }));

        Assert.Equal(
            ["attributes.c_made", "attributes.fabric", "attributes.gender", "attributes.unknown", "attributes.weight"],
            ex.Errors.Keys.Order());
    }

    [Fact]
    public void Required_custom_field_must_be_present()
    {
        var ex = Assert.Throws<RequestValidationException>(() => ProductAttributes.Normalize(Fields, new Dictionary<string, string?> { ["c_made"] = " " }));
        Assert.Contains("attributes.c_made", ex.Errors.Keys);
    }
}

public sealed class CatalogValidatorTests
{
    private static CreateProductRequest Request(
        decimal price = 38m,
        decimal cost = 17m,
        IReadOnlyList<ProductOptionRequest>? options = null,
        IReadOnlyList<VariantRequest>? variants = null,
        string? template = "clothing")
        => new("فستان", null, template, price, cost, null, null, null, options, variants);

    private static VariantRequest V(params string[] values) => new(values, 1, null, null);

    private static bool Valid(CreateProductRequest r) => new CreateProductRequestValidator().Validate(r).IsValid;

    [Fact]
    public void A_simple_product_is_valid_with_or_without_one_opening_entry()
    {
        Assert.True(Valid(Request()));
        Assert.True(Valid(Request(variants: [new VariantRequest([], 5, null, null)])));
        Assert.False(Valid(Request(variants: [V(), V()])));
    }

    [Fact]
    public void Variants_must_match_the_option_values_without_duplicates()
    {
        ProductOptionRequest[] options = [new("المقاس", ["S", "M"]), new("اللون", ["زيتي"])];

        Assert.True(Valid(Request(options: options, variants: [V("S", "زيتي"), V("M", "زيتي")])));
        Assert.False(Valid(Request(options: options, variants: [])));
        Assert.False(Valid(Request(options: options, variants: [V("L", "زيتي")])));
        Assert.False(Valid(Request(options: options, variants: [V("S")])));
        Assert.False(Valid(Request(options: options, variants: [V("S", "زيتي"), V("s", "زيتي")])));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(10.555, 1)]
    [InlineData(10, -1)]
    [InlineData(10, 1.005)]
    [InlineData(1_000_000, 1)]
    public void Money_input_allows_two_decimals_positive_price_and_non_negative_cost(decimal price, decimal cost)
        => Assert.False(Valid(Request(price, cost)));

    [Fact]
    public void Unknown_template_and_duplicate_axis_names_are_rejected()
    {
        Assert.False(Valid(Request(template: "cars")));
        Assert.False(Valid(Request(options: [new("المقاس", ["S"]), new("المقاس", ["M"])], variants: [V("S", "M")])));
    }

    [Theory]
    [InlineData(0, 20, false)]
    [InlineData(1, 101, false)]
    [InlineData(1, 100, true)]
    public void Paging_is_bounded(int page, int size, bool valid)
        => Assert.Equal(valid, new ProductListQueryValidator().Validate(new ProductListQuery { Page = page, PageSize = size }).IsValid);

    [Fact]
    public void Unknown_stock_status_and_sort_are_rejected()
    {
        var validator = new ProductListQueryValidator();
        Assert.False(validator.Validate(new ProductListQuery { StockStatus = "empty" }).IsValid);
        Assert.False(validator.Validate(new ProductListQuery { Sort = "price" }).IsValid);
        Assert.True(validator.Validate(new ProductListQuery { StockStatus = "low", Sort = "-available" }).IsValid);
    }

    [Fact]
    public void Select_custom_field_needs_options()
    {
        var validator = new TemplateFieldRequestValidator();
        Assert.False(validator.Validate(new TemplateFieldRequest("اللون", "select", [], false)).IsValid);
        Assert.True(validator.Validate(new TemplateFieldRequest("اللون", "select", ["أحمر"], false)).IsValid);
        Assert.True(validator.Validate(new TemplateFieldRequest("ملاحظة", "text", null, false)).IsValid);
        Assert.False(validator.Validate(new TemplateFieldRequest("x", "color", null, false)).IsValid);
    }
}

public sealed class ImageSignatureTests
{
    [Fact]
    public void Detects_jpeg_png_and_webp_by_content()
    {
        Assert.Equal("jpg", ImageSignature.Detect([0xFF, 0xD8, 0xFF, 0xE0])!.Value.Extension);
        Assert.Equal("png", ImageSignature.Detect([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])!.Value.Extension);
        Assert.Equal("image/webp", ImageSignature.Detect("RIFF\0\0\0\0WEBP"u8)!.Value.ContentType);
    }

    [Fact]
    public void Rejects_other_content_even_with_an_image_name()
    {
        Assert.Null(ImageSignature.Detect("MZ\x90\0\x03\0\0\0\x04\0\0\0"u8)); // Windows executable
        Assert.Null(ImageSignature.Detect("GIF89a"u8));
        Assert.Null(ImageSignature.Detect([]));
    }
}

public sealed class NullableMoneySerializationTests
{
    private sealed record Box([property: System.Text.Json.Serialization.JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? Amount);

    [Fact]
    public void Writes_three_decimals_or_null_and_reads_both()
    {
        Assert.Equal("{\"Amount\":\"8.000\"}", JsonSerializer.Serialize(new Box(8m)));
        Assert.Equal("{\"Amount\":null}", JsonSerializer.Serialize(new Box(null)));
        Assert.Equal(8.5m, JsonSerializer.Deserialize<Box>("{\"Amount\":\"8.5\"}")!.Amount);
        Assert.Null(JsonSerializer.Deserialize<Box>("{\"Amount\":null}")!.Amount);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Box>("{\"Amount\":8.5}"));
    }
}
