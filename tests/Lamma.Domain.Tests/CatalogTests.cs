using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Domain.Tests;

public sealed class ProductTemplateCatalogTests
{
    [Fact]
    public void Every_business_type_maps_to_an_existing_template()
    {
        foreach (var type in EnumCode.All<BusinessType>())
        {
            Assert.True(ProductTemplateCatalog.Exists(ProductTemplateCatalog.DefaultFor(type)), type.ToString());
        }
    }

    [Theory]
    [InlineData(BusinessType.Clothing, "clothing")]
    [InlineData(BusinessType.Kids, "clothing")]
    [InlineData(BusinessType.Perfume, "perfume")]
    [InlineData(BusinessType.Beauty, "beauty")]
    [InlineData(BusinessType.Accessories, "jewelry")]
    [InlineData(BusinessType.Gifts, "gift")]
    [InlineData(BusinessType.ShoesBags, "other")]
    [InlineData(BusinessType.Books, "other")]
    public void Business_types_use_the_prototype_template_map(BusinessType type, string template)
        => Assert.Equal(template, ProductTemplateCatalog.DefaultFor(type));

    [Fact]
    public void Six_templates_with_unique_codes_and_field_keys()
    {
        Assert.Equal(["clothing", "perfume", "beauty", "jewelry", "gift", "other"], ProductTemplateCatalog.All.Select(t => t.Code));
        Assert.All(ProductTemplateCatalog.All, t => Assert.Equal(t.Fields.Count, t.Fields.Select(f => f.Key).Distinct().Count()));
        Assert.True(ProductTemplateCatalog.Find("beauty")!.SupportsExpiry);
        Assert.Equal(2, ProductTemplateCatalog.Find("clothing")!.DefaultAxes.Count);
    }
}

public sealed class ProductTests
{
    private static readonly Guid BusinessId = Guid.NewGuid();

    private static Product Simple(decimal price = 12m, decimal cost = 5m)
        => Product.Create(BusinessId, "كريم", null, "beauty", price, cost, 5, "{}", [], []);

    private static Product Dress(params (string Size, string Color)[] combos)
        => Product.Create(BusinessId, "فستان", null, "clothing", 38m, 17m, 5, "{}", ["المقاس", "اللون"],
            combos.Select(c => new VariantSpec([c.Size, c.Color])).ToList());

    [Fact]
    public void A_simple_product_gets_exactly_one_default_variant()
    {
        var product = Simple();

        var variant = Assert.Single(product.Variants);
        Assert.True(variant.IsDefault);
        Assert.Equal(string.Empty, variant.OptionsKey);
        Assert.Empty(product.OptionNames);
    }

    [Fact]
    public void A_product_with_axes_needs_at_least_one_variant()
    {
        var ex = Assert.Throws<DomainException>(() =>
            Product.Create(BusinessId, "فستان", null, "clothing", 38m, 17m, 5, "{}", ["المقاس"], []));
        Assert.Equal("product.variant_required", ex.Code);
    }

    [Fact]
    public void A_simple_product_rejects_variants_with_values()
    {
        var ex = Assert.Throws<DomainException>(() =>
            Product.Create(BusinessId, "x", null, "other", 1m, 0m, 5, "{}", [], [new VariantSpec(["M"])]));
        Assert.Equal("product.variants_without_options", ex.Code);
    }

    [Fact]
    public void Variant_matrix_is_built_in_order_with_unique_keys()
    {
        var product = Dress(("S", "زيتي"), ("M", "زيتي"), ("M", "كريمي"));

        Assert.Equal(3, product.Variants.Count);
        Assert.Equal([0, 1, 2], product.Variants.Select(v => v.SortOrder));
        Assert.Equal("m|كريمي", product.Variants.Last().OptionsKey);
    }

    [Fact]
    public void Duplicate_combination_is_a_conflict_case_insensitive()
    {
        var product = Dress(("M", "زيتي"));

        var ex = Assert.Throws<DomainConflictException>(() => product.AddVariant(new VariantSpec(["m", "زيتي"])));
        Assert.Equal("product.duplicate_variant", ex.Code);
    }

    [Fact]
    public void Variant_values_must_match_the_axes()
    {
        var product = Dress(("M", "زيتي"));

        Assert.Equal("product.variant_values_mismatch", Assert.Throws<DomainException>(() => product.AddVariant(new VariantSpec(["L"]))).Code);
    }

