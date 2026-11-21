using System.Globalization;
using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

internal static class FinanceApi
{
    public static string Day(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static Task<HttpResponseMessage> SettleAsync(this ApiSession session, IEnumerable<JsonElement> orders, string received, DateOnly on, Guid? key = null)
        => session.PostIdempotentAsync("/api/v1/courier/settlements", new { orderIds = orders.Select(o => o.GetProperty("id").GetGuid()).ToArray(), receivedAmount = received, settledOn = Day(on) }, key ?? Guid.NewGuid());

    public static async Task<JsonElement> GetJsonAsync(this ApiSession session, string url)
    {
        var response = await session.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.JsonAsync();
    }

    public static async Task<JsonElement> CategoryAsync(this ApiSession session, string code)
        => (await session.GetJsonAsync("/api/v1/expense-categories")).EnumerateArray().Single(c => c.GetProperty("code").GetString() == code);

    public static Task<HttpResponseMessage> SpendAsync(this ApiSession session, Guid categoryId, string amount, DateOnly on, Guid? key = null)
        => session.PostIdempotentAsync("/api/v1/expenses", new { amount, categoryId, spentOn = Day(on), note = "إعلان ريلز" }, key ?? Guid.NewGuid());

    public static async Task<JsonElement> DeliveredAsync(this ApiSession session, Guid customer, Guid variant, int qty, string method)
        => await session.MovedAsync(await session.OrderAsync(customer, variant, qty, method: method), "delivered");
}

[Collection(ApiCollection.Name)]
public sealed class CourierExpenseApiTests(LammaApiFactory factory)
{
    private async Task<(ApiSession Session, Guid Customer, Guid Variant)> ShopAsync()
    {
        var session = await factory.OnboardedAsync();
        var customer = await session.CustomerAsync();
        var item = await session.CreateAsync(CatalogApi.Simple("كريم", price: "10", cost: "4", opening: 100));
        return (session, customer, OrderApi.VariantAt(item, 0));
    }

