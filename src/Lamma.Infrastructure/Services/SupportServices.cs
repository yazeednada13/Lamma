using Lamma.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lamma.Infrastructure.Services;

/// <summary>"App" configuration section.</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>Base URL of the React app, used for links in emails (e.g. https://localhost:5173).</summary>
    public string FrontendBaseUrl { get; set; } = string.Empty;

    /// <summary>Browser origins allowed to call the API (CORS and the Origin check).</summary>
    public string[] AllowedOrigins { get; set; } = [];
}

internal sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

internal sealed class AppLinks(IOptions<AppOptions> options) : IAppLinks
{
    public string PasswordReset(string email, string token)
        => $"{Base}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";

    public string Register(string token) => $"{Base}/register?token={Uri.EscapeDataString(token)}";

    public string Login() => $"{Base}/login";

    public string Home() => $"{Base}/";

    public string Subscription() => $"{Base}/subscription";

    public string AdminPayments() => $"{Base}/admin/payments";

    private string Base => options.Value.FrontendBaseUrl.TrimEnd('/');
}

