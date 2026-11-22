using Lamma.Domain.Common;

namespace Lamma.Domain.Subscriptions;

/// <summary>The paid plans (D-010, D-165): one plan with every feature, billed monthly or yearly.</summary>
public enum PaidPlan
{
    Monthly,
    Yearly,
}

/// <summary>Where a paid period came from: an approved payment request or an admin action.</summary>
public enum PeriodSource
{
    Payment,
    Admin,
}

public enum PaymentRequestStatus
{
    Pending,
    Approved,
    Rejected,
}

/// <summary>The derived subscription status (D-167, D-183). Never stored: computed from the trial and the periods.</summary>
public enum SubscriptionState
{
    /// <summary>«تجربة مجانية»</summary>
    Trial,

    /// <summary>«فترة سماح» after the trial (3 days, still writable).</summary>
    TrialGrace,

    /// <summary>«انتهت التجربة»: read-only.</summary>
    TrialEnded,

    /// <summary>«مشترك شهري/سنوي حتى …»</summary>
    Active,

    /// <summary>«فترة سماح» after a paid period (3 days, still writable).</summary>
    ActiveGrace,

    /// <summary>«انتهى الاشتراك»: read-only.</summary>
    Expired,

    /// <summary>«موقوف» by the admin: read-only.</summary>
    Suspended,
}

/// <summary>Prices and lengths (D-165, D-177).</summary>
public static class Plans
{
    public const decimal MonthlyPrice = 9.000m;
    public const decimal YearlyPrice = 90.000m;
    public const int GraceDays = 3;

    public static decimal Price(PaidPlan plan) => plan == PaidPlan.Monthly ? MonthlyPrice : YearlyPrice;

    /// <summary>Monthly price equivalent, for the admin's monthly revenue figure.</summary>
    public static decimal MonthlyValue(PaidPlan plan) => plan == PaidPlan.Monthly ? MonthlyPrice : YearlyPrice / 12m;

    /// <summary>
    /// Inclusive last day: one calendar month or twelve, minus a day (1 Nov → 30 Nov; 1 Nov → 31 Oct next year). When
    /// the target month is shorter, the period ends on its last day (31 Jan → 28/29 Feb), so no day is lost.
    /// </summary>
    public static DateOnly EndOn(DateOnly startsOn, PaidPlan plan)
    {
        var same = startsOn.AddMonths(plan == PaidPlan.Monthly ? 1 : 12);
        return same.Day < startsOn.Day ? same : same.AddDays(-1);
    }
}

/// <summary>
/// A paid period of one business (D-167, D-177). Platform-level billing record: it carries the BusinessId but is not
/// tenant-filtered, so the admin can write it; owner queries filter it explicitly by the current business.
/// </summary>
public sealed class SubscriptionPeriod : Entity
{
    public const int ReferenceMaxLength = 64;
    public const int NoteMaxLength = 300;

    private SubscriptionPeriod(Guid id)
        : base(id)
    {
    }

    private SubscriptionPeriod()
    {
    }

    public Guid BusinessId { get; private set; }

    public PaidPlan Plan { get; private set; }

    /// <summary>First day, business calendar.</summary>
    public DateOnly StartsOn { get; private set; }

    /// <summary>Last day (inclusive), business calendar.</summary>
    public DateOnly EndsOn { get; private set; }

    public decimal Amount { get; private set; }

    public string? CliqReference { get; private set; }

    public string? Note { get; private set; }

    public PeriodSource Source { get; private set; }

    public Guid? PaymentRequestId { get; private set; }

    public Guid? CreatedByUserId { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime? CancelledAt { get; private set; }

    public Guid? CancelledByUserId { get; private set; }

    public bool IsActive => CancelledAt is null;

    public static SubscriptionPeriod Create(
        Guid businessId,
        PaidPlan plan,
        DateOnly startsOn,
        decimal amount,
        PeriodSource source,
        Guid? paymentRequestId,
        Guid? createdBy,
        string? cliqReference,
        string? note,
        DateTime nowUtc)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        if (amount < 0 || !MoneyMath.HasValidScale(amount))
        {
            throw new DomainException("subscription.invalid_amount", "المبلغ لازم يكون صفر أو أكثر.");
        }

        return new SubscriptionPeriod(NewId())
        {
            BusinessId = businessId,
            Plan = plan,
            StartsOn = startsOn,
            EndsOn = Plans.EndOn(startsOn, plan),
            Amount = amount,
            Source = source,
            PaymentRequestId = paymentRequestId,
            CreatedByUserId = createdBy,
            CliqReference = Clip(cliqReference, ReferenceMaxLength),
            Note = Clip(note, NoteMaxLength),
            CreatedAt = nowUtc,
        };
    }