    [Fact]
    public void More_than_two_axes_are_rejected()
    {
        var ex = Assert.Throws<DomainException>(() =>
            Product.Create(BusinessId, "x", null, "other", 1m, 0m, 5, "{}", ["a", "b", "c"], [new VariantSpec(["1", "2", "3"])]));
        Assert.Equal("product.too_many_axes", ex.Code);
    }

    [Fact]
    public void The_variant_limit_is_enforced()
    {
        var product = Product.Create(BusinessId, "x", null, "other", 1m, 0m, 5, "{}", ["a", "b"],
            Enumerable.Range(0, 10).SelectMany(i => Enumerable.Range(0, 10).Select(j => new VariantSpec([$"a{i}", $"b{j}"]))).ToList());

        Assert.Equal(100, product.Variants.Count);
        Assert.Equal("product.too_many_variants", Assert.Throws<DomainConflictException>(() => product.AddVariant(new VariantSpec(["a0", "zz"]))).Code);
    }

    [Fact]
    public void More_than_twenty_values_on_one_axis_are_rejected()
    {
        var specs = Enumerable.Range(0, 21).Select(i => new VariantSpec([$"v{i}"])).ToList();

        var ex = Assert.Throws<DomainException>(() => Product.Create(BusinessId, "x", null, "other", 1m, 0m, 5, "{}", ["a"], specs));
        Assert.Equal("product.too_many_values", ex.Code);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-1, 1)]
    [InlineData(10, -1)]
    [InlineData(10.0001, 1)]
    [InlineData(1_000_000, 1)]
    public void Invalid_price_or_cost_is_rejected(decimal price, decimal cost)
        => Assert.Equal("product.invalid_amount", Assert.Throws<DomainException>(() => Simple(price, cost)).Code);

    [Fact]
    public void Zero_cost_is_allowed()
        => Assert.Equal(0m, Simple(10m, 0m).Cost);

    [Fact]
    public void Opening_stock_records_a_receive_movement_at_the_effective_cost()
    {
        var product = Product.Create(BusinessId, "عطر", null, "perfume", 24m, 9m, 4, "{}", ["الحجم"],
            [new VariantSpec(["10 مل"], priceOverride: 8m, costOverride: 3m), new VariantSpec(["50 مل"])]);
        var small = product.Variants.First();
        var operation = Guid.NewGuid();
        var now = new DateTime(2026, 11, 17, 9, 0, 0, DateTimeKind.Utc);

        var movement = product.RecordOpeningStock(small, 6, operation, now);

        Assert.Equal(6, small.OnHand);
        Assert.Equal(StockMovementType.Receive, movement.Type);
        Assert.Equal(StockReferenceKind.Opening, movement.ReferenceKind);
        Assert.Equal(6, movement.OnHandDelta);
        Assert.Equal(0, movement.ReservedDelta);
        Assert.Equal(3m, movement.UnitCost);
        Assert.True(movement.IsAutomatic);
        Assert.Equal(operation, movement.OperationId);
        Assert.Equal(small.Id, movement.VariantId);
        Assert.Equal(product.Id, movement.ProductId);
        Assert.Equal(8m, product.EffectivePrice(small));
        Assert.Equal(24m, product.EffectivePrice(product.Variants.Last()));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100_001)]
    public void Opening_quantity_must_be_positive_and_bounded(int quantity)
    {
        var product = Simple();
        Assert.Equal("product.invalid_opening_quantity",
            Assert.Throws<DomainException>(() => product.RecordOpeningStock(product.Variants.Single(), quantity, Guid.NewGuid(), DateTime.UtcNow)).Code);
    }

    [Fact]
    public void The_last_active_variant_cannot_be_archived()
    {
        var product = Dress(("S", "زيتي"), ("M", "زيتي"));
        var first = product.Variants.First();
        var second = product.Variants.Last();

        product.ArchiveVariant(first.Id);

        Assert.True(first.IsArchived);
        Assert.Equal("product.last_variant", Assert.Throws<DomainConflictException>(() => product.ArchiveVariant(second.Id)).Code);
        product.RestoreVariant(first.Id);
        Assert.False(first.IsArchived);
    }

    [Fact]
    public void A_simple_product_without_stock_converts_to_variants()
    {
        var product = Simple();
        var defaultVariant = product.Variants.Single();

        var added = product.ConvertToVariants(["الدرجة"], new VariantSpec(["فاتح"]));

        Assert.True(defaultVariant.IsArchived);
        Assert.Equal(["الدرجة"], product.OptionNames);
        Assert.Equal(["فاتح"], added.Values);
        Assert.Equal("product.default_variant_retired", Assert.Throws<DomainConflictException>(() => product.RestoreVariant(defaultVariant.Id)).Code);
    }

    [Fact]
    public void A_simple_product_with_stock_cannot_convert_and_stays_unchanged()
    {
        var product = Simple();
        product.RecordOpeningStock(product.Variants.Single(), 3, Guid.NewGuid(), DateTime.UtcNow);

        var ex = Assert.Throws<DomainConflictException>(() => product.ConvertToVariants(["الدرجة"], new VariantSpec(["فاتح"])));

        Assert.Equal("product.convert_has_stock", ex.Code);
        Assert.Empty(product.OptionNames);
        Assert.Single(product.Variants);
    }

    [Fact]
    public void Axes_can_be_renamed_but_not_added_after_creation()
    {
        var product = Dress(("S", "زيتي"));

        product.UpdateDetails("فستان", null, "clothing", 40m, 17m, 5, "{}", ["Size", "Colour"]);
        Assert.Equal(["Size", "Colour"], product.OptionNames);

        var ex = Assert.Throws<DomainException>(() => product.UpdateDetails("فستان", null, "clothing", 40m, 17m, 5, "{}", ["Size"]));
        Assert.Equal("product.axes_fixed", ex.Code);
    }

    [Fact]
    public void Image_replacement_returns_the_previous_path()
    {
        var product = Simple();

        Assert.Null(product.SetImage("a/b/1.jpg"));
        Assert.Equal("a/b/1.jpg", product.SetImage("a/b/2.png"));
        Assert.Equal("a/b/2.png", product.RemoveImage());
        Assert.Null(product.ImagePath);
    }

    [Theory]
    [InlineData(0, 5, StockStatus.Out)]
    [InlineData(-1, 5, StockStatus.Out)]
    [InlineData(5, 5, StockStatus.Low)]
    [InlineData(1, 5, StockStatus.Low)]
    [InlineData(6, 5, StockStatus.In)]
    [InlineData(1, 0, StockStatus.In)]
    public void Stock_status_boundaries(int available, int threshold, StockStatus expected)
        => Assert.Equal(expected, StockStatusRules.For(available, threshold));
}