    [Fact]
    public async Task Settlement_pays_the_orders_books_the_difference_once_and_reversal_restores_everything()
    {
        var (session, customer, variant) = await ShopAsync();
        var a = await session.DeliveredAsync(customer, variant, 1, "cod"); // 11
        var b = await session.DeliveredAsync(customer, variant, 2, "cod"); // 21
        await session.MovedAsync(await session.OrderAsync(customer, variant, 1, method: "cod"), "courier"); // on the way 11
        var today = factory.Today();

        var before = await session.GetJsonAsync("/api/v1/courier");
        Assert.Equal(("32.000", 2, "11.000", 1, "شركة التوصيل"), (before.GetProperty("held").GetString(), before.GetProperty("waitingCount").GetInt32(), before.GetProperty("onTheWay").GetString(), before.GetProperty("onTheWayCount").GetInt32(), before.GetProperty("companyName").GetString()));

        await (await session.SettleAsync([a, b], "32.01", today)).AssertProblemAsync(HttpStatusCode.Conflict, "settlement.received_too_high");
        var key = Guid.NewGuid();
        var first = await session.SettleAsync([a, b], "30", today, key);
        var retry = await session.SettleAsync([a, b], "30", today, key);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var settlement = await first.JsonAsync();
        Assert.Equal(settlement.GetProperty("id").GetGuid(), (await retry.JsonAsync()).GetProperty("id").GetGuid());
        Assert.Equal(("32.000", "30.000", "2.000", 2), (settlement.GetProperty("expectedAmount").GetString(), settlement.GetProperty("receivedAmount").GetString(), settlement.GetProperty("difference").GetString(), settlement.GetProperty("orders").GetArrayLength()));

        var order = await session.GetJsonAsync($"/api/v1/orders/{b.GetProperty("id").GetGuid()}");
        Assert.Equal(("paid", "0.000"), (order.Status(), order.GetProperty("remaining").GetString()));
        var expenses = await session.GetJsonAsync("/api/v1/expenses");
        var expense = Assert.Single(expenses.GetProperty("items").EnumerateArray());
        Assert.Equal(("2.000", "delivery", "courier_settlement"), (expense.GetProperty("amount").GetString(), expense.GetProperty("categoryCode").GetString(), expense.GetProperty("source").GetString()));
        var after = await session.GetJsonAsync("/api/v1/courier");
        Assert.Equal(("0.000", "2.000"), (after.GetProperty("held").GetString(), after.GetProperty("monthFees").GetString()));

        await (await session.SettleAsync([a], "11", today)).AssertProblemAsync(HttpStatusCode.Conflict, "settlement.order_not_held");
        var paymentId = order.GetProperty("payments")[0].GetProperty("paymentId").GetGuid();
        await (await session.ReverseAsync(paymentId)).AssertProblemAsync(HttpStatusCode.Conflict, "payment.from_settlement");
        await (await session.PostIdempotentAsync($"/api/v1/expenses/{expense.GetProperty("id").GetGuid()}/void", new { reason = (string?)null }, Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.Conflict, "expense.from_settlement");

        var reverseUrl = $"/api/v1/courier/settlements/{settlement.GetProperty("id").GetGuid()}/reverse";
        var reversed = await session.PostIdempotentAsync(reverseUrl, new { reason = "غلط" }, Guid.NewGuid()).OkJsonAsync();
        Assert.True(reversed.GetProperty("isReversed").GetBoolean());
        Assert.Equal("32.000", (await session.GetJsonAsync("/api/v1/courier")).GetProperty("held").GetString());
        Assert.True((await session.GetJsonAsync("/api/v1/expenses")).GetProperty("items")[0].GetProperty("isVoided").GetBoolean());
        await (await session.PostIdempotentAsync(reverseUrl, new { reason = (string?)null }, Guid.NewGuid())).AssertProblemAsync(HttpStatusCode.Conflict, "settlement.already_reversed");
        Assert.Equal(HttpStatusCode.Created, (await session.SettleAsync([a], "11", today)).StatusCode); // free again after the reversal
    }

    [Fact]
    public async Task Two_settlements_racing_for_the_same_order_one_wins()
    {
        var (session, customer, variant) = await ShopAsync();
        await session.RefreshTokenAsync();
        var order = await session.DeliveredAsync(customer, variant, 1, "cod");
        var today = factory.Today();

        var responses = await Task.WhenAll(session.SettleAsync([order], "11", today), session.SettleAsync([order], "10", today));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        await responses.Single(r => r.StatusCode != HttpStatusCode.Created).AssertProblemAsync(HttpStatusCode.Conflict, "settlement.order_not_held");
        Assert.Equal(1, (await session.GetJsonAsync("/api/v1/courier/settlements")).GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Categories_default_once_delivery_is_fixed_and_expenses_void_and_summarise()
    {
        var session = await factory.OnboardedAsync();
        await session.RefreshTokenAsync();
        var lists = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => session.GetAsync("/api/v1/expense-categories")));
        Assert.All(lists, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var categories = await session.GetJsonAsync("/api/v1/expense-categories");
        Assert.Equal(["ads", "delivery", "packaging", "rent", "other"], categories.EnumerateArray().Select(c => c.GetProperty("code").GetString()));

        var delivery = await session.CategoryAsync("delivery");
        Assert.True(delivery.GetProperty("isSystem").GetBoolean());
        await (await session.PutAsync($"/api/v1/expense-categories/{delivery.GetProperty("id").GetGuid()}", new { name = "شحن" })).AssertProblemAsync(HttpStatusCode.Conflict, "expense_category.system");
        await (await session.PostAsync($"/api/v1/expense-categories/{delivery.GetProperty("id").GetGuid()}/archive")).AssertProblemAsync(HttpStatusCode.Conflict, "expense_category.system");
        Assert.Equal(HttpStatusCode.Created, (await session.PostAsync("/api/v1/expense-categories", new { name = "تصوير" })).StatusCode);
        await (await session.PostAsync("/api/v1/expense-categories", new { name = "تصوير" })).AssertProblemAsync(HttpStatusCode.Conflict, "expense_category.duplicate");

        var ads = (await session.CategoryAsync("ads")).GetProperty("id").GetGuid();
        var today = factory.Today();
        var key = Guid.NewGuid();
        var created = await session.SpendAsync(ads, "7.5", today, key);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await session.SpendAsync(ads, "7.5", today, key)).StatusCode); // replay, applied once
        await (await session.SpendAsync(ads, "5", today.AddDays(1))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "expense.invalid_date");

        var summary = await session.GetJsonAsync("/api/v1/expenses/summary");
        Assert.Equal(("7.500", 1, ads), (summary.GetProperty("total").GetString(), summary.GetProperty("count").GetInt32(), summary.GetProperty("lastCategoryId").GetGuid()));
        var expenseId = (await created.JsonAsync()).GetProperty("id").GetGuid();
        await session.PostIdempotentAsync($"/api/v1/expenses/{expenseId}/void", new { reason = "دخلت غلط" }, Guid.NewGuid()).OkJsonAsync();
        Assert.Equal("0.000", (await session.GetJsonAsync("/api/v1/expenses/summary")).GetProperty("total").GetString());
    }

