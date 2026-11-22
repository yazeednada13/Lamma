using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class DashboardApiTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Dashboard_figures_are_exact_on_a_fixed_two_month_dataset()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            var session = await factory.OnboardedAsync();
            var customer = await session.CustomerAsync();
            var item = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100));
            var variant = OrderApi.VariantAt(item, 0);

            factory.Clock.UtcNow = new DateTime(2026, 10, 10, 9, 0, 0, DateTimeKind.Utc);
            await session.MovedAsync(await session.OrderAsync(customer, variant, 2), "delivered"); // Oct: 21, cost 8 → net 13

            factory.Clock.UtcNow = new DateTime(2026, 11, 20, 9, 0, 0, DateTimeKind.Utc);
            await session.MovedAsync(await session.OrderAsync(customer, variant, 3), "delivered"); // Nov: 31, cost 12 → gross 19
            var ads = (await session.CategoryAsync("ads")).GetProperty("id").GetGuid();
            Assert.Equal(HttpStatusCode.Created, (await session.SpendAsync(ads, "4", factory.Today())).StatusCode); // net 15

            factory.Clock.UtcNow = new DateTime(2026, 11, 22, 9, 0, 0, DateTimeKind.Utc);
            await session.OrderAsync(customer, variant, 1, status: "new");
            await session.OrderAsync(customer, variant, 1); // confirmed

            var d = await session.GetJsonAsync("/api/v1/dashboard");

            string F(JsonElement e, string name) => e.GetProperty(name).GetString()!;
            var net = d.GetProperty("netProfit");
            Assert.Equal(("15.000", "13.000", 15.4m), (F(net, "current"), F(net, "previous"), net.GetProperty("change").GetDecimal()));
            var sales = d.GetProperty("sales");
            Assert.Equal(("31.000", "21.000", 47.6m), (F(sales, "current"), F(sales, "previous"), sales.GetProperty("change").GetDecimal()));
            Assert.Equal(("19.000", "52.000", 2, "22.000"), (F(d, "grossProfit"), F(d, "receivables"), d.GetProperty("openOrders").GetInt32(), F(d, "openValue")));

            var j = d.GetProperty("journey");
            Assert.Equal((1, 0, 1, 1, 0, 1, 1), (j.GetProperty("products").GetInt32(), j.GetProperty("lowStock").GetInt32(), j.GetProperty("newOrders").GetInt32(), j.GetProperty("preparing").GetInt32(), j.GetProperty("courier").GetInt32(), j.GetProperty("deliveredThisMonth").GetInt32(), j.GetProperty("activeCustomers").GetInt32()));

            Assert.Equal(["prepare", "confirm", "due"], d.GetProperty("attention").EnumerateArray().Select(a => a.GetProperty("kind").GetString()));
            Assert.Equal("52.000", F(d.GetProperty("attention")[2], "amount"));

            var series = d.GetProperty("series").EnumerateArray().ToList();
            Assert.Equal(14, series.Count);
            var day20 = series.Single(s => s.GetProperty("day").GetString() == "2026-11-20");
            Assert.Equal(("31.000", "19.000"), (F(day20, "sales"), F(day20, "grossProfit")));
            Assert.Equal(13, series.Count(s => F(s, "sales") == "0.000"));

            Assert.Equal(("instagram", "31.000"), (F(d.GetProperty("channels")[0], "channel"), F(d.GetProperty("channels")[0], "amount")));
            var top = d.GetProperty("topProducts")[0];
            Assert.Equal(("كريم", 3, "30.000"), (F(top, "name"), top.GetProperty("quantity").GetInt32(), F(top, "revenue")));
            Assert.Equal(4, d.GetProperty("latestOrders").GetArrayLength());
            Assert.Equal(("instagram", 100, "كريم"), (F(d.GetProperty("insight"), "topChannel"), d.GetProperty("insight").GetProperty("topChannelShare").GetInt32(), F(d.GetProperty("insight"), "topProduct")));
            Assert.False(d.GetProperty("isEmpty").GetBoolean());

            var ind = await session.GetJsonAsync("/api/v1/dashboard/indicators");
            Assert.Equal((1, 0, true), (ind.GetProperty("newOrders").GetInt32(), ind.GetProperty("lowStock").GetInt32(), ind.GetProperty("hasDues").GetBoolean()));
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    [Fact]
    public async Task New_account_is_empty_with_no_comparison_and_sees_nothing_from_another_business()
    {
        var owner = await factory.OnboardedAsync();
        var customer = await owner.CustomerAsync();
        var item = await owner.CreateAsync(CatalogApi.Simple("كريم", opening: 1));
        await owner.OrderAsync(customer, OrderApi.VariantAt(item, 0), 1, status: "new");

        var fresh = await factory.OnboardedAsync();
        var d = await fresh.GetJsonAsync("/api/v1/dashboard");
        Assert.True(d.GetProperty("isEmpty").GetBoolean());
        Assert.Equal(JsonValueKind.Null, d.GetProperty("netProfit").GetProperty("change").ValueKind);
        Assert.Empty(d.GetProperty("attention").EnumerateArray());
        Assert.True(d.GetProperty("trialDaysLeft").GetInt32() > 0);
        var ind = await fresh.GetJsonAsync("/api/v1/dashboard/indicators");
        Assert.Equal((0, 0, false), (ind.GetProperty("newOrders").GetInt32(), ind.GetProperty("lowStock").GetInt32(), ind.GetProperty("hasDues").GetBoolean()));
    }
}
