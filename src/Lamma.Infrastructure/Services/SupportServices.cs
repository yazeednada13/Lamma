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
        => $"{options.Value.FrontendBaseUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
}

/// <summary>
/// DEVELOPMENT ONLY: writes the reset link to the log instead of sending an email (no provider chosen yet, OQ-003).
/// Never registered outside Development.
/// </summary>
internal sealed partial class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public bool IsConfigured => true;

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
    {
        LogResetLink(logger, resetLink);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "DEV ONLY - password reset link (no email provider configured): {ResetLink}")]
    private static partial void LogResetLink(ILogger logger, string resetLink);
}

/// <summary>Used outside Development until an email provider is chosen: password reset returns 503.</summary>
internal sealed class NotConfiguredEmailSender : IEmailSender
{
    public bool IsConfigured => false;

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
        => throw new ServiceUnavailableException("email.not_configured", "خدمة الإيميل مش جاهزة حاليًا.");
}
