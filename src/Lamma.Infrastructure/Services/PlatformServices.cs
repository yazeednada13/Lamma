using Lamma.Application.Subscriptions;
using Lamma.Domain.Common;
using Lamma.Infrastructure.Identity;
using Lamma.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lamma.Infrastructure.Services;

/// <summary>"Billing" section (D-179): the CliQ details shown to subscribers. Not secret.</summary>
public sealed class BillingOptions
{
    public const string SectionName = "Billing";

    public CliqOptions Cliq { get; set; } = new();
}

public sealed class CliqOptions
{
    public string Alias { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}

/// <summary>"Platform" section (D-175, D-182): the admin emails. Set in user-secrets or the environment, never the repo.</summary>
public sealed class PlatformOptions
{
    public const string SectionName = "Platform";
    public const string AdminRole = "PlatformAdmin";

    public string[] AdminEmails { get; set; } = [];
}

/// <summary>"Reminders" section (D-186). Off in tests; the daily pass runs at <see cref="Hour"/> Amman time.</summary>
public sealed class ReminderOptions
{
    public const string SectionName = "Reminders";

    public bool Enabled { get; set; } = true;

    public int Hour { get; set; } = 9;
}

internal sealed class BillingSettings(IOptions<BillingOptions> options) : IBillingSettings
{
    public string CliqAlias => options.Value.Cliq.Alias;

    public string CliqName => options.Value.Cliq.Name;
}

internal sealed class PlatformAdmins(IOptions<PlatformOptions> options, UserManager<ApplicationUser> users, RoleManager<Microsoft.AspNetCore.Identity.IdentityRole<Guid>> roles) : IPlatformAdmins
{
    public IReadOnlyList<string> Emails => options.Value.AdminEmails.Where(e => !string.IsNullOrWhiteSpace(e)).Select(e => e.Trim()).ToList();

    public async Task<bool> IsAdminAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        return user is not null && await users.IsInRoleAsync(user, PlatformOptions.AdminRole);
    }

    public async Task SyncAsync(string email, CancellationToken cancellationToken)
    {
        if (!Emails.Contains(email.Trim(), StringComparer.OrdinalIgnoreCase))
        {
            return;
        }

        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || await users.IsInRoleAsync(user, PlatformOptions.AdminRole))
        {
            return;
        }

        if (!await roles.RoleExistsAsync(PlatformOptions.AdminRole))
        {
            await roles.CreateAsync(new Microsoft.AspNetCore.Identity.IdentityRole<Guid>(PlatformOptions.AdminRole) { Id = Guid.CreateVersion7() });
        }

        await users.AddToRoleAsync(user, PlatformOptions.AdminRole);
    }
}

internal sealed class BusinessContacts(LammaDbContext db) : IBusinessContacts
{
    public async Task<(string Email, string FullName)?> GetOwnerAsync(Guid businessId, CancellationToken cancellationToken)
    {
        var owner = await (from m in db.Memberships.AsNoTracking()
                           where m.BusinessId == businessId
                           join u in db.Users.AsNoTracking() on m.UserId equals u.Id
                           select new { u.Email, u.FullName }).FirstOrDefaultAsync(cancellationToken);
        return owner?.Email is null ? null : (owner.Email, owner.FullName);
    }
}

/// <summary>At startup: gives the PlatformAdmin role to every listed email that already has an account (idempotent).</summary>
internal sealed partial class PlatformAdminSeeder(IServiceScopeFactory scopes, ILogger<PlatformAdminSeeder> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var admins = scope.ServiceProvider.GetRequiredService<IPlatformAdmins>();
            foreach (var email in admins.Emails)
            {
                await admins.SyncAsync(email, cancellationToken);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogFailed(logger, ex); // never block the API from starting
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Warning, Message = "Platform admin role sync failed at startup")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}

/// <summary>Runs the reminder pass every day at the configured hour, Amman time (D-186).</summary>
internal sealed partial class ReminderScheduler(IServiceScopeFactory scopes, IOptions<ReminderOptions> options, ILogger<ReminderScheduler> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        var zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var local = TimeZoneInfo.ConvertTimeFromUtc(now, zone);
            var next = local.Date.AddHours(options.Value.Hour);
            if (next <= local)
            {
                next = next.AddDays(1);
            }

            try
            {
                await Task.Delay(next - local, stoppingToken);
                using var scope = scopes.CreateScope();
                var sent = await scope.ServiceProvider.GetRequiredService<IReminderService>().RunAsync(stoppingToken);
                LogRan(logger, sent);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                LogFailed(logger, ex); // try again tomorrow
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Reminders sent: {Sent}")]
    private static partial void LogRan(ILogger logger, int sent);

    [LoggerMessage(Level = LogLevel.Error, Message = "The reminder pass failed")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
