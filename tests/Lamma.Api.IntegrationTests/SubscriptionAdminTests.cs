using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using Lamma.Api.Controllers;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Api.Security;
using Lamma.Application.Common.Email;
using Lamma.Application.Subscriptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Lamma.Api.IntegrationTests;

internal static class SubscriptionApi
{
    public static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 1, 2, 3, 4];

    public static Task<HttpResponseMessage> PayAsync(this ApiSession session, string plan, byte[]? file = null, string fileName = "proof.png")
    {
        var form = new MultipartFormDataContent { { new StringContent(plan), "plan" } };
        var content = new ByteArrayContent(file ?? Png);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(content, "file", fileName);
        return session.SendAsync(HttpMethod.Post, "/api/v1/subscription/payment-requests", form, withToken: true, origin: null, headers: new Dictionary<string, string> { ["Idempotency-Key"] = Guid.NewGuid().ToString() });
    }

    public static Task<HttpResponseMessage> AdminPostAsync(this ApiSession session, string url, object? body = null)
        => session.SendAsync(HttpMethod.Post, url, body ?? new { }, withToken: true, origin: null, headers: new Dictionary<string, string> { ["Idempotency-Key"] = Guid.NewGuid().ToString() });

    /// <summary>Signs in the test host's platform admin, creating the account on first use (the role comes at login, D-175).</summary>
    public static async Task<ApiSession> AdminAsync(this LammaApiFactory factory)
    {
        var session = factory.NewSession();
        if ((await session.LoginAsync(LammaApiFactory.AdminEmail)).StatusCode != HttpStatusCode.OK)
        {
            await factory.NewSession().SignUpAsync(LammaApiFactory.AdminEmail, fullName: "إدارة لمّة");
            Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(LammaApiFactory.AdminEmail)).StatusCode);
        }

        return session;
    }

    public static async Task<Guid> BusinessIdAsync(this ApiSession owner)
        => (await owner.GetJsonAsync("/api/v1/account")).GetProperty("business").GetProperty("id").GetGuid();
}

[Collection(ApiCollection.Name)]
public sealed class SubscriptionAdminApiTests(LammaApiFactory factory)
{
    private static string S(JsonElement e, string name) => e.GetProperty(name).GetString()!;

    /// <summary>
    /// The endpoint walk (D-176): every write action of the API is listed and classified, so a new endpoint cannot slip
    /// past read-only mode unnoticed. Business writes are blocked unless explicitly allowed; the allowed set is fixed.
    /// </summary>
    [Fact]
    public void Every_write_endpoint_is_either_blocked_in_read_only_mode_or_explicitly_allowed()
    {
        var unsafeVerbs = new[] { typeof(HttpPostAttribute), typeof(HttpPutAttribute), typeof(HttpDeleteAttribute), typeof(HttpPatchAttribute) };
        var actions = typeof(AuthController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly).Select(m => (Type: t, Method: m)))
            .Where(x => x.Method.GetCustomAttributes().OfType<HttpMethodAttribute>().Any(a => unsafeVerbs.Contains(a.GetType())))
            .ToList();
        Assert.True(actions.Count >= 50, $"expected the API's write endpoints, found {actions.Count}");

        var blocked = new List<string>();
        var allowed = new List<string>();
        var outside = new List<string>();
        foreach (var (type, method) in actions)
        {
            var metadata = type.GetCustomAttributes(true).Concat(method.GetCustomAttributes(true)).ToList();
            var name = $"{type.Name}.{method.Name}";
            if (ReadOnlySubscriptionFilter.AppliesTo(metadata, "POST"))
            {
                blocked.Add(name);
            }
            else if (metadata.OfType<AuthorizeAttribute>().Any(a => a.Policy == Policies.RequireBusiness))
            {
                allowed.Add(name);
            }
            else
            {
                outside.Add(name);
            }
        }

