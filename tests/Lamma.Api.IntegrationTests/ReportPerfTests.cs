using System.Diagnostics;
using Lamma.Api.IntegrationTests.Infrastructure;
using Xunit.Abstractions;

namespace Lamma.Api.IntegrationTests;

/// <summary>
/// 10.A5 performance check, opt-in (set <c>LAMMA_PERF=1</c>): 500 orders (half delivered, some returned), then the
/// reports are timed over a 366-day custom range. Kept out of the normal run (D-106) because seeding takes about a minute.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ReportPerfTests(LammaApiFactory factory, ITestOutputHelper output)
{
    [Fact]
    public async Task Reports_on_500_orders_over_a_year_answer_quickly()
    {
        if (Environment.GetEnvironmentVariable("LAMMA_PERF") != "1")
        {
            return;
        }

        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var a = OrderApi.VariantAt(await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100000)), 0);
        var b = OrderApi.VariantAt(await session.CreateAsync(CatalogApi.Simple("صابونة", price: "5", cost: "2", opening: 100000)), 0);
        for (var i = 0; i < 500; i++)
        {
            var order = await session.OrderAsync(customer, i % 2 == 0 ? "confirmed" : "new", (a, 1 + (i % 3)), (b, 1));
            if (i % 2 == 0)
            {
                order = await session.MovedAsync(order, "delivered");
                if (i % 10 == 0)
                {
                    var item = order.GetProperty("items")[0].GetProperty("id").GetGuid();
                    await session.PostIdempotentAsync(
                        $"/api/v1/orders/{order.GetProperty("id").GetGuid()}/returns",
                        new { lines = new[] { new { orderItemId = item, quantity = 1, restock = true } }, returnedOn = FinanceApi.Day(factory.Today()), reason = "مقاس غلط" },
                        Guid.NewGuid());
                }
            }
        }

        var to = factory.Today();
        var urls = new[]
        {
            "/api/v1/reports/summary",
            "/api/v1/reports/pnl",
            $"/api/v1/reports/sales?period=custom&from={FinanceApi.Day(to.AddDays(-365))}&to={FinanceApi.Day(to)}",
        };
        foreach (var url in urls)
        {
            await session.GetJsonAsync(url); // warm-up
            var times = new List<long>();
            for (var i = 0; i < 5; i++)
            {
                var watch = Stopwatch.StartNew();
                await session.GetJsonAsync(url);
                times.Add(watch.ElapsedMilliseconds);
            }

            var median = times.Order().ElementAt(2);
            output.WriteLine($"{url}: {string.Join(", ", times)} ms · median {median}");
            Assert.True(median < 1500, $"{url} should answer in well under 1.5 s on 500 orders.");
        }
    }
}
