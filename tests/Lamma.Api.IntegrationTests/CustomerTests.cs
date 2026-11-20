using System.Net;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class CustomerApiTests(LammaApiFactory factory)
{
    private static object Customer(string name = "رنا الخطيب", string? phone = "0791234567", string channel = "instagram", string? city = "amman", string? area = "خلدا")
        => new { name, phone, channel, city, area, notes = "بتحب المقاس M" };

    [Fact]
    public async Task Customers_can_be_created_read_updated_archived_and_restored()
    {
        var session = await factory.OnboardedAsync();

        var created = await session.PostAsync("/api/v1/customers", Customer());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var customer = await created.JsonAsync();
        var id = customer.GetProperty("id").GetGuid();
        Assert.Equal(("+962791234567", "amman", "خلدا", 0, "0.000"), (customer.GetProperty("phone").GetString(), customer.GetProperty("city").GetString(), customer.GetProperty("area").GetString(),
            customer.GetProperty("orderCount").GetInt32(), customer.GetProperty("totalSpent").GetString()));
        Assert.Equal(["new"], customer.GetProperty("segments").EnumerateArray().Select(s => s.GetString())); // no orders yet (Phase 5)

        var updated = await (await session.PutAsync($"/api/v1/customers/{id}", Customer("رنا", phone: null, channel: "whatsapp", city: null, area: null))).JsonAsync();
        Assert.Equal(("رنا", "whatsapp"), (updated.GetProperty("name").GetString(), updated.GetProperty("channel").GetString()));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, updated.GetProperty("phone").ValueKind);

        await session.PostAsync($"/api/v1/customers/{id}/archive");
        Assert.Equal(0, (await (await session.GetAsync("/api/v1/customers")).JsonAsync()).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, (await (await session.GetAsync("/api/v1/customers?archived=true")).JsonAsync()).GetProperty("totalCount").GetInt32());
        await session.PostAsync($"/api/v1/customers/{id}/restore");
        Assert.Equal(1, (await (await session.GetAsync("/api/v1/customers")).JsonAsync()).GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task The_same_number_in_another_format_is_a_conflict_naming_the_existing_customer()
    {
        var session = await factory.OnboardedAsync();
        var first = await (await session.PostAsync("/api/v1/customers", Customer("عمر", phone: "0789876543"))).JsonAsync();

        var body = await (await session.PostAsync("/api/v1/customers", Customer("عمر 2", phone: "+962 78 987 6543")))
            .AssertProblemAsync(HttpStatusCode.Conflict, "customer.duplicate_phone");

        Assert.Contains("عمر", body.GetProperty("detail").GetString());
        Assert.Equal(first.GetProperty("id").GetGuid(), body.GetProperty("existingCustomerId").GetGuid());

        // Another business may store the same number.
        var other = await factory.OnboardedAsync();
        Assert.Equal(HttpStatusCode.Created, (await other.PostAsync("/api/v1/customers", Customer("عمر", phone: "0789876543"))).StatusCode);
    }

    [Fact]
    public async Task Invalid_input_is_a_field_error()
    {
        var session = await factory.OnboardedAsync();

        await (await session.PostAsync("/api/v1/customers", Customer(phone: "0761234567"))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "customer.invalid_phone");
        var body = await (await session.PostAsync("/api/v1/customers", new { name = "", channel = "telegram", city = "dubai" })).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty("name", out _));
        Assert.True(body.GetProperty("errors").TryGetProperty("channel", out _));
        Assert.True(body.GetProperty("errors").TryGetProperty("city", out _));
    }

    [Fact]
    public async Task Search_by_name_or_number_in_any_format()
    {
        var session = await factory.OnboardedAsync();
        await session.PostAsync("/api/v1/customers", Customer("لين محمود", phone: "0775551122"));
        await session.PostAsync("/api/v1/customers", Customer("عمر سعيد", phone: "0789876543"));

        string[] Names(System.Text.Json.JsonElement page) => page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString()!).ToArray();
        Assert.Equal(["لين محمود"], Names(await (await session.GetAsync($"/api/v1/customers?search={Uri.EscapeDataString("لين")}")).JsonAsync()));
        Assert.Equal(["لين محمود"], Names(await (await session.GetAsync("/api/v1/customers?search=0775551122")).JsonAsync()));
        Assert.Equal(["عمر سعيد"], Names(await (await session.GetAsync("/api/v1/customers?search=9876")).JsonAsync()));
        Assert.Equal(2, Names(await (await session.GetAsync("/api/v1/customers?segment=new")).JsonAsync()).Length);
        Assert.Empty(Names(await (await session.GetAsync("/api/v1/customers?segment=vip")).JsonAsync()));
    }

    [Fact]
    public async Task Summary_counts_and_tenant_isolation()
    {
        var owner = await factory.OnboardedAsync();
        var id = (await (await owner.PostAsync("/api/v1/customers", Customer())).JsonAsync()).GetProperty("id").GetGuid();
        await owner.PostAsync("/api/v1/customers", Customer("عمر", phone: null));

        var summary = await (await owner.GetAsync("/api/v1/customers/summary")).JsonAsync();
        Assert.Equal((2, 0, "0.000", "0.000"), (summary.GetProperty("total").GetInt32(), summary.GetProperty("activeThisMonth").GetInt32(),
            summary.GetProperty("averageSpent").GetString(), summary.GetProperty("totalDue").GetString()));
        Assert.Equal((0, 0, 2, 0), (summary.GetProperty("segments").GetProperty("vip").GetInt32(), summary.GetProperty("segments").GetProperty("owes").GetInt32(),
            summary.GetProperty("segments").GetProperty("new").GetInt32(), summary.GetProperty("segments").GetProperty("dormant").GetInt32()));

        var stranger = await factory.OnboardedAsync();
        await (await stranger.GetAsync($"/api/v1/customers/{id}")).AssertProblemAsync(HttpStatusCode.NotFound, "customer.not_found");
        await (await stranger.PutAsync($"/api/v1/customers/{id}", Customer("x"))).AssertProblemAsync(HttpStatusCode.NotFound, "customer.not_found");
        Assert.Equal(0, (await (await stranger.GetAsync("/api/v1/customers")).JsonAsync()).GetProperty("totalCount").GetInt32());
    }
}