    /// <summary>Adds days at the end (admin «تمديد»).</summary>
    public void Extend(int days)
    {
        EnsureActive();
        if (days is < 1 or > 366)
        {
            throw new DomainException("subscription.invalid_days", "عدد الأيام لازم يكون بين 1 و366.");
        }

        EndsOn = EndsOn.AddDays(days);
    }

    /// <summary>Ends the period now (admin «إنهاء الخطة»): it stays in the history, cancelled.</summary>
    public void Cancel(Guid byUserId, DateTime nowUtc)
    {
        EnsureActive();
        CancelledAt = nowUtc;
        CancelledByUserId = byUserId;
    }

    private void EnsureActive()
    {
        if (CancelledAt is not null)
        {
            throw new DomainConflictException("subscription.period_cancelled", "هالفترة انلغت من قبل.");
        }
    }

    private static string? Clip(string? value, int max)
    {
        var v = value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v.Length > max ? v[..max] : v;
    }
}

/// <summary>
/// An owner's CliQ payment waiting for the admin (D-163, D-178). Platform-level billing record (see
/// <see cref="SubscriptionPeriod"/>). The proof file is private, stored via the file storage.
/// </summary>
public sealed class PaymentRequest : Entity
{
    public const int ReasonMaxLength = 300;

    private PaymentRequest(Guid id)
        : base(id)
    {
    }

    private PaymentRequest()
    {
    }

    public Guid BusinessId { get; private set; }

    public PaidPlan Plan { get; private set; }

    public decimal Amount { get; private set; }

    public string ProofPath { get; private set; } = string.Empty;

    public string ProofContentType { get; private set; } = string.Empty;

    public PaymentRequestStatus Status { get; private set; }

    public string? RejectReason { get; private set; }

    public Guid SubmittedByUserId { get; private set; }

    public DateTime SubmittedAt { get; private set; }

    public Guid? ReviewedByUserId { get; private set; }

    public DateTime? ReviewedAt { get; private set; }

    public Guid? PeriodId { get; private set; }

    public static PaymentRequest Submit(Guid id, Guid businessId, PaidPlan plan, string proofPath, string proofContentType, Guid userId, DateTime nowUtc)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        return new PaymentRequest(id)
        {
            BusinessId = businessId,
            Plan = plan,
            Amount = Plans.Price(plan),
            ProofPath = proofPath,
            ProofContentType = proofContentType,
            Status = PaymentRequestStatus.Pending,
            SubmittedByUserId = userId,
            SubmittedAt = nowUtc,
        };
    }

    public void Approve(Guid periodId, Guid adminId, DateTime nowUtc)
    {
        EnsurePending();
        Status = PaymentRequestStatus.Approved;
        PeriodId = periodId;
        ReviewedByUserId = adminId;
        ReviewedAt = nowUtc;
    }

    public void Reject(string reason, Guid adminId, DateTime nowUtc)
    {
        EnsurePending();
        var r = reason.Trim();
        if (r.Length == 0)
        {
            throw new DomainException("payment_request.reason_required", "اكتب سبب الرفض عشان يوصل للمشترك.");
        }

        Status = PaymentRequestStatus.Rejected;
        RejectReason = r.Length > ReasonMaxLength ? r[..ReasonMaxLength] : r;
        ReviewedByUserId = adminId;
        ReviewedAt = nowUtc;
    }

    private void EnsurePending()
    {
        if (Status != PaymentRequestStatus.Pending)
        {
            throw new DomainConflictException("payment_request.already_reviewed", "هالدفعة انراجعت من قبل.");
        }
    }
}

/// <summary>The result of <see cref="SubscriptionStatus.Compute"/>.</summary>
public sealed class SubscriptionSnapshot(
    SubscriptionState state,
    PaidPlan? plan,
    DateOnly? endsOn,
    int daysLeft,
    bool readOnly,
    DateOnly? paidUntil)
{
    public SubscriptionState State { get; } = state;

    public PaidPlan? Plan { get; } = plan;

    /// <summary>The last day of the trial or of the current paid run (the ended one in grace or expired).</summary>
    public DateOnly? EndsOn { get; } = endsOn;

    /// <summary>Days left in the trial, the paid run or the grace period; 0 when read-only.</summary>
    public int DaysLeft { get; } = daysLeft;

    public bool ReadOnly { get; } = readOnly;

    /// <summary>The furthest paid day from today on, if any (also a plan queued after the trial).</summary>
    public DateOnly? PaidUntil { get; } = paidUntil;

    /// <summary>The plan code shown to the owner: trial, monthly or yearly.</summary>
    public string PlanCode => Plan?.ToCode() ?? "trial";
}

