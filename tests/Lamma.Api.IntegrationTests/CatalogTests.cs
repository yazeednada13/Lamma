using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

internal static class CatalogApi
{
    public static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52];
    public static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46];

    public static object Simple(string name = "كريم ترطيب", string price = "12", string cost = "5", int opening = 0, Guid? categoryId = null, string? template = null)
        => new { name, categoryId, templateCode = template, sellingPrice = price, cost, variants = opening > 0 ? new[] { new { values = Array.Empty<string>(), openingQuantity = opening } } : null };

    public static object Dress(string name = "فستان كتان")
        => new
        {
            name,
            templateCode = "clothing",
            sellingPrice = "38",
            cost = "17",
            attributes = new Dictionary<string, string> { ["fabric"] = "كتان 100%", ["gender"] = "نسائي" },
            options = new[] { new { name = "المقاس", values = new[] { "S", "M" } }, new { name = "اللون", values = new[] { "زيتي", "كريمي" } } },
            variants = new object[]
            {
                new { values = new[] { "S", "زيتي" }, openingQuantity = 3 },
                new { values = new[] { "M", "زيتي" }, openingQuantity = 0 },
                new { values = new[] { "M", "كريمي" }, openingQuantity = 2, priceOverride = "42.5" },
            },
        };

    public static async Task<JsonElement> CreateAsync(this ApiSession session, object body)
    {
        var response = await session.PostAsync("/api/v1/products", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.JsonAsync();
    }

    public static async Task<Guid> CreateCategoryAsync(this ApiSession session, string name)
    {
        var response = await session.PostAsync("/api/v1/categories", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.JsonAsync()).GetProperty("id").GetGuid();
    }

    public static Task<HttpResponseMessage> DeleteAsync(this ApiSession session, string url) => session.SendAsync(HttpMethod.Delete, url, null, withToken: true, origin: null);

    public static Task<HttpResponseMessage> UploadAsync(this ApiSession session, Guid productId, byte[] bytes, string fileName, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        var form = new MultipartFormDataContent { { file, "file", fileName } };
        return session.SendAsync(HttpMethod.Put, $"/api/v1/products/{productId}/image", form, withToken: true, origin: null);
    }

    public static async Task<ApiSession> OnboardedAsync(this LammaApiFactory factory)
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();
        return session;
    }
}

[Collection(ApiCollection.Name)]
public sealed class CategoryApiTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Categories_can_be_created_renamed_listed_and_deleted()
    {
        var session = await factory.OnboardedAsync();
        var id = await session.CreateCategoryAsync("فساتين");

        await (await session.PostAsync("/api/v1/categories", new { name = " فساتين " })).AssertProblemAsync(HttpStatusCode.Conflict, "category.duplicate_name");
        var renamed = await (await session.PutAsync($"/api/v1/categories/{id}", new { name = "فساتين صيفية" })).JsonAsync();
        Assert.Equal("فساتين صيفية", renamed.GetProperty("name").GetString());

        var list = await (await session.GetAsync("/api/v1/categories")).JsonAsync();
        Assert.Equal(0, Assert.Single(list.EnumerateArray()).GetProperty("productCount").GetInt32());

        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync($"/api/v1/categories/{id}")).StatusCode);
        Assert.Equal(0, (await (await session.GetAsync("/api/v1/categories")).JsonAsync()).GetArrayLength());
    }

    [Fact]
    public async Task Delete_is_blocked_by_active_products_and_archives_when_only_archived_products_remain()
    {
        var session = await factory.OnboardedAsync();
        var categoryId = await session.CreateCategoryAsync("عطور");
        var product = await session.CreateAsync(CatalogApi.Simple(categoryId: categoryId));
        var productId = product.GetProperty("id").GetGuid();

        var blocked = await (await session.DeleteAsync($"/api/v1/categories/{categoryId}")).AssertProblemAsync(HttpStatusCode.Conflict, "category.has_products");
        Assert.Contains("1", blocked.GetProperty("detail").GetString());

        await session.PostAsync($"/api/v1/products/{productId}/archive");
        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync($"/api/v1/categories/{categoryId}")).StatusCode);

        Assert.Equal(0, (await (await session.GetAsync("/api/v1/categories")).JsonAsync()).GetArrayLength());
        var details = await (await session.GetAsync($"/api/v1/products/{productId}")).JsonAsync();
        Assert.Equal("عطور", details.GetProperty("categoryName").GetString()); // archived, history kept (D-095)
        await session.CreateCategoryAsync("عطور"); // the name is free again
    }

    [Fact]
    public async Task Invalid_name_is_a_field_error_and_other_business_category_is_not_found()
    {
        var session = await factory.OnboardedAsync();
        var body = await (await session.PostAsync("/api/v1/categories", new { name = "  " })).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty("name", out _));

        var other = await factory.OnboardedAsync();
        var foreign = await other.CreateCategoryAsync("خاص");
        await (await session.PutAsync($"/api/v1/categories/{foreign}", new { name = "x" })).AssertProblemAsync(HttpStatusCode.NotFound, "category.not_found");
        await (await session.PostAsync("/api/v1/products", CatalogApi.Simple(categoryId: foreign))).AssertProblemAsync(HttpStatusCode.NotFound, "category.not_found");
    }
}

