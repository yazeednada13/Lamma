using Lamma.Application.Subscriptions;
using Lamma.Domain.Subscriptions;

namespace Lamma.Application.Tests;

public sealed class ReminderKindTests
{
    private static readonly DateOnly End = new(2026, 12, 31);

    private static SubscriptionSnapshot S(SubscriptionState state, int days, DateOnly? paidUntil = null, PaidPlan? plan = null)
        => new(state, plan, End, days, state is SubscriptionState.TrialEnded or SubscriptionState.Expired or SubscriptionState.Suspended, paidUntil);

    [Theory]
    [InlineData(7, "trial_7")]
    [InlineData(3, "trial_3")]
    [InlineData(1, "trial_1")]
    [InlineData(5, null)]
    [InlineData(0, null)]
    public void Trial_reminders_on_7_3_and_1_days(int days, string? kind)
        => Assert.Equal(kind, ReminderService.KindFor(S(SubscriptionState.Trial, days)));

    [Fact]
    public void A_plan_reminds_only_when_nothing_is_queued_after_it()
    {
        Assert.Equal("plan_3", ReminderService.KindFor(S(SubscriptionState.Active, 3, End, PaidPlan.Monthly)));
        Assert.Null(ReminderService.KindFor(S(SubscriptionState.Active, 3, End.AddMonths(1), PaidPlan.Monthly))); // renewed already
        Assert.Null(ReminderService.KindFor(S(SubscriptionState.Trial, 7, End))); // paid during the trial
    }

    [Fact]
    public void Read_only_once_but_never_for_a_suspension_or_grace()
    {
        Assert.Equal("read_only", ReminderService.KindFor(S(SubscriptionState.TrialEnded, 0)));
        Assert.Equal("read_only", ReminderService.KindFor(S(SubscriptionState.Expired, 0)));
        Assert.Null(ReminderService.KindFor(S(SubscriptionState.Suspended, 0)));
        Assert.Null(ReminderService.KindFor(S(SubscriptionState.TrialGrace, 2)));
    }
}
