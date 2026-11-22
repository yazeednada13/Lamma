using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class ReportApiTests(LammaApiFactory factory)
{
    private static string F(JsonElement e, string name) => e.GetProperty(name).GetString()!;

    /// <summary>
    /// Fixed dataset (Asia/Amman, clock at 12:00 local): October: 2 × A delivered (21, cost 8). November: 3 × A + 2 × B
    /// delivered on the 20th (41 = 40 + 2 fee − 1 discount; cost 16), ads expense 4, then on the 21st one A back to stock
    /// and one B damaged in a single return (14.62 = 15 − round2(15 × 1 / 40)).
    /// </summary>
    [Fact]
    public async Task Pnl_sales_and_hub_are_exact_with_returns_discount_shares_and_comparison()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            var session = await factory.OnboardedAsync();
            var customer = await session.CustomerAsync();
            var a = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100));
            var b = await session.CreateAsync(CatalogApi.Simple("صابونة", price: "5", cost: "2", opening: 10));
            var va = OrderApi.VariantAt(a, 0);
            var vb = OrderApi.VariantAt(b, 0);

            factory.Clock.UtcNow = new DateTime(2026, 10, 10, 9, 0, 0, DateTimeKind.Utc);
            await session.MovedAsync(await session.OrderAsync(customer, va, 2), "delivered");

            factory.Clock.UtcNow = new DateTime(2026, 11, 20, 9, 0, 0, DateTimeKind.Utc);
            var order = await session.MovedAsync(await session.OrderAsync(customer, "confirmed", (va, 3), (vb, 2)), "delivered");
            var ads = (await session.CategoryAsync("ads")).GetProperty("id").GetGuid();
            Assert.Equal(HttpStatusCode.Created, (await session.SpendAsync(ads, "4", factory.Today())).StatusCode);

            factory.Clock.UtcNow = new DateTime(2026, 11, 21, 9, 0, 0, DateTimeKind.Utc);
            Guid ItemOf(Guid variant) => order.GetProperty("items").EnumerateArray().First(i => i.GetProperty("variantId").GetGuid() == variant).GetProperty("id").GetGuid();
            var returned = await session.PostIdempotentAsync(
                $"/api/v1/orders/{order.GetProperty("id").GetGuid()}/returns",
                new { lines = new object[] { new { orderItemId = ItemOf(va), quantity = 1, restock = true }, new { orderItemId = ItemOf(vb), quantity = 1, restock = false } }, returnedOn = "2026-11-21", reason = "مقاس غلط" },
                Guid.NewGuid()).OkJsonAsync();
            Assert.Equal("14.620", F(returned, "returnedAmount"));

            factory.Clock.UtcNow = new DateTime(2026, 11, 22, 9, 0, 0, DateTimeKind.Utc);

            // ----- P&L: this month (1–22 Nov) against 1–22 Oct -----
            var pnl = await session.GetJsonAsync("/api/v1/reports/pnl");
            var p = pnl.GetProperty("period");
            Assert.Equal(("month", "2026-11-01", "2026-11-22", "2026-10-01", "2026-10-22", "day"), (F(p, "period"), F(p, "from"), F(p, "to"), F(p, "previousFrom"), F(p, "previousTo"), F(p, "bucket")));
            var cur = pnl.GetProperty("current");
            Assert.Equal(("41.000", "14.620", "26.380", "12.000", "14.380", "4.000", "10.380"), (F(cur, "sales"), F(cur, "returns"), F(cur, "netSales"), F(cur, "cogs"), F(cur, "grossProfit"), F(cur, "expenses"), F(cur, "netProfit")));
            Assert.Equal("13.000", F(pnl.GetProperty("previous"), "netProfit"));
            Assert.True(pnl.GetProperty("hasPrevious").GetBoolean());
            var ch = pnl.GetProperty("changes");
            Assert.Equal((25.6m, 50.0m, JsonValueKind.Null, -20.2m), (ch.GetProperty("sales").GetDecimal(), ch.GetProperty("cogs").GetDecimal(), ch.GetProperty("expenses").ValueKind, ch.GetProperty("netProfit").GetDecimal()));
            Assert.Equal("-2.620", F(pnl, "netProfitChange"));
            var driver = pnl.GetProperty("driver");
            Assert.Equal(("sales", "5.380", "5.380"), (F(driver, "kind"), F(driver, "change"), F(driver, "effect")));
            var cat = pnl.GetProperty("expensesByCategory")[0];
            Assert.Equal(("ads", "4.000", "0.000"), (F(cat, "code"), F(cat, "current"), F(cat, "previous")));
            Assert.Equal("0.000", F(pnl, "expectedSales"));

            // ----- Sales: the same month -----
            var s = await session.GetJsonAsync("/api/v1/reports/sales");
            Assert.Equal(("26.380", "14.380", 1, "26.380", "2.000"), (F(s, "netSales"), F(s, "grossProfit"), s.GetProperty("orders").GetInt32(), F(s, "averageOrderValue"), F(s, "deliveryFees")));
            Assert.Equal(("21.000", 1, "21.000"), (F(s, "previousNetSales"), s.GetProperty("previousOrders").GetInt32(), F(s, "previousAverageOrderValue")));
            var products = s.GetProperty("products").EnumerateArray().ToList();
            Assert.Equal(2, products.Count);
            Assert.Equal(("كريم", 2, "19.500", "11.500"), (F(products[0], "name"), products[0].GetProperty("quantity").GetInt32(), F(products[0], "revenue"), F(products[0], "grossProfit"))); // 29.25 − 9.75; cost 12 − 4
            Assert.Equal(("صابونة", 1, "4.880", "0.880"), (F(products[1], "name"), products[1].GetProperty("quantity").GetInt32(), F(products[1], "revenue"), F(products[1], "grossProfit"))); // 9.75 − 4.87; damaged keeps cost 4
            Assert.Equal(JsonValueKind.Null, s.GetProperty("otherProducts").ValueKind);
            Assert.Equal(("instagram", "26.380", 1), (F(s.GetProperty("channels")[0], "channel"), F(s.GetProperty("channels")[0], "amount"), s.GetProperty("channels")[0].GetProperty("orders").GetInt32()));
            var weekdays = s.GetProperty("weekdays").EnumerateArray().Select(w => w.GetString()).ToList();
            Assert.Equal(("41.000", "-14.620", 5), (weekdays[5], weekdays[6], s.GetProperty("bestWeekday").GetInt32())); // Friday 20th, Saturday 21st
            var series = s.GetProperty("series").EnumerateArray().ToList();
            Assert.Equal(22, series.Count);
            Assert.Equal(("41.000", "25.000"), (F(series[19], "sales"), F(series[19], "grossProfit")));
            Assert.Equal(("-14.620", "-10.620"), (F(series[20], "sales"), F(series[20], "grossProfit")));

            // ----- Last month: October against September (empty) -----
            var last = await session.GetJsonAsync("/api/v1/reports/pnl?period=last_month");
            Assert.Equal(("2026-10-01", "2026-10-31", "2026-09-01", "2026-09-30"), (F(last.GetProperty("period"), "from"), F(last.GetProperty("period"), "to"), F(last.GetProperty("period"), "previousFrom"), F(last.GetProperty("period"), "previousTo")));
            Assert.Equal(("21.000", false, JsonValueKind.Null, JsonValueKind.Null, JsonValueKind.Null), (F(last.GetProperty("current"), "sales"), last.GetProperty("hasPrevious").GetBoolean(), last.GetProperty("driver").ValueKind, last.GetProperty("changes").GetProperty("sales").ValueKind, last.GetProperty("expectedSales").ValueKind));

            // ----- Custom range over a year is bucketed by month -----
            var year = await session.GetJsonAsync("/api/v1/reports/sales?period=custom&from=2025-11-23&to=2026-11-22");
            Assert.Equal("month", F(year.GetProperty("period"), "bucket"));
            Assert.Equal(13, year.GetProperty("series").GetArrayLength()); // Nov 2025 (from the 23rd) … Nov 2026
            Assert.Equal("47.380", F(year, "netSales"));

            // ----- Hub -----
            var hub = await session.GetJsonAsync("/api/v1/reports/summary");
            Assert.Equal(("10.380", "26.380", 14, 1, "400.000"), (F(hub, "netProfit"), F(hub, "netSales"), hub.GetProperty("series").GetArrayLength(), hub.GetProperty("customers").GetInt32(), F(hub, "stockValue"))); // 96 × 4 + 8 × 2
            Assert.Equal("كريم", F(hub.GetProperty("topProducts")[0], "name"));

            // ----- Another business sees none of it -----
            var other = await factory.OnboardedAsync();
            var empty = await other.GetJsonAsync("/api/v1/reports/sales");
            Assert.Equal(("0.000", 0, "0.000"), (F(empty, "netSales"), empty.GetProperty("orders").GetInt32(), F(empty, "averageOrderValue")));
            Assert.Empty(empty.GetProperty("products").EnumerateArray());
            Assert.Equal(JsonValueKind.Null, empty.GetProperty("bestWeekday").ValueKind);
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    [Theory]
    [InlineData("period=year", "report.invalid_period")]
    [InlineData("period=custom&from=2026-01-01", "report.range_required")]
    [InlineData("period=custom&from=2026-02-01&to=2026-01-01", "report.range_reversed")]
    [InlineData("period=custom&from=2020-01-01&to=2099-01-01", "report.range_future")]
    [InlineData("period=custom&from=2020-01-01&to=2021-12-31", "report.range_too_long")]
    public async Task Invalid_periods_are_rejected(string query, string code)
    {
        var session = await factory.OnboardedAsync();
        await (await session.GetAsync($"/api/v1/reports/pnl?{query}")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, code);
    }
}
