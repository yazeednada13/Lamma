using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class OnboardingTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Business_types_lists_the_thirteen_types_in_arabic()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        var types = await (await session.GetAsync("/api/v1/onboarding/business-types")).JsonAsync();

        Assert.Equal(13, types.GetArrayLength());
        Assert.Equal("clothing", types[0].GetProperty("code").GetString());
        Assert.Equal("ملابس وأزياء", types[0].GetProperty("labelAr").GetString());
    }

    [Fact]
    public async Task Onboarding_creates_the_business_and_starts_a_thirty_day_trial()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        var account = await session.OnboardAsync("بوتيك ريم", "perfume", "instagram");

        Assert.True(account.GetProperty("isOnboarded").GetBoolean());
        var business = account.GetProperty("business");
        Assert.Equal("بوتيك ريم", business.GetProperty("name").GetString());
        Assert.Equal("perfume", business.GetProperty("businessType").GetString());
        Assert.Equal(30, business.GetProperty("trialDaysRemaining").GetInt32());
        Assert.Equal("trial", business.GetProperty("plan").GetString());
    }

    [Fact]
    public async Task Onboarding_twice_is_a_conflict()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();

        var again = await session.PostAsync("/api/v1/onboarding", new { businessName = "ثاني", businessType = "other", salesChannels = new[] { "other" } });

        await again.AssertProblemAsync(HttpStatusCode.Conflict, "onboarding.already_completed");
    }

    [Fact]
    public async Task Concurrent_double_submit_creates_exactly_one_business()
    {
        var session = factory.NewSession();
        var account = await session.SignUpAsync();
        var userId = account.GetProperty("id").GetGuid();

        var body = new { businessName = "سباق", businessType = "gifts", salesChannels = new[] { "whatsapp" } };
        var results = await Task.WhenAll(
            session.PostAsync("/api/v1/onboarding", body),
            session.PostAsync("/api/v1/onboarding", body),
            session.PostAsync("/api/v1/onboarding", body));

        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.Created), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LammaDbContext>();
        Assert.Equal(1, await db.Memberships.CountAsync(m => m.UserId == userId));
        Assert.Equal(1, await db.Businesses.CountAsync(b => b.Name == "سباق" && db.Memberships.Any(m => m.UserId == userId && m.BusinessId == b.Id)));
        Assert.Equal(0, await db.Businesses.CountAsync(b => b.Name == "سباق" && !db.Memberships.Any(m => m.BusinessId == b.Id)));
    }

    [Theory]
    [InlineData("Clothing", new[] { "instagram" }, "businessType")]
    [InlineData("clothing", new string[0], "salesChannels")]
    [InlineData("clothing", new[] { "tiktok" }, "salesChannels[0]")]
    public async Task Invalid_onboarding_input_is_a_field_error(string type, string[] channels, string field)
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        var response = await session.PostAsync("/api/v1/onboarding", new { businessName = "x", businessType = type, salesChannels = channels });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty(field, out _), $"expected error on {field}: {body}");
    }
}

[Collection(ApiCollection.Name)]
public sealed class SettingsTests(LammaApiFactory factory)
{
    private static object AllChannels(params string[] enabled)
        => new { channels = new[] { "instagram", "whatsapp", "facebook", "other" }.Select(c => new { channel = c, isEnabled = enabled.Contains(c) }) };

    private static object AllMethods(params string[] enabled)
        => new { methods = new[] { "cash", "cliq", "bank_transfer", "cod", "zain_cash", "orange_money" }.Select(m => new { method = m, isEnabled = enabled.Contains(m) }) };

