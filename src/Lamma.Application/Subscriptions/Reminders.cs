using Lamma.Application.Admin;
using Lamma.Application.Common;
using Lamma.Application.Common.Email;
using Lamma.Domain.Common;
using Lamma.Domain.Platform;
using Lamma.Domain.Subscriptions;

namespace Lamma.Application.Subscriptions;

public interface IReminderRepository
{
    Task<bool> ExistsAsync(Guid businessId, string kind, DateOnly targetDate, CancellationToken cancellationToken);

    void Add(ReminderLog log);

    /// <summary>Forgets a log whose insert lost a race (so the next save does not retry it).</summary>
    void Forget(ReminderLog log);
}

public interface IReminderService
{
    /// <summary>One pass over every business; returns how many reminders were sent.</summary>
    Task<int> RunAsync(CancellationToken cancellationToken);
}

/// <summary>
/// The daily reminders (D-186): 7, 3 and 1 days before the trial or the plan ends, and once when the account becomes
/// read-only. A <see cref="ReminderLog"/> row per business, kind and end date makes a second run send nothing.
/// The in-app banners are computed from the same status, so they need no storage.
/// </summary>
internal sealed class ReminderService(
    IAdminQueries queries,
    IReminderRepository reminders,
    IEmailSender email,
    IAppLinks links,
    IUnitOfWork unitOfWork,
    IClock clock) : IReminderService
{
    private static readonly int[] Days = [7, 3, 1];

    public async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var rows = await queries.BusinessesAsync(null, cancellationToken);
        var periods = await queries.PeriodsAsync(null, cancellationToken);
        var sent = 0;
        foreach (var row in rows)
        {
            var zone = BusinessTime.FindZone(row.TimeZoneId);
            var s = SubscriptionStatus.Compute(row.TrialEndsAt, periods.Where(p => p.BusinessId == row.Id), row.SuspendedAt, now, zone);
            var kind = KindFor(s);
            if (kind is null)
            {
                continue;
            }

            var target = s.EndsOn ?? BusinessTime.LocalDate(now, zone);
            if (await reminders.ExistsAsync(row.Id, kind, target, cancellationToken))
            {
                continue;
            }

            var log = ReminderLog.Create(row.Id, kind, target, now);
            reminders.Add(log);
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (UniqueConstraintViolationException)
            {
                reminders.Forget(log); // another run got there first
                continue;
            }

            var message = kind == "read_only"
                ? EmailTemplates.ReadOnlyNotice(row.OwnerEmail, row.OwnerName, s.State == SubscriptionState.TrialEnded, links.Subscription())
                : EmailTemplates.Reminder(row.OwnerEmail, row.OwnerName, s.State == SubscriptionState.Trial, s.DaysLeft, target, links.Subscription());
            await email.SendAsync(message, cancellationToken);
            sent++;
        }

        return sent;
    }

    /// <summary>trial_7/3/1, plan_7/3/1 (only when nothing is queued after it), read_only; null when nothing is due.</summary>
    public static string? KindFor(SubscriptionSnapshot s) => s.State switch
    {
        SubscriptionState.Trial when Days.Contains(s.DaysLeft) && s.PaidUntil is null => $"trial_{s.DaysLeft}",
        SubscriptionState.Active when Days.Contains(s.DaysLeft) && s.PaidUntil == s.EndsOn => $"plan_{s.DaysLeft}",
        SubscriptionState.TrialEnded or SubscriptionState.Expired => "read_only",
        _ => null,
    };
}