[Collection(ApiCollection.Name)]
public sealed class TemplateApiTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Templates_list_the_six_system_templates_and_business_types_carry_the_default()
    {
        var session = await factory.OnboardedAsync();

        var templates = await (await session.GetAsync("/api/v1/product-templates")).JsonAsync();
        Assert.Equal(["clothing", "perfume", "beauty", "jewelry", "gift", "other"], templates.EnumerateArray().Select(t => t.GetProperty("code").GetString()));
        var clothing = templates[0];
        Assert.Equal("المقاس", clothing.GetProperty("defaultAxes")[0].GetProperty("name").GetString());
        Assert.Equal("select", clothing.GetProperty("fields")[1].GetProperty("type").GetString());

        var types = await (await session.GetAsync("/api/v1/onboarding/business-types")).JsonAsync();
        var kids = types.EnumerateArray().Single(t => t.GetProperty("code").GetString() == "kids");
        Assert.Equal("clothing", kids.GetProperty("defaultTemplateCode").GetString());
    }

    [Fact]
    public async Task Custom_fields_can_be_added_updated_and_deleted_per_business()
    {
        var session = await factory.OnboardedAsync();

        var created = await session.PostAsync("/api/v1/product-templates/other/fields", new { labelAr = "المؤلف", type = "text", isRequired = false });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var key = (await created.JsonAsync()).GetProperty("key").GetString();

        await (await session.PostAsync("/api/v1/product-templates/clothing/fields", new { labelAr = "الخامة", type = "text" }))
            .AssertProblemAsync(HttpStatusCode.Conflict, "template.duplicate_field_label");
        await (await session.PostAsync("/api/v1/product-templates/cars/fields", new { labelAr = "x", type = "text" }))
            .AssertProblemAsync(HttpStatusCode.NotFound, "template.not_found");

        var updated = await (await session.PutAsync($"/api/v1/product-templates/other/fields/{key}", new { labelAr = "الكاتب", type = "select", options = new[] { "أ", "ب" }, isRequired = true })).JsonAsync();
        Assert.Equal(("الكاتب", "select", true), (updated.GetProperty("labelAr").GetString(), updated.GetProperty("type").GetString(), updated.GetProperty("isRequired").GetBoolean()));

        var other = (await (await session.GetAsync("/api/v1/product-templates")).JsonAsync()).EnumerateArray().Single(t => t.GetProperty("code").GetString() == "other");
        Assert.True(Assert.Single(other.GetProperty("fields").EnumerateArray()).GetProperty("isCustom").GetBoolean());

        // A second business does not see it.
        var stranger = await factory.OnboardedAsync();
        var strangerOther = (await (await stranger.GetAsync("/api/v1/product-templates")).JsonAsync()).EnumerateArray().Single(t => t.GetProperty("code").GetString() == "other");
        Assert.Equal(0, strangerOther.GetProperty("fields").GetArrayLength());
        await (await stranger.DeleteAsync($"/api/v1/product-templates/other/fields/{key}")).AssertProblemAsync(HttpStatusCode.NotFound, "template.field_not_found");

        // Required custom field is enforced on products, then the field is deleted.
        var missing = await (await session.PostAsync("/api/v1/products", CatalogApi.Simple(template: "other"))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(missing.GetProperty("errors").TryGetProperty($"attributes.{key}", out _));
        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync($"/api/v1/product-templates/other/fields/{key}")).StatusCode);
        await session.CreateAsync(CatalogApi.Simple(template: "other"));
    }
}

