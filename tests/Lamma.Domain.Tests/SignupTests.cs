using Lamma.Domain.Common;
using Lamma.Domain.Signup;

namespace Lamma.Domain.Tests;

public sealed class SignupLeadTests
{
    private static readonly DateTime Now = new(2026, 11, 22, 9, 0, 0, DateTimeKind.Utc);
    private static readonly string Hash = new('a', 64);

    private static SignupLead Lead() => SignupLead.Create("ريم الخطيب", " Reem@Example.com ", "0791234567", "بوتيك ريم", new Utm("ig", "social", null), Now);

    [Theory]
    [InlineData("0791234567", "+962791234567")]
    [InlineData("+962 78 123 4567", "+962781234567")]
    [InlineData("00962771234567", "+962771234567")]
    [InlineData("٠٧٩١٢٣٤٥٦٧", "+962791234567")]
    [InlineData("0612345678", null)] // landline
    [InlineData("+97150123456", null)] // not Jordanian
    [InlineData("", null)]
    public void Only_Jordanian_mobiles_are_accepted(string input, string? expected) => Assert.Equal(expected, SignupLead.JordanMobile(input));

    [Fact]
    public void Create_normalizes_email_and_keeps_the_form_details()
    {
        var lead = Lead();
        Assert.Equal(("Reem@Example.com", "REEM@EXAMPLE.COM", "+962791234567", "ig"), (lead.Email, lead.NormalizedEmail, lead.PhoneE164, lead.UtmSource));
        Assert.Equal(SignupLeadStatus.Pending, lead.Status);
        Assert.False(lead.InviteIsValid(Now));
        Assert.Equal("signup.invalid_phone", Assert.Throws<DomainException>(() => SignupLead.Create("x", "a@b.c", "123", null, Utm.None, Now)).Code);
    }

    [Fact]
    public void Invite_lasts_72_hours_and_registration_spends_it()
    {
        var lead = Lead();
        lead.IssueInvite(Hash, Now);
        Assert.True(lead.InviteIsValid(Now.AddHours(71.9)));
        Assert.False(lead.InviteIsValid(Now.AddHours(72)));

        var user = Guid.NewGuid();
        lead.MarkRegistered(user, Now.AddHours(1));
        Assert.Equal((SignupLeadStatus.Registered, user, (string?)null), (lead.Status, lead.UserId, lead.InviteTokenHash));
        Assert.False(lead.InviteIsValid(Now.AddHours(1)));
        Assert.Throws<DomainException>(() => lead.IssueInvite(Hash, Now.AddHours(2)));
    }

    [Fact]
    public void At_most_three_sends_in_24_hours()
    {
        var lead = Lead();
        lead.IssueInvite(Hash, Now);
        lead.IssueInvite(Hash, Now.AddHours(1));
        lead.IssueInvite(Hash, Now.AddHours(2));
        Assert.False(lead.CanSend(Now.AddHours(3)));
        Assert.Equal("signup.too_many_sends", Assert.Throws<DomainException>(() => lead.IssueInvite(Hash, Now.AddHours(3))).Code);

        Assert.True(lead.CanSend(Now.AddHours(24))); // a new window
        lead.IssueInvite(Hash, Now.AddHours(24));
        Assert.Equal((4, 1), (lead.SendCount, lead.SendsInWindow));
    }
}