/// <summary>
/// The subscription status of one business (D-167, D-183), computed and never stored. Rules, in the business calendar:
/// suspended → «موقوف»; a period covering today (chained with periods that follow it without a gap) → «مشترك» until the
/// chain ends; otherwise, after a paid period → 3 days of grace then «انتهى الاشتراك»; otherwise the trial → 3 days of
/// grace then «انتهت التجربة». Read-only = trial ended, expired or suspended (D-162).
/// </summary>
public static class SubscriptionStatus
{
    public static SubscriptionSnapshot Compute(
        DateTime trialEndsAtUtc,
        IEnumerable<SubscriptionPeriod> periods,
        DateTime? suspendedAt,
        DateTime nowUtc,
        TimeZoneInfo zone)
    {
        var today = BusinessTime.LocalDate(nowUtc, zone);
        var active = periods.Where(p => p.IsActive).OrderBy(p => p.StartsOn).ThenBy(p => p.EndsOn).ToList();
        // «مدفوع لحد»: the furthest paid day from today on (a plan paid during the trial is queued after it).
        var paidUntil = active.Where(p => p.EndsOn >= today).Select(p => (DateOnly?)p.EndsOn).Max();

        if (suspendedAt is not null)
        {
            return new SubscriptionSnapshot(SubscriptionState.Suspended, null, null, 0, true, paidUntil);
        }

        var current = active.LastOrDefault(p => p.StartsOn <= today && p.EndsOn >= today);
        if (current is not null)
        {
            var end = ChainEnd(active, today) ?? current.EndsOn;
            return new SubscriptionSnapshot(SubscriptionState.Active, current.Plan, end, end.DayNumber - today.DayNumber + 1, false, paidUntil);
        }

        // A running trial wins over an old paid period (an admin may reopen the trial, D-180).
        var trialEndDay = BusinessTime.LocalDate(trialEndsAtUtc, zone);
        if (nowUtc < trialEndsAtUtc)
        {
            var days = Businesses.Business.TrialDaysRemaining(trialEndsAtUtc, nowUtc, zone);
            return new SubscriptionSnapshot(SubscriptionState.Trial, null, trialEndDay, days, false, paidUntil);
        }

        var lastEnded = active.Where(p => p.EndsOn < today).OrderBy(p => p.EndsOn).LastOrDefault();
        if (lastEnded is not null && lastEnded.EndsOn >= trialEndDay.AddDays(-1))
        {
            var graceEnd = lastEnded.EndsOn.AddDays(Plans.GraceDays);
            return today <= graceEnd
                ? new SubscriptionSnapshot(SubscriptionState.ActiveGrace, lastEnded.Plan, lastEnded.EndsOn, graceEnd.DayNumber - today.DayNumber + 1, false, paidUntil)
                : new SubscriptionSnapshot(SubscriptionState.Expired, lastEnded.Plan, lastEnded.EndsOn, 0, true, paidUntil);
        }

        var trialGraceEnd = trialEndsAtUtc.AddDays(Plans.GraceDays);
        return nowUtc < trialGraceEnd
            ? new SubscriptionSnapshot(SubscriptionState.TrialGrace, null, trialEndDay, Math.Max(1, (int)Math.Ceiling((trialGraceEnd - nowUtc).TotalDays)), false, paidUntil)
            : new SubscriptionSnapshot(SubscriptionState.TrialEnded, null, trialEndDay, 0, true, paidUntil);
    }

    /// <summary>
    /// D-177: when an approved plan starts. The day after the current paid chain or the trial, if either is still
    /// running today; otherwise today.
    /// </summary>
    public static DateOnly NextStart(DateTime trialEndsAtUtc, IEnumerable<SubscriptionPeriod> periods, DateTime nowUtc, TimeZoneInfo zone)
    {
        var today = BusinessTime.LocalDate(nowUtc, zone);
        var active = periods.Where(p => p.IsActive).OrderBy(p => p.StartsOn).ToList();
        var chain = ChainEnd(active, today) ?? active.Where(p => p.StartsOn > today).Select(p => (DateOnly?)p.EndsOn).Max();
        if (chain is { } end && end >= today)
        {
            return end.AddDays(1);
        }

        var trialLastDay = BusinessTime.LocalDate(trialEndsAtUtc, zone);
        return nowUtc < trialEndsAtUtc ? trialLastDay.AddDays(1) : today;
    }

    /// <summary>The last day of the run of periods that covers <paramref name="from"/> (or starts right after it), without gaps.</summary>
    private static DateOnly? ChainEnd(List<SubscriptionPeriod> ordered, DateOnly from)
    {
        DateOnly? end = null;
        foreach (var p in ordered)
        {
            if (end is null)
            {
                if (p.EndsOn >= from && p.StartsOn <= from)
                {
                    end = p.EndsOn;
                }

                continue;
            }

            if (p.StartsOn <= end.Value.AddDays(1) && p.EndsOn > end.Value)
            {
                end = p.EndsOn;
            }
        }

        return end;
    }
}