[Collection(ApiCollection.Name)]
public sealed class ProductApiTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Simple_product_gets_one_default_variant_the_business_template_and_an_opening_movement()
    {
        var session = await factory.OnboardedAsync(); // clothing business

        var product = await session.CreateAsync(CatalogApi.Simple(opening: 5, cost: "4.5"));

        Assert.Equal("clothing", product.GetProperty("templateCode").GetString());
        Assert.Equal("12.000", product.GetProperty("sellingPrice").GetString());
        Assert.Equal("7.500", product.GetProperty("marginPerUnit").GetString());
        Assert.Equal(62.5m, product.GetProperty("marginPercent").GetDecimal());
        Assert.Equal(5, product.GetProperty("lowStockThreshold").GetInt32());
        Assert.Equal((5, "low"), (product.GetProperty("available").GetInt32(), product.GetProperty("stockStatus").GetString()));

        var variant = Assert.Single(product.GetProperty("variants").EnumerateArray());
        Assert.True(variant.GetProperty("isDefault").GetBoolean());
        var movement = Assert.Single(product.GetProperty("recentMovements").EnumerateArray());
        Assert.Equal(("receive", "opening", 5, "4.500", true),
            (movement.GetProperty("type").GetString(), movement.GetProperty("referenceKind").GetString(), movement.GetProperty("onHandDelta").GetInt32(),
             movement.GetProperty("unitCost").GetString(), movement.GetProperty("isAutomatic").GetBoolean()));
    }

    [Fact]
    public async Task Matrix_product_creates_variants_in_order_with_overrides_and_movements_only_for_quantities()
    {
        var session = await factory.OnboardedAsync();

        var product = await session.CreateAsync(CatalogApi.Dress());

        var variants = product.GetProperty("variants").EnumerateArray().ToList();
        Assert.Equal(["S · زيتي", "M · زيتي", "M · كريمي"], variants.Select(v => v.GetProperty("label").GetString()));
        Assert.Equal("42.500", variants[2].GetProperty("price").GetString());
        Assert.Equal(("38.000", "42.500"), (product.GetProperty("minPrice").GetString(), product.GetProperty("maxPrice").GetString()));
        Assert.Equal(5, product.GetProperty("onHand").GetInt32());
        Assert.Equal(2, product.GetProperty("recentMovements").GetArrayLength());
        Assert.Equal(["S", "M"], product.GetProperty("options")[0].GetProperty("values").EnumerateArray().Select(v => v.GetString()));
        Assert.Equal("كتان 100%", product.GetProperty("attributes").GetProperty("fabric").GetString());
        Assert.Equal("out", variants[1].GetProperty("stockStatus").GetString());
    }

    [Theory]
    [InlineData("{\"name\":\"x\",\"sellingPrice\":\"0\",\"cost\":\"1\"}", "sellingPrice")]
    [InlineData("{\"name\":\"x\",\"sellingPrice\":\"10.555\",\"cost\":\"1\"}", "sellingPrice")]
    [InlineData("{\"name\":\"\",\"sellingPrice\":\"10\",\"cost\":\"1\"}", "name")]
    [InlineData("{\"name\":\"x\",\"sellingPrice\":\"10\",\"cost\":\"1\",\"options\":[{\"name\":\"المقاس\",\"values\":[\"S\"]}],\"variants\":[{\"values\":[\"L\"],\"openingQuantity\":1}]}", "variants")]
    [InlineData("{\"name\":\"x\",\"sellingPrice\":\"10\",\"cost\":\"1\",\"attributes\":{\"engine\":\"v8\"}}", "attributes.engine")]
    [InlineData("{\"name\":\"x\",\"templateCode\":\"clothing\",\"sellingPrice\":\"10\",\"cost\":\"1\",\"expiryDate\":\"2027-01-01\"}", "expiryDate")]
    public async Task Invalid_products_are_field_errors(string json, string field)
    {
        var session = await factory.OnboardedAsync();

        var response = await session.PostAsync("/api/v1/products", new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty(field, out _), $"missing error for {field}: {body}");
    }

    [Fact]
    public async Task Beauty_products_take_one_expiry_date_for_all_variants()
    {
        var session = await factory.OnboardedAsync();

        var product = await session.CreateAsync(new
        {
            name = "أحمر شفاه",
            templateCode = "beauty",
            sellingPrice = "9",
            cost = "3",
            expiryDate = "2027-02-14",
            options = new[] { new { name = "الدرجة", values = new[] { "وردي", "أحمر" } } },
            variants = new[] { new { values = new[] { "وردي" }, openingQuantity = 1 }, new { values = new[] { "أحمر" }, openingQuantity = 1 } },
        });

        Assert.All(product.GetProperty("variants").EnumerateArray(), v => Assert.Equal("2027-02-14", v.GetProperty("expiryDate").GetString()));
    }

    [Fact]
    public async Task List_filters_searches_pages_and_rejects_bad_paging()
    {
        var session = await factory.OnboardedAsync();
        var categoryId = await session.CreateCategoryAsync("عناية");
        await session.CreateAsync(CatalogApi.Simple("صابون", opening: 20, categoryId: categoryId));
        await session.CreateAsync(CatalogApi.Simple("شامبو", opening: 2));
        await session.CreateAsync(CatalogApi.Simple("بلسم"));

        var all = await (await session.GetAsync("/api/v1/products?pageSize=2&sort=name")).JsonAsync();
        Assert.Equal((3, 2), (all.GetProperty("totalCount").GetInt32(), all.GetProperty("items").GetArrayLength()));
        Assert.Equal("بلسم", all.GetProperty("items")[0].GetProperty("name").GetString());

        string[] Names(JsonElement page) => page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString()!).ToArray();
        Assert.Equal(["صابون"], Names(await (await session.GetAsync($"/api/v1/products?categoryId={categoryId}")).JsonAsync()));
        Assert.Equal(["بلسم", "شامبو"], Names(await (await session.GetAsync("/api/v1/products?uncategorized=true&sort=name")).JsonAsync()));
        Assert.Equal(["شامبو"], Names(await (await session.GetAsync("/api/v1/products?stockStatus=low")).JsonAsync()));
        Assert.Equal(["بلسم"], Names(await (await session.GetAsync("/api/v1/products?stockStatus=out")).JsonAsync()));
        Assert.Equal(["شامبو"], Names(await (await session.GetAsync($"/api/v1/products?search={Uri.EscapeDataString("شام")}")).JsonAsync()));

        var item = (await (await session.GetAsync("/api/v1/products?stockStatus=in")).JsonAsync()).GetProperty("items")[0];
        Assert.Equal(("عناية", "12.000", 20), (item.GetProperty("categoryName").GetString(), item.GetProperty("minPrice").GetString(), item.GetProperty("available").GetInt32()));

        await (await session.GetAsync("/api/v1/products?pageSize=101")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
    }

    [Fact]
    public async Task Another_business_cannot_see_or_change_a_product()
    {
        var owner = await factory.OnboardedAsync();
        var id = (await owner.CreateAsync(CatalogApi.Simple(opening: 1))).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await owner.UploadAsync(id, CatalogApi.Png, "a.png", "image/png")).StatusCode);

        var stranger = await factory.OnboardedAsync();
        await (await stranger.GetAsync($"/api/v1/products/{id}")).AssertProblemAsync(HttpStatusCode.NotFound, "product.not_found");
        await (await stranger.PutAsync($"/api/v1/products/{id}", new { name = "x", templateCode = "other", sellingPrice = "1", cost = "0", lowStockThreshold = 1 }))
            .AssertProblemAsync(HttpStatusCode.NotFound, "product.not_found");
        await (await stranger.PostAsync($"/api/v1/products/{id}/archive")).AssertProblemAsync(HttpStatusCode.NotFound, "product.not_found");
        await (await stranger.GetAsync($"/api/v1/products/{id}/image")).AssertProblemAsync(HttpStatusCode.NotFound, "product.not_found");
        Assert.Equal(0, (await (await stranger.GetAsync("/api/v1/products")).JsonAsync()).GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Catalog_requires_an_onboarded_business()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        await (await session.GetAsync("/api/v1/products")).AssertProblemAsync(HttpStatusCode.Forbidden, "business.not_onboarded");
    }

    [Fact]
    public async Task Update_renames_axes_changes_details_but_cannot_change_the_axis_count()
    {
        var session = await factory.OnboardedAsync();
        var product = await session.CreateAsync(CatalogApi.Dress());
        var id = product.GetProperty("id").GetGuid();
        var categoryId = await session.CreateCategoryAsync("فساتين");

        var updated = await (await session.PutAsync($"/api/v1/products/{id}", new
        {
            name = "فستان صيفي",
            categoryId,
            templateCode = "clothing",
            sellingPrice = "40",
            cost = "18",
            lowStockThreshold = 2,
            attributes = new { cut = "واسع" },
            optionNames = new[] { "القياس", "اللون" },
        })).JsonAsync();

        Assert.Equal(("فستان صيفي", "فساتين", "40.000", "القياس"), (updated.GetProperty("name").GetString(), updated.GetProperty("categoryName").GetString(),
            updated.GetProperty("sellingPrice").GetString(), updated.GetProperty("options")[0].GetProperty("name").GetString()));
        Assert.Equal(5, updated.GetProperty("onHand").GetInt32()); // stock is not editable here

        await (await session.PutAsync($"/api/v1/products/{id}", new { name = "x", templateCode = "clothing", sellingPrice = "40", cost = "18", lowStockThreshold = 2, optionNames = new[] { "القياس" } }))
            .AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "product.axes_fixed");
    }

    [Fact]
    public async Task Variants_can_be_added_with_opening_stock_edited_archived_and_restored()
    {
        var session = await factory.OnboardedAsync();
        var id = (await session.CreateAsync(CatalogApi.Dress())).GetProperty("id").GetGuid();

        var added = await session.PostAsync($"/api/v1/products/{id}/variants", new { values = new[] { "S", "كريمي" }, openingQuantity = 4 });
        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        var details = await added.JsonAsync();
        Assert.Equal((4, 9, 3), (details.GetProperty("variants").GetArrayLength(), details.GetProperty("onHand").GetInt32(), details.GetProperty("recentMovements").GetArrayLength()));

        await (await session.PostAsync($"/api/v1/products/{id}/variants", new { values = new[] { "s", "كريمي" }, openingQuantity = 0 }))
            .AssertProblemAsync(HttpStatusCode.Conflict, "product.duplicate_variant");

        var variantId = details.GetProperty("variants")[0].GetProperty("id").GetGuid();
        var edited = await (await session.PutAsync($"/api/v1/products/{id}/variants/{variantId}", new { priceOverride = "36" })).JsonAsync();
        Assert.Equal("36.000", edited.GetProperty("variants")[0].GetProperty("price").GetString());

        var archived = await (await session.PostAsync($"/api/v1/products/{id}/variants/{variantId}/archive")).JsonAsync();
        Assert.Equal(6, archived.GetProperty("onHand").GetInt32()); // the archived S · زيتي (3) no longer counts
        Assert.True(archived.GetProperty("variants").EnumerateArray().Last().GetProperty("isArchived").GetBoolean());

        var restored = await (await session.PostAsync($"/api/v1/products/{id}/variants/{variantId}/restore")).JsonAsync();
        Assert.Equal(9, restored.GetProperty("onHand").GetInt32());

        await (await session.PutAsync($"/api/v1/products/{id}/variants/{Guid.NewGuid()}", new { }))
            .AssertProblemAsync(HttpStatusCode.NotFound, "product.variant_not_found");
    }

    [Fact]
    public async Task The_last_active_variant_cannot_be_archived()
    {
        var session = await factory.OnboardedAsync();
        var product = await session.CreateAsync(CatalogApi.Simple());
        var id = product.GetProperty("id").GetGuid();
        var variantId = product.GetProperty("variants")[0].GetProperty("id").GetGuid();

        await (await session.PostAsync($"/api/v1/products/{id}/variants/{variantId}/archive")).AssertProblemAsync(HttpStatusCode.Conflict, "product.last_variant");
    }

    [Fact]
    public async Task A_simple_product_converts_to_variants_only_without_stock()
    {
        var session = await factory.OnboardedAsync();
        var empty = (await session.CreateAsync(CatalogApi.Simple("بدون مخزون"))).GetProperty("id").GetGuid();
        var stocked = (await session.CreateAsync(CatalogApi.Simple("فيه مخزون", opening: 2))).GetProperty("id").GetGuid();

        await (await session.PostAsync($"/api/v1/products/{empty}/variants", new { values = new[] { "M" }, openingQuantity = 1 }))
            .AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");

        var converted = await (await session.PostAsync($"/api/v1/products/{empty}/variants", new { values = new[] { "M" }, openingQuantity = 1, optionNames = new[] { "المقاس" } })).JsonAsync();
        Assert.Equal("المقاس", converted.GetProperty("options")[0].GetProperty("name").GetString());
        Assert.Equal((1, 1), (converted.GetProperty("onHand").GetInt32(), converted.GetProperty("variants").EnumerateArray().Count(v => !v.GetProperty("isArchived").GetBoolean())));

        await (await session.PostAsync($"/api/v1/products/{stocked}/variants", new { values = new[] { "M" }, openingQuantity = 0, optionNames = new[] { "المقاس" } }))
            .AssertProblemAsync(HttpStatusCode.Conflict, "product.convert_has_stock");
    }

    [Fact]
    public async Task Archived_products_leave_the_default_list_and_can_be_restored()
    {
        var session = await factory.OnboardedAsync();
        var id = (await session.CreateAsync(CatalogApi.Simple())).GetProperty("id").GetGuid();

        Assert.True((await (await session.PostAsync($"/api/v1/products/{id}/archive")).JsonAsync()).GetProperty("isArchived").GetBoolean());
        Assert.Equal(0, (await (await session.GetAsync("/api/v1/products")).JsonAsync()).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, (await (await session.GetAsync("/api/v1/products?archived=true")).JsonAsync()).GetProperty("totalCount").GetInt32());

        await session.PostAsync($"/api/v1/products/{id}/restore");
        Assert.Equal(1, (await (await session.GetAsync("/api/v1/products")).JsonAsync()).GetProperty("totalCount").GetInt32());
    }
}

