using System.Diagnostics;
using Lamma.Api.IntegrationTests.Infrastructure;
using Xunit.Abstractions;

namespace Lamma.Api.IntegrationTests;

/// <summary>
/// 9.A3 performance check, opt-in (set <c>LAMMA_PERF=1</c>): 500 orders, half delivered, then the dashboard is timed.
/// Kept out of the normal run (D-106) because seeding takes about a minute.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class DashboardPerfTests(LammaApiFactory factory, ITestOutputHelper output)
{
    [Fact]
    public async Task Dashboard_on_500_orders_answers_quickly()
    {
        if (Environment.GetEnvironmentVariable("LAMMA_PERF") != "1")
        {
            return;
        }

        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var item = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100000));
        var variant = OrderApi.VariantAt(item, 0);
        for (var i = 0; i < 500; i++)
        {
            var order = await session.OrderAsync(customer, variant, 1 + (i % 3), status: i % 2 == 0 ? "confirmed" : "new");
            if (i % 2 == 0)
            {
                await session.MovedAsync(order, "delivered");
            }
        }

        await session.GetJsonAsync("/api/v1/dashboard"); // warm-up
        var times = new List<long>();
        for (var i = 0; i < 5; i++)
        {
            var watch = Stopwatch.StartNew();
            await session.GetJsonAsync("/api/v1/dashboard");
            times.Add(watch.ElapsedMilliseconds);
        }

        var watchIndicators = Stopwatch.StartNew();
        await session.GetJsonAsync("/api/v1/dashboard/indicators");
        output.WriteLine($"dashboard ms: {string.Join(", ", times)} · median {times.Order().ElementAt(2)} · indicators {watchIndicators.ElapsedMilliseconds} ms");
        Assert.True(times.Order().ElementAt(2) < 1500, "The dashboard should answer in well under 1.5 s on 500 orders.");
    }
}
