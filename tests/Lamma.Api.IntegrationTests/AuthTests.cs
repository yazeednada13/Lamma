using System.Net;
using System.Web;
using Lamma.Api.IntegrationTests.Infrastructure;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class AuthTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Sign_up_creates_a_signed_in_owner_who_is_not_onboarded()
    {
        var session = factory.NewSession();
        var email = ApiSession.NewEmail();

        var account = await session.SignUpAsync(email);

        Assert.Equal(email, account.GetProperty("email").GetString());
        Assert.False(account.GetProperty("isOnboarded").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await session.GetAsync("/api/v1/account")).StatusCode);
    }

    [Fact]
    public async Task Auth_cookie_is_http_only_secure_and_samesite_lax()
    {
        var session = factory.NewSession();
        var response = await session.PostAsync("/api/v1/auth/signup", new { fullName = "ريم", email = ApiSession.NewEmail(), password = ApiSession.DefaultPassword });

        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("lamma.auth=", StringComparison.Ordinal)).ToLowerInvariant();
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
    }

    [Fact]
    public async Task Duplicate_email_is_a_conflict()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        var response = await factory.NewSession().PostAsync("/api/v1/auth/signup", new { fullName = "x", email, password = ApiSession.DefaultPassword });

        await response.AssertProblemAsync(HttpStatusCode.Conflict, "auth.email_taken");
    }

    [Fact]
    public async Task Weak_password_is_a_field_error()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/signup", new { fullName = "x", email = ApiSession.NewEmail(), password = "short" });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        Assert.True(body.GetProperty("errors").TryGetProperty("password", out _));
    }

    [Fact]
    public async Task Login_succeeds_with_the_right_password_and_fails_generically_otherwise()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        var wrong = await factory.NewSession().LoginAsync(email, "wrongpass1");
        await wrong.AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.invalid_credentials");

        var unknown = await factory.NewSession().LoginAsync(ApiSession.NewEmail());
        await unknown.AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.invalid_credentials");

        var session = factory.NewSession();
        var ok = await session.LoginAsync(email);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(email, (await ok.JsonAsync()).GetProperty("email").GetString());
    }

    [Fact]
    public async Task Five_failed_logins_lock_the_account_even_for_the_right_password()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        for (var i = 0; i < 5; i++)
        {
            await factory.NewSession().LoginAsync(email, "wrongpass1");
        }

        var locked = await factory.NewSession().LoginAsync(email);
        await locked.AssertProblemAsync(HttpStatusCode.Locked, "auth.locked_out");
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var session = factory.NewSession();
        await session.SignUpAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await session.PostAsync("/api/v1/auth/logout")).StatusCode);

        await (await session.GetAsync("/api/v1/account")).AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.unauthenticated");
    }

    [Fact]
    public async Task Forgot_password_does_not_reveal_whether_the_email_exists()
    {
        var before = factory.Email.Sent.Count;

        var response = await factory.NewSession().PostAsync("/api/v1/auth/forgot-password", new { email = ApiSession.NewEmail() });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(before, factory.Email.Sent.Count);
    }

    [Fact]
    public async Task Password_reset_works_once_and_the_token_cannot_be_reused()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        var forgot = await factory.NewSession().PostAsync("/api/v1/auth/forgot-password", new { email });
        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        var link = factory.Email.Sent.Last(s => s.Email == email).Link;
        Assert.StartsWith("https://app.lamma.test/reset-password?", link);
        var token = HttpUtility.ParseQueryString(new Uri(link).Query)["token"]!;

        var reset = await factory.NewSession().PostAsync("/api/v1/auth/reset-password", new { email, token, newPassword = "newpass2026" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await factory.NewSession().LoginAsync(email, "newpass2026")).StatusCode);
        await (await factory.NewSession().LoginAsync(email)).AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.invalid_credentials");

        var reused = await factory.NewSession().PostAsync("/api/v1/auth/reset-password", new { email, token, newPassword = "another2026" });
        await reused.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "auth.invalid_token");
    }

    [Fact]
    public async Task Invalid_reset_token_is_rejected()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        var response = await factory.NewSession().PostAsync("/api/v1/auth/reset-password", new { email, token = "not-a-token", newPassword = "newpass2026" });

        var body = await response.AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "auth.invalid_token");
        Assert.True(body.GetProperty("errors").TryGetProperty("token", out _));
    }
}

[Collection(ApiCollection.Name)]
public sealed class CsrfTests(LammaApiFactory factory)
{
    [Fact]
    public async Task Unsafe_request_without_token_is_rejected_even_for_login()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/login", new { email = "a@b.co", password = "x" }, withToken: false);
        await response.AssertProblemAsync(HttpStatusCode.BadRequest, "security.csrf");
    }

    [Fact]
    public async Task Foreign_origin_is_rejected()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/login", new { email = "a@b.co", password = "x" }, origin: "https://evil.example");
        await response.AssertProblemAsync(HttpStatusCode.BadRequest, "security.origin_rejected");
    }

    [Fact]
    public async Task Allowed_origin_with_token_is_accepted()
    {
        var response = await factory.NewSession().PostAsync("/api/v1/auth/login", new { email = ApiSession.NewEmail(), password = "x" }, origin: "https://app.lamma.test");
        await response.AssertProblemAsync(HttpStatusCode.Unauthorized, "auth.invalid_credentials"); // passed CSRF, failed credentials
    }

    [Fact]
    public async Task Token_issued_before_login_is_invalid_after_login_until_refreshed()
    {
        var email = ApiSession.NewEmail();
        await factory.NewSession().SignUpAsync(email);

        var session = factory.NewSession();
        await session.RefreshTokenAsync();
        var login = await session.PostAsync("/api/v1/auth/login", new { email, password = ApiSession.DefaultPassword, rememberMe = false });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        // The anonymous token is bound to the anonymous identity.
        var stale = await session.PostAsync("/api/v1/onboarding", new { businessName = "x", businessType = "other", salesChannels = new[] { "other" } });
        await stale.AssertProblemAsync(HttpStatusCode.BadRequest, "security.csrf");

        await session.RefreshTokenAsync();
        var fresh = await session.PostAsync("/api/v1/onboarding", new { businessName = "x", businessType = "other", salesChannels = new[] { "other" } });
        Assert.Equal(HttpStatusCode.Created, fresh.StatusCode);
    }
}

public sealed class RateLimitTests : IClassFixture<LowRateLimitApiFactory>
{
    private readonly LowRateLimitApiFactory _factory;

    public RateLimitTests(LowRateLimitApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Login_is_rate_limited_per_client()
    {
        var session = _factory.NewSession();
        await session.LoginAsync(ApiSession.NewEmail());
        await session.LoginAsync(ApiSession.NewEmail());

        var third = await session.LoginAsync(ApiSession.NewEmail());

        await third.AssertProblemAsync(HttpStatusCode.TooManyRequests, "rate_limited");
    }
}