[Collection(ApiCollection.Name)]
public sealed class ProductImageApiTests(LammaApiFactory factory)
{
    private string[] StoredFiles(Guid productId)
        => Directory.Exists(factory.StorageRoot)
            ? Directory.GetFiles(factory.StorageRoot, "*", SearchOption.AllDirectories).Where(f => f.Contains(productId.ToString("N"), StringComparison.Ordinal)).ToArray()
            : [];

    [Fact]
    public async Task Image_upload_serve_replace_and_delete()
    {
        var session = await factory.OnboardedAsync();
        var id = (await session.CreateAsync(CatalogApi.Simple())).GetProperty("id").GetGuid();

        var uploaded = await (await session.UploadAsync(id, CatalogApi.Png, "photo.png", "image/png")).JsonAsync();
        var url = uploaded.GetProperty("imageUrl").GetString()!;
        Assert.StartsWith($"/api/v1/products/{id}/image?v=", url);

        var image = await session.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, image.StatusCode);
        Assert.Equal("image/png", image.Content.Headers.ContentType?.MediaType);
        Assert.Equal(CatalogApi.Png, await image.Content.ReadAsByteArrayAsync());
        Assert.False(image.Headers.CacheControl?.Public ?? false); // never in shared caches
        Assert.Equal("nosniff", image.Headers.GetValues("X-Content-Type-Options").Single());