    [Fact]
    public async Task Finance_overview_figures_are_exact()
    {
        var (session, customer, variant) = await ShopAsync();
        var today = factory.Today();
        var cash = await session.DeliveredAsync(customer, variant, 2, "cash"); // 21, cost 8
        await session.PayOrderAsync(cash, "10", today).OkJsonAsync();
        var cod = await session.DeliveredAsync(customer, variant, 1, "cod");   // 11, cost 4
        Assert.Equal(HttpStatusCode.Created, (await session.SettleAsync([cod], "10", today)).StatusCode); // courier kept 1
        await session.OrderAsync(customer, variant, 1);                        // confirmed 11: expected sales
        var ads = (await session.CategoryAsync("ads")).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Created, (await session.SpendAsync(ads, "5", today)).StatusCode);

        var o = await session.GetJsonAsync("/api/v1/finance/overview");

        string F(string name) => o.GetProperty(name).GetString()!;
        Assert.Equal(("32.000", 2, "12.000", "20.000"), (F("sales"), o.GetProperty("deliveredCount").GetInt32(), F("cogs"), F("grossProfit")));
        Assert.Equal(("6.000", "14.000"), (F("expenses"), F("netProfit")));
        Assert.Equal(("20.000", "5.000", "15.000"), (F("cashReceived"), F("cashOut"), F("cashFlow")));
        Assert.Equal(("11.000", "0.000", "11.000"), (F("customerDues"), F("courierHeld"), F("expectedSales")));
        Assert.Equal(["ads", "delivery"], o.GetProperty("expensesByCategory").EnumerateArray().Select(c => c.GetProperty("code").GetString()));
    }

    [Fact]
    public async Task Another_business_cannot_settle_void_or_see()
    {
        var (owner, customer, variant) = await ShopAsync();
        var order = await owner.DeliveredAsync(customer, variant, 1, "cod");
        var ads = (await owner.CategoryAsync("ads")).GetProperty("id").GetGuid();
        var expense = await (await owner.SpendAsync(ads, "3", factory.Today())).JsonAsync();

        var other = await factory.OnboardedAsync();
        await (await other.SettleAsync([order], "11", factory.Today())).AssertProblemAsync(HttpStatusCode.NotFound, "order.not_found");
        await (await other.PostIdempotentAsync($"/api/v1/expenses/{expense.GetProperty("id").GetGuid()}/void", new { reason = (string?)null }, Guid.NewGuid()))
            .AssertProblemAsync(HttpStatusCode.NotFound, "expense.not_found");
        await (await other.SpendAsync(ads, "1", factory.Today())).AssertProblemAsync(HttpStatusCode.NotFound, "expense_category.not_found");
        Assert.Equal(0, (await other.GetJsonAsync("/api/v1/courier")).GetProperty("waitingCount").GetInt32());
        Assert.Equal(0, (await other.GetJsonAsync("/api/v1/expenses")).GetProperty("totalCount").GetInt32());
    }
}
