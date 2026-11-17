using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Lamma.Api.IntegrationTests.Infrastructure;

/// <summary>
/// One browser-like session: keeps cookies, fetches the antiforgery token and sends it as X-XSRF-TOKEN,
/// and refreshes the token after the signed-in identity changes (tokens are bound to the user).
/// </summary>
public sealed class ApiSession(HttpClient http)
{
    public const string DefaultPassword = "lamma2026";

    private string? _token;

    public HttpClient Http { get; } = http;

    public static string NewEmail() => $"owner-{Guid.NewGuid():N}@example.com";

    public async Task RefreshTokenAsync()
    {
        var response = await Http.GetAsync("/api/v1/auth/antiforgery");
        response.EnsureSuccessStatusCode();
        _token = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
    }

    public Task<HttpResponseMessage> GetAsync(string url) => Http.GetAsync(url);

    public Task<HttpResponseMessage> PostAsync(string url, object? body = null, bool withToken = true, string? origin = null)
        => SendAsync(HttpMethod.Post, url, body, withToken, origin);

    public Task<HttpResponseMessage> PutAsync(string url, object? body = null) => SendAsync(HttpMethod.Put, url, body, withToken: true, origin: null);

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, bool withToken, string? origin)
    {
        if (withToken && _token is null)
        {
            await RefreshTokenAsync();
        }

        using var request = new HttpRequestMessage(method, url);
        if (body is HttpContent content)
        {
            request.Content = content;
        }
        else if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (withToken)
        {
            request.Headers.Add("X-XSRF-TOKEN", _token);
        }

        if (origin is not null)
        {
            request.Headers.Add("Origin", origin);
        }

        return await Http.SendAsync(request);
    }

    public async Task<JsonElement> SignUpAsync(string? email = null, string password = DefaultPassword, string fullName = "ريم")
    {
        var response = await PostAsync("/api/v1/auth/signup", new { fullName, email = email ?? NewEmail(), password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await RefreshTokenAsync();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    public async Task<HttpResponseMessage> LoginAsync(string email, string password = DefaultPassword, bool rememberMe = false)
    {
        var response = await PostAsync("/api/v1/auth/login", new { email, password, rememberMe });
        if (response.IsSuccessStatusCode)
        {
            await RefreshTokenAsync();
        }

        return response;
    }

    public async Task<JsonElement> OnboardAsync(string businessName = "بوتيك ريم", string businessType = "clothing", params string[] channels)
    {
        var response = await PostAsync("/api/v1/onboarding", new { businessName, businessType, salesChannels = channels.Length == 0 ? new[] { "instagram", "whatsapp" } : channels });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    /// <summary>Signs up a new owner and completes onboarding. Returns the email used.</summary>
    public async Task<string> SignUpAndOnboardAsync(string businessName = "بوتيك ريم")
    {
        var email = NewEmail();
        await SignUpAsync(email);
        await OnboardAsync(businessName);
        return email;
    }
}

public static class ResponseExtensions
{
    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage response)
        => await response.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Codes of the items whose isEnabled is true (settings lists).</summary>
    public static string[] EnabledCodes(this JsonElement items, string codeProperty)
        => items.EnumerateArray()
            .Where(x => x.GetProperty("isEnabled").GetBoolean())
            .Select(x => x.GetProperty(codeProperty).GetString()!)
            .ToArray();

    /// <summary>Asserts a ProblemDetails response with the given status and code; returns the body.</summary>
    public static async Task<JsonElement> AssertProblemAsync(this HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.JsonAsync();
        Assert.Equal(code, body.GetProperty("code").GetString());
        Assert.Equal((int)status, body.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("detail").GetString()));
        Assert.True(body.TryGetProperty("traceId", out _));
        return body;
    }
}