        // Replacing deletes the previous file after the commit; the list shows the new URL.
        var replaced = await (await session.UploadAsync(id, CatalogApi.Jpeg, "photo.jpg", "image/jpeg")).JsonAsync();
        Assert.NotEqual(url, replaced.GetProperty("imageUrl").GetString());
        Assert.Single(StoredFiles(id));
        var listUrl = (await (await session.GetAsync("/api/v1/products")).JsonAsync()).GetProperty("items")[0].GetProperty("imageUrl").GetString();
        Assert.Equal(replaced.GetProperty("imageUrl").GetString(), listUrl);

        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync($"/api/v1/products/{id}/image")).StatusCode);
        Assert.Empty(StoredFiles(id));
        await (await session.GetAsync($"/api/v1/products/{id}/image")).AssertProblemAsync(HttpStatusCode.NotFound, "product.image_not_found");
    }

    [Fact]
    public async Task Type_is_checked_by_content_and_size_is_limited()
    {
        var session = await factory.OnboardedAsync();
        var id = (await session.CreateAsync(CatalogApi.Simple())).GetProperty("id").GetGuid();

        var executable = "MZ\u0090\0\u0003\0\0\0\u0004\0\0\0"u8.ToArray();
        await (await session.UploadAsync(id, executable, "photo.png", "image/png")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "product.image_invalid_type");

        var tooLarge = new byte[(5 * 1024 * 1024) + 1];
        CatalogApi.Png.CopyTo(tooLarge, 0);
        await (await session.UploadAsync(id, tooLarge, "big.png", "image/png")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "product.image_too_large");

        Assert.Empty(StoredFiles(id));
        Assert.Equal(JsonValueKind.Null, (await (await session.GetAsync($"/api/v1/products/{id}")).JsonAsync()).GetProperty("imageUrl").ValueKind);
    }
}