public sealed class CategoryAndFieldTests
{
    [Fact]
    public void Category_name_is_trimmed_and_bounded()
    {
        var category = Category.Create(Guid.NewGuid(), "  فساتين ");
        Assert.Equal("فساتين", category.Name);
        Assert.Equal("category.name_too_long", Assert.Throws<DomainException>(() => category.Rename(new string('x', 61))).Code);
    }

    [Fact]
    public void Custom_select_field_needs_distinct_options_and_other_types_drop_them()
    {
        var businessId = Guid.NewGuid();
        Assert.Equal("template.field_invalid_options",
            Assert.Throws<DomainException>(() => ProductTemplateCustomField.Create(businessId, "other", "اللون", TemplateFieldType.Select, ["أحمر", "أحمر"], false, 1)).Code);

        var text = ProductTemplateCustomField.Create(businessId, "other", "ملاحظة", TemplateFieldType.Text, ["ignored"], true, 1);
        Assert.Empty(text.Options);
        Assert.StartsWith("c_", text.Key);
        Assert.Equal(10, text.Key.Length);

        var select = ProductTemplateCustomField.Create(businessId, "gift", "الغلاف", TemplateFieldType.Select, [" ورق ", "قماش"], false, 2);
        Assert.Equal(["ورق", "قماش"], select.Options);
        Assert.True(select.ToTemplateField().IsCustom);
    }

    [Fact]
    public void Custom_field_requires_a_known_template()
        => Assert.Equal("template.not_found",
            Assert.Throws<DomainException>(() => ProductTemplateCustomField.Create(Guid.NewGuid(), "cars", "x", TemplateFieldType.Text, [], false, 1)).Code);
}