    [Fact]
    public async Task Settings_require_a_business()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        await (await session.GetAsync("/api/v1/settings/business")).AssertProblemAsync(HttpStatusCode.Forbidden, "business.not_onboarded");
    }

    [Fact]
    public async Task Business_profile_can_be_read_and_updated()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync("قبل");

        var initial = await (await session.GetAsync("/api/v1/settings/business")).JsonAsync();
        Assert.Equal("قبل", initial.GetProperty("name").GetString());
        Assert.Equal(5, initial.GetProperty("defaultLowStockThreshold").GetInt32());
        Assert.Equal("JOD", initial.GetProperty("currency").GetString());

        var updated = await session.PutAsync("/api/v1/settings/business", new { name = "بعد", businessType = "books", defaultLowStockThreshold = 3 });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var body = await updated.JsonAsync();
        Assert.Equal("بعد", body.GetProperty("name").GetString());
        Assert.Equal("books", body.GetProperty("businessType").GetString());
        Assert.Equal(3, body.GetProperty("defaultLowStockThreshold").GetInt32());

        var account = await (await session.GetAsync("/api/v1/account")).JsonAsync();
        Assert.Equal("بعد", account.GetProperty("business").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Out_of_range_threshold_is_rejected()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();

        var response = await session.PutAsync("/api/v1/settings/business", new { name = "x", businessType = "books", defaultLowStockThreshold = 2000 });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty("defaultLowStockThreshold", out _));
    }

    [Fact]
    public async Task Sales_channels_reflect_onboarding_and_can_be_changed_but_not_all_disabled()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync(); // instagram + whatsapp

        var channels = (await (await session.GetAsync("/api/v1/settings/sales-channels")).JsonAsync()).GetProperty("channels");
        Assert.Equal(4, channels.GetArrayLength());
        Assert.Equal(new[] { "instagram", "whatsapp" }, channels.EnabledCodes("channel"));

        var changed = await session.PutAsync("/api/v1/settings/sales-channels", AllChannels("facebook"));
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        Assert.Equal(new[] { "facebook" }, (await changed.JsonAsync()).GetProperty("channels").EnabledCodes("channel"));

        var none = await session.PutAsync("/api/v1/settings/sales-channels", AllChannels());
        await none.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "settings.channel_required");
    }

    [Fact]
    public async Task Payment_methods_default_to_the_four_common_methods()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();

        var methods = (await (await session.GetAsync("/api/v1/settings/payment-methods")).JsonAsync()).GetProperty("methods");

        Assert.Equal(6, methods.GetArrayLength());
        Assert.Equal(new[] { "cash", "cliq", "bank_transfer", "cod" },
            methods.EnabledCodes("method"));
    }

    [Fact]
    public async Task Payment_methods_update_requires_the_full_list_and_one_enabled()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();

        var ok = await session.PutAsync("/api/v1/settings/payment-methods", AllMethods("cash", "zain_cash"));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var none = await session.PutAsync("/api/v1/settings/payment-methods", AllMethods());
        await none.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "settings.payment_method_required");

        var partial = await session.PutAsync("/api/v1/settings/payment-methods", new { methods = new[] { new { method = "cash", isEnabled = true } } });
        await partial.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
    }
}

[Collection(ApiCollection.Name)]
public sealed class TenancyTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Each_owner_only_sees_and_changes_their_own_business()
    {
        var a = factory.NewSession();
        await a.SignUpAndOnboardAsync("مشروع أ");
        var b = factory.NewSession();
        await b.SignUpAndOnboardAsync("مشروع ب");

        var aAccount = await (await a.GetAsync("/api/v1/account")).JsonAsync();
        var aBusinessId = aAccount.GetProperty("business").GetProperty("id").GetGuid();

        // B tries to smuggle A's business id into the body: the field is ignored.
        var bUpdate = await b.PutAsync("/api/v1/settings/business", new { businessId = aBusinessId, name = "اختراق", businessType = "other", defaultLowStockThreshold = 1 });
        Assert.Equal(HttpStatusCode.OK, bUpdate.StatusCode);

        var aSettings = await (await a.GetAsync("/api/v1/settings/business")).JsonAsync();
        Assert.Equal("مشروع أ", aSettings.GetProperty("name").GetString());
        Assert.Equal(5, aSettings.GetProperty("defaultLowStockThreshold").GetInt32());

        var bSettings = await (await b.GetAsync("/api/v1/settings/business")).JsonAsync();
        Assert.Equal("اختراق", bSettings.GetProperty("name").GetString());

        // A query string business id is ignored too.
        var aViaQuery = await (await a.GetAsync($"/api/v1/settings/business?businessId={Guid.NewGuid()}")).JsonAsync();
        Assert.Equal("مشروع أ", aViaQuery.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Channel_changes_do_not_leak_between_businesses()
    {
        var a = factory.NewSession();
        await a.SignUpAndOnboardAsync("قنوات أ");
        var b = factory.NewSession();
        await b.SignUpAndOnboardAsync("قنوات ب");

        await a.PutAsync("/api/v1/settings/sales-channels", new { channels = new[] { "instagram", "whatsapp", "facebook", "other" }.Select(c => new { channel = c, isEnabled = c == "other" }) });

        var bChannels = (await (await b.GetAsync("/api/v1/settings/sales-channels")).JsonAsync()).GetProperty("channels");
        Assert.Equal(new[] { "instagram", "whatsapp" }, bChannels.EnabledCodes("channel"));
    }
}

[Collection(ApiCollection.Name)]
public sealed class AccountTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Owner_can_update_their_name()
    {
        var session = factory.NewSession();
        await session.SignUpAsync(fullName: "ريم");

        var response = await session.PutAsync("/api/v1/account", new { fullName = "ريم الخطيب" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ريم الخطيب", (await response.JsonAsync()).GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task Wrong_current_password_is_a_field_error()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        var response = await session.PostAsync("/api/v1/account/change-password", new { currentPassword = "nottheone1", newPassword = "fresh2026" });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "auth.wrong_password");
        Assert.True(body.GetProperty("errors").TryGetProperty("currentPassword", out _));
    }

    [Fact]
    public async Task Changing_the_password_keeps_this_session_and_ends_other_sessions()
    {
        var email = ApiSession.NewEmail();
        var current = factory.NewSession();
        await current.SignUpAsync(email);
        var other = factory.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await other.LoginAsync(email)).StatusCode);

        var change = await current.PostAsync("/api/v1/account/change-password", new { currentPassword = ApiSession.DefaultPassword, newPassword = "fresh2026" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await current.GetAsync("/api/v1/account")).StatusCode);
        await (await other.GetAsync("/api/v1/account")).AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.unauthenticated");
        Assert.Equal(HttpStatusCode.OK, (await factory.NewSession().LoginAsync(email, "fresh2026")).StatusCode);
    }

    [Fact]
    public async Task Trial_days_count_down_with_the_clock()
    {
        var session = factory.NewSession();
        await session.SignUpAndOnboardAsync();
        var original = factory.Clock.UtcNow;
        try
        {
            factory.Clock.UtcNow = original.AddDays(10);
            var account = await (await session.GetAsync("/api/v1/account")).JsonAsync();
            Assert.Equal(20, account.GetProperty("business").GetProperty("trialDaysRemaining").GetInt32());

            factory.Clock.UtcNow = original.AddDays(45);
            account = await (await session.GetAsync("/api/v1/account")).JsonAsync();
            Assert.Equal(0, account.GetProperty("business").GetProperty("trialDaysRemaining").GetInt32());
        }
        finally
        {
            factory.Clock.UtcNow = original;
        }
    }
}

