using Lamma.Application.Businesses;
using Lamma.Application.Common;
using Lamma.Application.Identity;
using Lamma.Domain.Businesses;

namespace Lamma.Application.Tests;

public sealed class AuthServiceTests
{
    private readonly FakeIdentityService _identity = new();

    private AuthService Create(FakeEmailSender? email = null) => new(_identity, new FakeAccountService(), email ?? new FakeEmailSender(), new FakeLinks());

    [Fact]
    public async Task Forgot_password_when_email_is_not_configured_fails_before_any_lookup()
    {
        var service = Create(new FakeEmailSender(configured: false));

        var ex = await Assert.ThrowsAsync<ServiceUnavailableException>(() => service.ForgotPasswordAsync(new("reem@example.com"), default));

        Assert.Equal("email.not_configured", ex.Code);
        Assert.Equal(0, _identity.LookupCount); // response cannot reveal whether the account exists
    }

    [Fact]
    public async Task Forgot_password_for_unknown_email_completes_silently_without_sending()
    {
        var email = new FakeEmailSender();
        await Create(email).ForgotPasswordAsync(new("nobody@example.com"), default);
        Assert.Empty(email.Sent);
    }

    [Fact]
    public async Task Forgot_password_for_known_email_sends_a_reset_link()
    {
        var email = new FakeEmailSender();
        _identity.ResetTokens["reem@example.com"] = new PasswordResetToken("ريم", "tok");

        await Create(email).ForgotPasswordAsync(new(" reem@example.com "), default);

        var sent = Assert.Single(email.Sent);
        Assert.Equal("reem@example.com", sent.Email);
        Assert.Contains("token=tok", sent.Link);
    }

    [Fact]
    public async Task Duplicate_email_on_sign_up_is_a_conflict()
    {
        _identity.CreateResult = IdentityResultInfo.Failure(IdentityErrorCodes.DuplicateUserName, IdentityErrorCodes.DuplicateEmail);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => Create().SignUpAsync(new("ريم", "reem@example.com", "lamma2026"), default));
        Assert.Equal("auth.email_taken", ex.Code);
        Assert.Empty(_identity.SignedIn);
    }

    [Fact]
    public async Task Successful_sign_up_signs_the_user_in()
    {
        var userId = Guid.NewGuid();
        _identity.CreateResult = IdentityResultInfo.Success(userId);

        var account = await Create().SignUpAsync(new("ريم", "reem@example.com", "lamma2026"), default);

        Assert.Equal(userId, account.Id);
        Assert.Equal([userId], _identity.SignedIn);
    }

    [Fact]
    public async Task Locked_out_login_maps_to_locked()
    {
        _identity.SignInOutcome = new PasswordSignInOutcome(PasswordSignInStatus.LockedOut, null);
        var ex = await Assert.ThrowsAsync<LockedException>(() => Create().LoginAsync(new("a@b.co", "x", false), default));
        Assert.Equal("auth.locked_out", ex.Code);
    }

    [Fact]
    public async Task Wrong_credentials_map_to_unauthorized()
    {
        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => Create().LoginAsync(new("a@b.co", "x", false), default));
        Assert.Equal("auth.invalid_credentials", ex.Code);
    }

    [Fact]
    public async Task Invalid_reset_token_is_a_field_error_on_token()
    {
        var ex = await Assert.ThrowsAsync<RequestValidationException>(() => Create().ResetPasswordAsync(new("a@b.co", "bad", "lamma2026"), default));
        Assert.Equal("auth.invalid_token", ex.Code);
        Assert.True(ex.Errors.ContainsKey("token"));
    }
}

public sealed class OnboardingServiceTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly FakeBusinessRepository _businesses = new();
    private readonly FakeMembershipRepository _memberships = new();
    private readonly FakeUnitOfWork _unitOfWork = new();
    private readonly FakeClock _clock = new();

    private OnboardingService Create()
        => new(new FakeCurrentUser(_userId), _businesses, _memberships, _unitOfWork, new FakeAccountService(), _clock);

    private static OnboardingRequest Request => new("بوتيك ريم", "clothing", ["instagram", "whatsapp"]);

    [Fact]
    public async Task Creates_business_and_owner_membership_with_one_commit()
    {
        await Create().CompleteAsync(Request, default);

        var business = Assert.Single(_businesses.Added);
        var membership = Assert.Single(_memberships.Added);
        Assert.Equal(BusinessType.Clothing, business.BusinessType);
        Assert.Equal(_clock.UtcNow.AddDays(30), business.TrialEndsAt);
        Assert.Equal(_userId, membership.UserId);
        Assert.Equal(business.Id, membership.BusinessId);
        Assert.Equal(1, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task Already_onboarded_user_gets_a_conflict_and_nothing_is_added()
    {
        _memberships.Exists = true;

        var ex = await Assert.ThrowsAsync<ConflictException>(() => Create().CompleteAsync(Request, default));

        Assert.Equal("onboarding.already_completed", ex.Code);
        Assert.Empty(_businesses.Added);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task A_concurrent_duplicate_detected_by_the_database_is_a_conflict()
    {
        _unitOfWork.ThrowOnSave = new UniqueConstraintViolationException("UX_BusinessMemberships_UserId", new Exception());
        var ex = await Assert.ThrowsAsync<ConflictException>(() => Create().CompleteAsync(Request, default));
        Assert.Equal("onboarding.already_completed", ex.Code);
    }
}
