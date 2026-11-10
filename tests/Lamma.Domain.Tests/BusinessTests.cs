using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Domain.Tests;

public sealed class BusinessTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);

    private static Business NewBusiness(params SalesChannel[] channels)
        => Business.Create("  بوتيك ريم  ", BusinessType.Clothing, channels.Length == 0 ? [SalesChannel.Instagram] : channels, Now);

    [Fact]
    public void Create_applies_approved_defaults()
    {
        var business = NewBusiness(SalesChannel.Instagram, SalesChannel.Whatsapp);

        Assert.NotEqual(Guid.Empty, business.Id);
        Assert.Equal("بوتيك ريم", business.Name);
        Assert.Equal("JOD", business.Currency);
        Assert.Equal(5, business.DefaultLowStockThreshold);
        Assert.Equal("Asia/Amman", business.TimeZoneId);
        Assert.Equal(SubscriptionPlan.Trial, business.SubscriptionPlan);
        Assert.Equal(Now, business.TrialStartsAt);
        Assert.Equal(Now.AddDays(30), business.TrialEndsAt);
    }

    [Fact]
    public void Create_adds_a_row_for_every_channel_and_method_with_the_right_flags()
    {
        var business = NewBusiness(SalesChannel.Instagram, SalesChannel.Whatsapp);

        Assert.Equal(4, business.SalesChannels.Count);
        Assert.All(business.SalesChannels, c => Assert.Equal(business.Id, c.BusinessId));
        Assert.Equal(
            [SalesChannel.Instagram, SalesChannel.Whatsapp],
            business.SalesChannels.Where(c => c.IsEnabled).Select(c => c.Channel).Order().ToArray());

        Assert.Equal(6, business.PaymentMethods.Count);
        Assert.Equal(
            [PaymentMethod.Cash, PaymentMethod.Cliq, PaymentMethod.BankTransfer, PaymentMethod.Cod],
            business.PaymentMethods.Where(m => m.IsEnabled).Select(m => m.Method).Order().ToArray());
    }

    [Fact]
    public void Create_requires_at_least_one_channel()
    {
        var ex = Assert.Throws<DomainException>(() => Business.Create("x", BusinessType.Other, [], Now));
        Assert.Equal("settings.channel_required", ex.Code);
    }

    [Fact]
    public void Name_longer_than_100_is_rejected()
    {
        var ex = Assert.Throws<DomainException>(() => Business.Create(new string('a', 101), BusinessType.Other, [SalesChannel.Other], Now));
        Assert.Equal("business.name_too_long", ex.Code);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1001)]
    public void UpdateProfile_rejects_threshold_out_of_range(int threshold)
    {
        var business = NewBusiness();
        var ex = Assert.Throws<DomainException>(() => business.UpdateProfile("x", BusinessType.Books, threshold));
        Assert.Equal("settings.invalid_low_stock_threshold", ex.Code);
        Assert.Equal(5, business.DefaultLowStockThreshold);
    }

    [Fact]
    public void UpdateProfile_changes_name_type_and_threshold()
    {
        var business = NewBusiness();
        business.UpdateProfile(" عطور لمى ", BusinessType.Perfume, 0);

        Assert.Equal("عطور لمى", business.Name);
        Assert.Equal(BusinessType.Perfume, business.BusinessType);
        Assert.Equal(0, business.DefaultLowStockThreshold);
    }

    [Fact]
    public void Disabling_every_channel_is_rejected_and_leaves_state_unchanged()
    {
        var business = NewBusiness(SalesChannel.Instagram);
        var all = EnumCode.All<SalesChannel>().ToDictionary(c => c, _ => false);

        var ex = Assert.Throws<DomainException>(() => business.SetSalesChannels(all));

        Assert.Equal("settings.channel_required", ex.Code);
        Assert.True(business.SalesChannels.Single(c => c.Channel == SalesChannel.Instagram).IsEnabled);
    }

    [Fact]
    public void Disabling_every_payment_method_is_rejected_and_leaves_state_unchanged()
    {
        var business = NewBusiness();
        var all = EnumCode.All<PaymentMethod>().ToDictionary(m => m, _ => false);

        var ex = Assert.Throws<DomainException>(() => business.SetPaymentMethods(all));

        Assert.Equal("settings.payment_method_required", ex.Code);
        Assert.Equal(4, business.PaymentMethods.Count(m => m.IsEnabled));
    }

    [Fact]
    public void SetPaymentMethods_applies_listed_flags_only()
    {
        var business = NewBusiness();
        business.SetPaymentMethods(new Dictionary<PaymentMethod, bool> { [PaymentMethod.ZainCash] = true, [PaymentMethod.Cash] = false });

        Assert.True(business.PaymentMethods.Single(m => m.Method == PaymentMethod.ZainCash).IsEnabled);
        Assert.False(business.PaymentMethods.Single(m => m.Method == PaymentMethod.Cash).IsEnabled);
        Assert.True(business.PaymentMethods.Single(m => m.Method == PaymentMethod.Cliq).IsEnabled);
    }

    [Fact]
    public void Membership_is_an_owner_link()
    {
        var userId = Guid.NewGuid();
        var businessId = Guid.NewGuid();
        var membership = BusinessMembership.CreateOwner(userId, businessId, Now);

        Assert.Equal(userId, membership.UserId);
        Assert.Equal(businessId, membership.BusinessId);
        Assert.Equal(MembershipRole.Owner, membership.Role);
        Assert.Equal(Now, membership.CreatedAt);
    }
}

public sealed class TrialDaysTests
{
    private static readonly TimeZoneInfo Amman = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    [Fact]
    public void A_new_trial_has_thirty_days_left()
    {
        var start = new DateTime(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);
        Assert.Equal(30, Business.TrialDaysRemaining(start.AddDays(30), start, Amman));
    }

    [Fact]
    public void Days_are_counted_in_Amman_local_dates()
    {
        // Trial ends 2026-12-10 12:00 Amman. At 21:30 UTC on Nov 10 it is already Nov 11 in Amman (UTC+3).
        var ends = new DateTime(2026, 12, 10, 9, 0, 0, DateTimeKind.Utc);
        Assert.Equal(30, Business.TrialDaysRemaining(ends, new DateTime(2026, 11, 10, 20, 59, 0, DateTimeKind.Utc), Amman));
        Assert.Equal(29, Business.TrialDaysRemaining(ends, new DateTime(2026, 11, 10, 21, 30, 0, DateTimeKind.Utc), Amman));
    }

    [Fact]
    public void Remaining_days_never_go_negative()
    {
        var ends = new DateTime(2026, 12, 10, 9, 0, 0, DateTimeKind.Utc);
        Assert.Equal(0, Business.TrialDaysRemaining(ends, ends.AddDays(5), Amman));
    }
}
