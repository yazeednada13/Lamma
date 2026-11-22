using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using Lamma.Application.Common;
using Lamma.Application.Common.Email;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lamma.Infrastructure.Services;

/// <summary>"Email" configuration section (D-166). SMTP is used when <see cref="SmtpOptions.Host"/> is set.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public SmtpOptions Smtp { get; set; } = new();

    /// <summary>Development: folder for the .html files of the file sender. Default: %TEMP%/lamma-emails (outside the repo).</summary>
    public string? DevOutputPath { get; set; }

    public bool SmtpConfigured => !string.IsNullOrWhiteSpace(Smtp.Host) && !string.IsNullOrWhiteSpace(Smtp.FromAddress);
}

/// <summary>Brevo SMTP relay (smtp-relay.brevo.com:587, STARTTLS). User and password come from user-secrets or environment variables.</summary>
public sealed class SmtpOptions
{
    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public string? User { get; set; }

    public string? Password { get; set; }

    public string? FromAddress { get; set; }

    public string FromName { get; set; } = "لمّة";
}

/// <summary>
/// Sends through SMTP with the built-in client (no package). Arabic HTML with a plain-text alternative.
/// </summary>
internal sealed partial class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public bool IsConfigured => true;

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
        => SendAsync(EmailTemplates.PasswordReset(toEmail, fullName, resetLink), cancellationToken);

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var smtp = options.Value.Smtp;
        using var mail = new MailMessage
        {
            From = new MailAddress(smtp.FromAddress!, smtp.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
            Body = message.Text,
        };
        mail.To.Add(new MailAddress(message.To));
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.Html, Encoding.UTF8, MediaTypeNames.Text.Html));

        using var client = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = true,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Credentials = string.IsNullOrEmpty(smtp.User) ? null : new NetworkCredential(smtp.User, smtp.Password),
        };
        try
        {
            await client.SendMailAsync(mail, cancellationToken);
        }
        catch (SmtpException ex)
        {
            LogFailed(logger, ex, message.Kind);
            throw new ServiceUnavailableException("email.send_failed", "ما قدرنا نبعت الإيميل هلّق. جرّب بعد شوي.");
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Sending a {Kind} email failed")]
    private static partial void LogFailed(ILogger logger, Exception exception, string kind);
}

/// <summary>
/// DEVELOPMENT ONLY: writes every email as an .html file (outside the repo) and logs its path and link, so the whole
/// flow can be tried without a provider (D-166). Never registered outside Development.
/// </summary>
internal sealed partial class DevFileEmailSender(IOptions<EmailOptions> options, ILogger<DevFileEmailSender> logger) : IEmailSender
{
    public bool IsConfigured => true;

    public string Folder => string.IsNullOrWhiteSpace(options.Value.DevOutputPath)
        ? Path.Combine(Path.GetTempPath(), "lamma-emails")
        : options.Value.DevOutputPath!;

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
        => SendAsync(EmailTemplates.PasswordReset(toEmail, fullName, resetLink), cancellationToken);

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Folder);
        var safe = new string(message.To.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
        var path = Path.Combine(Folder, $"{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}-{message.Kind}-{safe}.html");
        await File.WriteAllTextAsync(path, message.Html, Encoding.UTF8, cancellationToken);
        LogWritten(logger, message.Kind, path, message.Link);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "DEV ONLY - {Kind} email written to {Path} (link: {Link})")]
    private static partial void LogWritten(ILogger logger, string kind, string path, string? link);
}

/// <summary>Used outside Development until SMTP is configured: sending answers 503.</summary>
internal sealed class NotConfiguredEmailSender : IEmailSender
{
    public bool IsConfigured => false;

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
        => throw NotConfigured();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken) => throw NotConfigured();

    private static ServiceUnavailableException NotConfigured() => new("email.not_configured", "خدمة الإيميل مش جاهزة حاليًا.");
}
