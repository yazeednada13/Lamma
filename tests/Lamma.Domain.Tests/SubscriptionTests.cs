using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Subscriptions;

namespace Lamma.Domain.Tests;

public sealed class SubscriptionStatusTests
{
    private static readonly TimeZoneInfo Amman = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);
    private static readonly Guid Biz = Guid.NewGuid();

    // Trial from 1 Nov 2026 09:00 Amman (06:00 UTC) for 30 days → ends 1 Dec 2026 06:00 UTC.
    private static readonly DateTime TrialEnds = new(2026, 12, 1, 6, 0, 0, DateTimeKind.Utc);

    private static DateTime At(int month, int day, int hour = 9) => new(2026, month, day, hour - 3, 0, 0, DateTimeKind.Utc); // Amman = UTC+3

    private static SubscriptionPeriod Period(string start, PaidPlan plan = PaidPlan.Monthly)
        => SubscriptionPeriod.Create(Biz, plan, DateOnly.Parse(start), Plans.Price(plan), PeriodSource.Admin, null, Guid.NewGuid(), null, null, At(11, 1));

    private static SubscriptionSnapshot Compute(DateTime now, params SubscriptionPeriod[] periods)
        => SubscriptionStatus.Compute(TrialEnds, periods, null, now, Amman);

    [Theory]
    [InlineData("2026-11-01", PaidPlan.Monthly, "2026-11-30")]
    [InlineData("2026-01-31", PaidPlan.Monthly, "2026-02-28")] // a shorter month ends on its last day
    [InlineData("2028-01-31", PaidPlan.Monthly, "2028-02-29")]
    [InlineData("2026-11-15", PaidPlan.Monthly, "2026-12-14")]
    [InlineData("2026-11-01", PaidPlan.Yearly, "2027-10-31")]
    public void Plan_lengths_are_calendar_months(string start, PaidPlan plan, string end)
        => Assert.Equal(DateOnly.Parse(end), Plans.EndOn(DateOnly.Parse(start), plan));

    [Fact]
    public void Trial_then_three_days_of_grace_then_read_only()
    {
        var trial = Compute(At(11, 24));
        Assert.Equal((SubscriptionState.Trial, 7, false), (trial.State, trial.DaysLeft, trial.ReadOnly));

        var grace = Compute(At(12, 2));
        Assert.Equal((SubscriptionState.TrialGrace, false), (grace.State, grace.ReadOnly));
        Assert.True(grace.DaysLeft is >= 1 and <= 3);

        var ended = Compute(At(12, 4, 10)); // 3 days + 1 hour after the trial instant
        Assert.Equal((SubscriptionState.TrialEnded, true, 0), (ended.State, ended.ReadOnly, ended.DaysLeft));
    }

    [Fact]
    public void Paid_periods_chain_and_then_grace_and_expiry()
    {
        var first = Period("2026-12-01");          // 1–31 Dec
        var second = Period("2027-01-01");         // 1–31 Jan, no gap
        var active = Compute(At(12, 20), first, second);
        Assert.Equal((SubscriptionState.Active, PaidPlan.Monthly, DateOnly.Parse("2027-01-31")), (active.State, active.Plan, active.EndsOn));
        Assert.Equal(43, active.DaysLeft); // 20 Dec … 31 Jan

        var grace = SubscriptionStatus.Compute(TrialEnds, [first], null, new DateTime(2027, 1, 2, 7, 0, 0, DateTimeKind.Utc), Amman);
        Assert.Equal((SubscriptionState.ActiveGrace, false, 2), (grace.State, grace.ReadOnly, grace.DaysLeft)); // 2 and 3 Jan

        var expired = SubscriptionStatus.Compute(TrialEnds, [first], null, new DateTime(2027, 1, 4, 7, 0, 0, DateTimeKind.Utc), Amman);
        Assert.Equal((SubscriptionState.Expired, true), (expired.State, expired.ReadOnly));
    }

    [Fact]
    public void Cancelled_periods_do_not_count_and_suspension_wins()
    {
        var p = Period("2026-12-01");
        p.Cancel(Guid.NewGuid(), At(12, 5));
        Assert.Equal(SubscriptionState.TrialGrace, Compute(At(12, 2), p).State);

        var suspended = SubscriptionStatus.Compute(TrialEnds, [Period("2026-12-01")], At(12, 3), At(12, 10), Amman);
        Assert.Equal((SubscriptionState.Suspended, true), (suspended.State, suspended.ReadOnly));
    }

    [Fact]
    public void A_plan_paid_during_the_trial_is_queued_and_shown_as_paid_until()
    {
        var queued = Period("2026-12-01");
        var s = Compute(At(11, 20), queued);
        Assert.Equal((SubscriptionState.Trial, DateOnly.Parse("2026-12-31")), (s.State, s.PaidUntil));
    }

    [Fact]
    public void An_extended_trial_wins_over_an_old_paid_period()
    {
        var business = Business.Create("بوتيك", BusinessType.Clothing, [SalesChannel.Instagram], At(9, 1));
        var old = SubscriptionPeriod.Create(business.Id, PaidPlan.Monthly, DateOnly.Parse("2026-10-01"), 9, PeriodSource.Admin, null, null, null, null, At(10, 1));
        var now = At(12, 20);
        Assert.Equal(SubscriptionState.Expired, SubscriptionStatus.Compute(business.TrialEndsAt, [old], null, now, Amman).State);

        business.ExtendTrial(10, now); // reopens from now (D-180)
        var reopened = SubscriptionStatus.Compute(business.TrialEndsAt, [old], null, now, Amman);
        Assert.Equal((SubscriptionState.Trial, false), (reopened.State, reopened.ReadOnly));
    }

    [Fact]
    public void Next_start_follows_the_running_trial_or_plan_else_today()
    {
        Assert.Equal(DateOnly.Parse("2026-12-02"), SubscriptionStatus.NextStart(TrialEnds, [], At(11, 20), Amman)); // after the trial's last day
        var running = Period("2026-12-10");
        Assert.Equal(DateOnly.Parse("2027-01-10"), SubscriptionStatus.NextStart(TrialEnds, [running], At(12, 20), Amman)); // after 9 Jan
        Assert.Equal(DateOnly.Parse("2026-12-20"), SubscriptionStatus.NextStart(TrialEnds, [], At(12, 20), Amman)); // nothing running: today
    }

    [Fact]
    public void Payment_requests_are_reviewed_once_and_rejections_need_a_reason()
    {
        var r = PaymentRequest.Submit(Guid.NewGuid(), Biz, PaidPlan.Yearly, "p.png", "image/png", Guid.NewGuid(), At(11, 1));
        Assert.Equal((90m, PaymentRequestStatus.Pending), (r.Amount, r.Status));
        Assert.Equal("payment_request.reason_required", Assert.Throws<DomainException>(() => r.Reject(" ", Guid.NewGuid(), At(11, 2))).Code);
        r.Approve(Guid.NewGuid(), Guid.NewGuid(), At(11, 2));
        Assert.Equal("payment_request.already_reviewed", Assert.Throws<DomainConflictException>(() => r.Reject("x", Guid.NewGuid(), At(11, 3))).Code);
    }

    [Fact]
    public void Suspension_and_reference_rules()
    {
        var b = Business.Create("بوتيك", BusinessType.Clothing, [SalesChannel.Instagram], At(11, 1));
        b.Suspend("ما دفع", At(11, 2));
        Assert.Throws<DomainConflictException>(() => b.Suspend("x", At(11, 3)));
        b.Reactivate();
        Assert.Null(b.SuspendedAt);
        b.AssignReference(1001);
        b.AssignReference(1002); // first one stays
        Assert.Equal("LM-1001", b.ReferenceCode);
    }
}