        Assert.Equal(["SubscriptionController.Pay"], allowed); // the only business write allowed while read-only
        // Writes outside the business policy: sign-in, account, onboarding, the public form and the admin area.
        Assert.All(outside, n => Assert.Matches("^(AuthController|AccountController|OnboardingController|PublicSignupController|AdminController)\\.", n));
        Assert.True(blocked.Count >= 40, $"blocked {blocked.Count}");
    }

    [Fact]
    public async Task After_the_trial_and_grace_the_account_is_read_only_but_can_still_read_and_pay()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            var owner = await factory.OnboardedAsync();
            await owner.CustomerAsync();

            factory.Clock.UtcNow = real.AddDays(31);
            var grace = (await owner.GetJsonAsync("/api/v1/account")).GetProperty("business").GetProperty("subscription");
            Assert.Equal(("trial_grace", false), (S(grace, "status"), grace.GetProperty("readOnly").GetBoolean()));
            await owner.CustomerAsync("خلال السماح"); // still writable

            factory.Clock.UtcNow = real.AddDays(34);
            var ended = (await owner.GetJsonAsync("/api/v1/account")).GetProperty("business").GetProperty("subscription");
            Assert.Equal(("trial_ended", true, 0), (S(ended, "status"), ended.GetProperty("readOnly").GetBoolean(), ended.GetProperty("daysLeft").GetInt32()));

            await (await owner.PostAsync("/api/v1/customers", new { name = "ممنوع", channel = "instagram" })).AssertProblemAsync(HttpStatusCode.Forbidden, ReadOnlySubscriptionFilter.Code);
            Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/v1/customers")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/v1/dashboard")).StatusCode);
            Assert.Equal(HttpStatusCode.Created, (await owner.PayAsync("monthly")).StatusCode);
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    [Fact]
    public async Task Owner_pays_by_cliq_and_the_admin_approves_or_rejects()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            await PayAndReviewAsync();
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    private async Task PayAndReviewAsync()
    {
        var owner = await factory.OnboardedAsync();
        var businessId = await owner.BusinessIdAsync();
        var page = await owner.GetJsonAsync("/api/v1/subscription");
        Assert.Equal(("YAZEED133", "YAZEED NADA"), (S(page, "cliqAlias"), S(page, "cliqName")));
        Assert.Matches("^LM-\\d{4,}$", S(page, "referenceCode"));
        Assert.Equal(["monthly", "yearly"], page.GetProperty("plans").EnumerateArray().Select(p => S(p, "plan")));
        Assert.Equal("90.000", S(page.GetProperty("plans")[1], "price"));

        await (await owner.PayAsync("monthly", "not an image"u8.ToArray(), "x.txt")).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "payment_request.invalid_type");
        var paid = await (await owner.PayAsync("yearly")).JsonAsync();
        Assert.Equal(("pending", "90.000"), (S(paid.GetProperty("pending"), "status"), S(paid.GetProperty("pending"), "amount")));
        await (await owner.PayAsync("monthly")).AssertProblemAsync(HttpStatusCode.Conflict, "payment_request.pending_exists");
        var requestId = paid.GetProperty("pending").GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/v1/subscription/payment-requests/{requestId}/proof")).StatusCode);
        var ownerEmail = S(await owner.GetJsonAsync("/api/v1/account"), "email");
        Assert.Contains(factory.Email.Messages, m => m.To == ownerEmail && m.Kind == EmailTemplates.PaymentReceivedKind);
        Assert.Contains(factory.Email.Messages, m => m.To == LammaApiFactory.AdminEmail && m.Kind == EmailTemplates.PaymentForReviewKind);

        var admin = await factory.AdminAsync();
        var queue = await admin.GetJsonAsync("/api/v1/admin/payment-requests?status=pending");
        Assert.Contains(queue.EnumerateArray(), p => p.GetProperty("id").GetGuid() == requestId);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/v1/admin/payment-requests/{requestId}/proof")).StatusCode);

        var approved = await (await admin.AdminPostAsync($"/api/v1/admin/payment-requests/{requestId}/approve")).JsonAsync();
        Assert.Equal("approved", S(approved, "status"));
        var after = await owner.GetJsonAsync("/api/v1/subscription");
        var period = after.GetProperty("periods")[0];
        // Paid during the trial: the year starts the day after the trial and is shown as «paid until» (D-177).
        Assert.Equal(("yearly", "payment", "trial"), (S(period, "plan"), S(period, "source"), S(after.GetProperty("summary"), "status")));
        Assert.Equal(S(period, "endsOn"), S(after.GetProperty("summary"), "paidUntil"));
        Assert.Contains(factory.Email.Messages, m => m.To == ownerEmail && m.Kind == EmailTemplates.PaymentApprovedKind);

        // A second request, rejected with a reason; a new one is possible afterwards.
        factory.Clock.UtcNow = factory.Clock.UtcNow.AddMinutes(5);
        var second = (await (await owner.PayAsync("monthly")).JsonAsync()).GetProperty("pending").GetProperty("id").GetGuid();
        await (await admin.AdminPostAsync($"/api/v1/admin/payment-requests/{second}/reject", new { reason = " " })).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        var rejected = await (await admin.AdminPostAsync($"/api/v1/admin/payment-requests/{second}/reject", new { reason = "التحويل ما وصل" })).JsonAsync();
        Assert.Equal(("rejected", "التحويل ما وصل"), (S(rejected, "status"), S(rejected, "rejectReason")));
        Assert.Equal("التحويل ما وصل", S((await owner.GetJsonAsync("/api/v1/subscription")).GetProperty("lastReviewed"), "rejectReason"));
        Assert.Equal(HttpStatusCode.Created, (await owner.PayAsync("monthly")).StatusCode);

        var detail = await admin.GetJsonAsync($"/api/v1/admin/subscribers/{businessId}");
        Assert.Equal(["approve_payment", "reject_payment"], detail.GetProperty("audit").EnumerateArray().Select(a => S(a, "action")).Order());
    }

    [Fact]
    public async Task Admin_and_owners_never_cross_and_every_admin_change_is_audited()
    {
        var owner = await factory.OnboardedAsync();
        await owner.CustomerAsync();
        var businessId = await owner.BusinessIdAsync();
        await (await owner.GetAsync("/api/v1/admin/dashboard")).AssertProblemAsync(HttpStatusCode.Forbidden, "auth.forbidden");

        var admin = await factory.AdminAsync();
        var account = await admin.GetJsonAsync("/api/v1/account");
        Assert.True(account.GetProperty("isPlatformAdmin").GetBoolean());
        await (await admin.GetAsync("/api/v1/customers")).AssertProblemAsync(HttpStatusCode.Forbidden, "business.not_onboarded");
        await (await admin.PostAsync("/api/v1/onboarding", new { businessName = "x", businessType = "other", salesChannels = new[] { "instagram" } })).AssertProblemAsync(HttpStatusCode.Forbidden, "admin.no_business");

        var dashboard = await admin.GetJsonAsync("/api/v1/admin/dashboard");
        Assert.True(dashboard.GetProperty("activeTrials").GetInt32() >= 1);
        Assert.Equal(8, dashboard.GetProperty("weeks").GetArrayLength());

        var list = await admin.GetJsonAsync($"/api/v1/admin/subscribers?search={Uri.EscapeDataString(S(await owner.GetJsonAsync("/api/v1/account"), "email"))}");
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());

        var trial = await (await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/extend-trial", new { days = 10 })).JsonAsync();
        Assert.Equal(40, (await owner.GetJsonAsync("/api/v1/account")).GetProperty("business").GetProperty("trialDaysRemaining").GetInt32());

        var active = await (await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/activate", new { plan = "monthly", reference = "CLIQ-1", note = "دفع كاش" })).JsonAsync();
        Assert.Equal("monthly", S(active.GetProperty("periods")[0], "plan"));
        await (await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/extend", new { days = 5 })).JsonAsync();

        await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/suspend", new { reason = "مخالفة" });
        await (await owner.PostAsync("/api/v1/customers", new { name = "ممنوع", channel = "instagram" })).AssertProblemAsync(HttpStatusCode.Forbidden, ReadOnlySubscriptionFilter.Code);
        await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/reactivate");
        await owner.CustomerAsync("بعد الإرجاع");
        await admin.AdminPostAsync($"/api/v1/admin/subscribers/{businessId}/notes", new { text = "اتصلت فيها" });

        var detail = await admin.GetJsonAsync($"/api/v1/admin/subscribers/{businessId}");
        Assert.Equal(["activate_plan", "extend_plan", "extend_trial", "reactivate", "suspend"], detail.GetProperty("audit").EnumerateArray().Select(a => S(a, "action")).Order());
        Assert.Equal("اتصلت فيها", S(detail.GetProperty("notes")[0], "details"));
        Assert.Equal(0, detail.GetProperty("productsCount").GetInt32());
        // P-025: account and billing metadata only, no customers, orders or money of the business.
        var keys = detail.EnumerateObject().Select(p => p.Name).ToList();
        Assert.DoesNotContain(keys, k => k.Contains("customer", StringComparison.OrdinalIgnoreCase) || k is "orders" or "sales" or "netProfit");
    }

    [Fact]
    public async Task Reminders_go_out_once_per_day_and_kind()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            var owner = await factory.OnboardedAsync();
            var email = S(await owner.GetJsonAsync("/api/v1/account"), "email");
            async Task<int> RunAsync()
            {
                using var scope = factory.Services.CreateScope();
                return await scope.ServiceProvider.GetRequiredService<IReminderService>().RunAsync(CancellationToken.None);
            }

            int Count(string kind) => factory.Email.Messages.Count(m => m.To == email && m.Kind == kind);

            factory.Clock.UtcNow = real.AddDays(23); // 7 days left
            await RunAsync();
            await RunAsync();
            Assert.Equal(1, Count(EmailTemplates.ReminderKind));

            factory.Clock.UtcNow = real.AddDays(35); // read-only
            await RunAsync();
            await RunAsync();
            Assert.Equal(1, Count(EmailTemplates.ReadOnlyKind));
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    [Fact]
    public async Task A_repeated_admin_request_with_the_same_key_is_applied_once()
    {
        var owner = await factory.OnboardedAsync();
        var businessId = await owner.BusinessIdAsync();
        var admin = await factory.AdminAsync();
        var key = new Dictionary<string, string> { ["Idempotency-Key"] = Guid.NewGuid().ToString() };
        for (var i = 0; i < 2; i++)
        {
            var r = await admin.SendAsync(HttpMethod.Post, $"/api/v1/admin/subscribers/{businessId}/extend-trial", new { days = 10 }, withToken: true, origin: null, headers: key);
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        }

        Assert.Equal(40, (await owner.GetJsonAsync("/api/v1/account")).GetProperty("business").GetProperty("trialDaysRemaining").GetInt32());
        var detail = await admin.GetJsonAsync($"/api/v1/admin/subscribers/{businessId}");
        Assert.Single(detail.GetProperty("audit").EnumerateArray());
    }
}
