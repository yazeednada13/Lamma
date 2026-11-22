using System.Net;
using System.Text.Json;
using Lamma.Api.IntegrationTests.Infrastructure;
using Lamma.Application.Common.Email;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Lamma.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class SignupApiTests(LammaApiFactory factory)
{
    private static object Form(string email, string phone = "0791234567", string? website = null)
        => new { fullName = "ريم الخطيب", email, phone, storeName = "بوتيك ريم", website, utmSource = "ig", utmMedium = "social", utmCampaign = (string?)null };

    private IReadOnlyList<EmailMessage> MailTo(string email) => factory.Email.Messages.Where(m => m.To.Equals(email, StringComparison.OrdinalIgnoreCase)).ToList();

    private static string TokenOf(EmailMessage m) => Uri.UnescapeDataString(m.Link!.Split("token=")[1]);

    [Fact]
    public async Task Invitation_flow_from_form_to_trial()
    {
        var visitor = factory.NewSession();
        var email = ApiSession.NewEmail();

        Assert.Equal(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/v1/public/signup", Form(email))).StatusCode);
        var first = Assert.Single(MailTo(email));
        Assert.Equal(EmailTemplates.InvitationKind, first.Kind);
        Assert.StartsWith("https://app.lamma.test/register?token=", first.Link);
        Assert.Contains("بوتيك ريم", first.Html);

        var invitation = await visitor.GetJsonAsync($"/api/v1/public/invitations/{Uri.EscapeDataString(TokenOf(first))}");
        Assert.Equal((email, "ريم الخطيب"), (invitation.GetProperty("email").GetString(), invitation.GetProperty("fullName").GetString()));

        // Sending the form again replaces the link: the old one stops working.
        Assert.Equal(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/v1/public/signup", Form(email))).StatusCode);
        var second = MailTo(email)[^1];
        await (await visitor.GetAsync($"/api/v1/public/invitations/{Uri.EscapeDataString(TokenOf(first))}")).AssertProblemAsync(HttpStatusCode.NotFound, "invite.invalid");

        var token = TokenOf(second);
        await (await visitor.PostAsync("/api/v1/auth/register", new { token, password = "pass1234", confirmPassword = "pass9999" })).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
        var registered = await visitor.PostAsync("/api/v1/auth/register", new { token, password = "pass1234", confirmPassword = "pass1234" });
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        Assert.Equal(email, (await registered.JsonAsync()).GetProperty("email").GetString());

        await visitor.RefreshTokenAsync();
        await visitor.OnboardAsync("بوتيك ريم");
        var account = await visitor.GetJsonAsync("/api/v1/account");
        Assert.Equal(30, account.GetProperty("business").GetProperty("trialDaysRemaining").GetInt32());

        // The link is spent, and the account can sign in with its password.
        await (await factory.NewSession().PostAsync("/api/v1/auth/register", new { token, password = "pass1234", confirmPassword = "pass1234" })).AssertProblemAsync(HttpStatusCode.NotFound, "invite.invalid");
        Assert.Equal(HttpStatusCode.OK, (await factory.NewSession().LoginAsync(email, "pass1234")).StatusCode);

        // A registered email gets the same answer and no new email.
        var before = MailTo(email).Count;
        Assert.Equal(HttpStatusCode.Accepted, (await factory.NewSession().PostAsync("/api/v1/public/signup", Form(email))).StatusCode);
        Assert.Equal(before, MailTo(email).Count);
    }

    [Fact]
    public async Task Same_answer_without_sending_for_users_bots_and_the_fourth_request()
    {
        var owner = factory.NewSession();
        var userEmail = await owner.SignUpAndOnboardAsync();
        var visitor = factory.NewSession();
        Assert.Equal(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/v1/public/signup", Form(userEmail))).StatusCode);
        Assert.DoesNotContain(MailTo(userEmail), m => m.Kind == EmailTemplates.InvitationKind);

        var bot = ApiSession.NewEmail();
        Assert.Equal(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/v1/public/signup", Form(bot, website: "http://spam"))).StatusCode);
        Assert.Empty(MailTo(bot));

        var eager = ApiSession.NewEmail();
        for (var i = 0; i < 4; i++)
        {
            Assert.Equal(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/v1/public/signup", Form(eager))).StatusCode);
        }

        Assert.Equal(3, MailTo(eager).Count); // at most 3 links in 24 hours (D-161)

        await (await visitor.PostAsync("/api/v1/public/signup", Form(ApiSession.NewEmail(), phone: "0612345678"))).AssertProblemAsync(HttpStatusCode.UnprocessableEntity, "validation.failed");
    }

    [Fact]
    public async Task Links_expire_after_72_hours()
    {
        var real = factory.Clock.UtcNow;
        try
        {
            var visitor = factory.NewSession();
            var email = ApiSession.NewEmail();
            await visitor.PostAsync("/api/v1/public/signup", Form(email));
            var token = TokenOf(Assert.Single(MailTo(email)));

            factory.Clock.UtcNow = real.AddHours(73);
            await (await visitor.GetAsync($"/api/v1/public/invitations/{Uri.EscapeDataString(token)}")).AssertProblemAsync(HttpStatusCode.Gone, "invite.expired");
            await (await visitor.PostAsync("/api/v1/auth/register", new { token, password = "pass1234", confirmPassword = "pass1234" })).AssertProblemAsync(HttpStatusCode.Gone, "invite.expired");
            await (await visitor.GetAsync("/api/v1/public/invitations/not-a-token")).AssertProblemAsync(HttpStatusCode.NotFound, "invite.invalid");
        }
        finally
        {
            factory.Clock.UtcNow = real;
        }
    }

    [Fact]
    public async Task Open_sign_up_is_closed_when_invite_only()
    {
        using var closed = factory.WithWebHostBuilder(b => b.UseSetting("Registration:InviteOnly", "true"));
        var session = new ApiSession(closed.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true, AllowAutoRedirect = false }));
        var response = await session.PostAsync("/api/v1/auth/signup", new { fullName = "ريم", email = ApiSession.NewEmail(), password = "pass1234" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