[Collection(ApiCollection.Name)]
public sealed class ErrorShapeTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Malformed_json_is_400()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/login", new StringContent("{bad json", Encoding.UTF8, "application/json"));
        await response.AssertProblemAsync(HttpStatusCode.BadRequest, "request.malformed");
    }

    [Fact]
    public async Task Anonymous_access_is_401()
        => await (await factory.NewSession().GetAsync("/api/v1/account")).AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.unauthenticated");

    [Fact]
    public async Task Unknown_route_is_404_problem()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();
        await (await session.GetAsync("/api/v1/does-not-exist")).AssertProblemAsync(HttpStatusCode.NotFound, "http.404");
    }

    [Fact]
    public async Task Validation_errors_use_camel_case_keys_and_arabic_messages()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/signup", new { fullName = "", email = "nope", password = "x" });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        var errors = body.GetProperty("errors");
        foreach (var key in new[] { "fullName", "email", "password" })
        {
            var messages = errors.GetProperty(key);
            Assert.True(messages.GetArrayLength() > 0);
            Assert.Matches(@"\p{IsArabic}", messages[0].GetString()!);
        }
    }

    [Fact]
    public async Task Unexpected_errors_are_500_without_internal_details()
    {
        var response = await factory.NewSession().GetAsync("/api/test/throw");

        var body = await response.AssertProblemAsync(HttpStatusCode.InternalServerError, "server.error");
        Assert.DoesNotContain("secret internal detail", body.ToString());
        Assert.DoesNotContain("InvalidOperationException", body.ToString());
    }
}

[Collection(ApiCollection.Name)]
public sealed class HostTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Health_is_anonymous()
        => Assert.Equal(HttpStatusCode.OK, (await factory.NewSession().GetAsync("/health")).StatusCode);

    [Fact]
    public void Container_builds_with_scope_and_build_validation_and_resolves_services()
    {
        // Program enables ValidateOnBuild/ValidateScopes outside Production, so building the host proves the graph is valid.
        using var scope = factory.Services.CreateScope();
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<Lamma.Application.Identity.IAuthService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<Lamma.Application.Businesses.IOnboardingService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<Lamma.Application.Businesses.IBusinessSettingsService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<Lamma.Application.Accounts.IAccountService>());
        Assert.Same(
            scope.ServiceProvider.GetRequiredService<Lamma.Application.Common.IUnitOfWork>(),
            scope.ServiceProvider.GetRequiredService<LammaDbContext>());
    }

    [Fact]
    public async Task Antiforgery_endpoint_returns_a_token()
    {
        var response = await factory.NewSession().GetAsync("/api/v1/auth/antiforgery");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()));
    }
}
