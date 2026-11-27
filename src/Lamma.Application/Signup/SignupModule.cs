using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Lamma.Application.Accounts;
using Lamma.Application.Common;
using Lamma.Application.Common.Email;
using Lamma.Application.Common.Validation;
using Lamma.Application.Identity;
using Lamma.Domain.Signup;

namespace Lamma.Application.Signup;

// ---------- Contracts (API-DESIGN §21) ----------

/// <summary>
/// The public sign-up form (D-160). <c>Website</c> is a hidden honeypot field: people leave it empty, bots fill it.
/// </summary>
public sealed record PublicSignupRequest(
    string FullName,
    string Email,
    string Phone,
    string? StoreName,
    string? Website,
    string? UtmSource,
    string? UtmMedium,
    string? UtmCampaign);

public sealed record InvitationDto(string Email, string FullName);

public sealed record RegisterRequest(string Token, string Password, string ConfirmPassword);

public sealed class PublicSignupRequestValidator : AbstractValidator<PublicSignupRequest>
{
    public PublicSignupRequestValidator()
    {
        RuleFor(x => x.FullName).LammaPersonName();
        RuleFor(x => x.Email).LammaEmail();
        RuleFor(x => x.Phone)
            .Must(p => SignupLead.JordanMobile(p) is not null)
            .WithMessage("اكتب رقم موبايل أردني، مثلًا 0791234567.");
        RuleFor(x => x.StoreName).MaximumLength(SignupLead.StoreNameMaxLength).WithMessage($"اسم المتجر لازم يكون {SignupLead.StoreNameMaxLength} حرف أو أقل.");
    }
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Token).NotEmpty().WithMessage("رابط التسجيل ناقص.");
        RuleFor(x => x.Password).LammaPassword();
        RuleFor(x => x.ConfirmPassword).Equal(x => x.Password).WithMessage("تأكيد كلمة السر مش مطابق.");
    }
}

// ---------- Ports ----------

public interface ISignupLeadRepository
{
    Task<SignupLead?> FindByEmailAsync(string normalizedEmail, CancellationToken cancellationToken);

    Task<SignupLead?> FindByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);

    Task<SignupLead?> FindByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The lead that became this user (for the onboarding store-name prefill, D-185).</summary>
    Task<SignupLead?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken);

    void Add(SignupLead lead);
}

// ---------- Tokens ----------

/// <summary>Invitation tokens: 32 random bytes as base64url in the link; only the SHA-256 hex hash is stored (D-160).</summary>
public static class InviteTokens
{
    public static (string Token, string Hash) Generate()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return (token, Hash(token));
    }

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));
}

// ---------- Service ----------

public interface ISignupService
{
    /// <summary>
    /// Always completes the same way, whether the email is new, pending or already a user (no enumeration). A pending
    /// lead gets a fresh link, at most 3 in 24 hours (D-161).
    /// </summary>
    Task SubmitAsync(PublicSignupRequest request, CancellationToken cancellationToken);

    Task<InvitationDto> GetInvitationAsync(string token, CancellationToken cancellationToken);

    /// <summary>Creates the account from a valid invitation and signs in; onboarding then starts the trial (D-180).</summary>
    Task<AccountDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    /// <summary>The admin's «resend»: a fresh link for a pending lead, ignoring the daily limit. The caller saves.</summary>
    Task<SignupLead> ResendAsync(Guid leadId, CancellationToken cancellationToken);
}

internal sealed class SignupService(
    ISignupLeadRepository leads,
    IIdentityService identity,
    IAccountService accounts,
    IEmailSender email,
    IAppLinks links,
    IUnitOfWork unitOfWork,
    Subscriptions.IPlatformAdmins admins,
    IClock clock) : ISignupService
{
    public async Task SubmitAsync(PublicSignupRequest request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            return; // honeypot: answer like a success, send nothing
        }

        var now = clock.UtcNow;
        if (await identity.EmailExistsAsync(request.Email.Trim(), cancellationToken))
        {
            return; // already a user: nothing to send, same answer
        }

        var utm = new Utm(request.UtmSource, request.UtmMedium, request.UtmCampaign);
        var lead = await leads.FindByEmailAsync(SignupLead.Normalize(request.Email), cancellationToken);
        if (lead is null)
        {
            lead = SignupLead.Create(request.FullName, request.Email, request.Phone, request.StoreName, utm, now);
            leads.Add(lead);
        }
        else if (lead.Status == SignupLeadStatus.Registered)
        {
            return;
        }
        else
        {
            lead.Update(request.FullName, request.Phone, request.StoreName, utm, now);
        }

        if (!lead.CanSend(now))
        {
            await unitOfWork.SaveChangesAsync(cancellationToken); // keep the latest details, send nothing
            return;
        }

        var (token, hash) = InviteTokens.Generate();
        lead.IssueInvite(hash, now);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            return; // the same email arrived twice at once: the other request sends the link
        }

        await email.SendAsync(
            EmailTemplates.Invitation(lead.Email, lead.FullName, lead.StoreName, links.Register(token), SignupLead.InviteValidHours),
            cancellationToken);
    }

    public async Task<SignupLead> ResendAsync(Guid leadId, CancellationToken cancellationToken)
    {
        var lead = await leads.FindByIdAsync(leadId, cancellationToken)
            ?? throw new NotFoundException("signup.lead_not_found", "الطلب مش موجود.");
        if (lead.Status != SignupLeadStatus.Pending)
        {
            throw new ConflictException("signup.already_registered", "هالشخص سجّل حسابه من قبل.");
        }

        var (token, hash) = InviteTokens.Generate();
        lead.IssueInvite(hash, clock.UtcNow, byAdmin: true);
        await email.SendAsync(
            EmailTemplates.Invitation(lead.Email, lead.FullName, lead.StoreName, links.Register(token), SignupLead.InviteValidHours),
            cancellationToken);
        return lead;
    }

    public async Task<InvitationDto> GetInvitationAsync(string token, CancellationToken cancellationToken)
    {
        var lead = await ValidLeadAsync(token, cancellationToken);
        return new InvitationDto(lead.Email, lead.FullName);
    }

    public async Task<AccountDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var lead = await ValidLeadAsync(request.Token, cancellationToken);
        Guid userId = default;
        await unitOfWork.ExecuteInTransactionAsync(
            async ct =>
            {
                var result = await identity.CreateUserAsync(lead.FullName, lead.Email, request.Password, ct, lead.PhoneE164);
                if (!result.Succeeded)
                {
                    if (result.ErrorCodes.Contains(IdentityErrorCodes.DuplicateEmail) || result.ErrorCodes.Contains(IdentityErrorCodes.DuplicateUserName))
                    {
                        throw new ConflictException("auth.email_taken", "هاد الإيميل مسجّل من قبل. جرّب تسجّل دخول.");
                    }

                    throw PasswordErrors.ToValidationException("password", result.ErrorCodes);
                }

                userId = result.UserId!.Value;
                lead.MarkRegistered(userId, clock.UtcNow);
                await unitOfWork.SaveChangesAsync(ct);
            },
            cancellationToken);

        await admins.SyncAsync(lead.Email, cancellationToken); // the admin account is promoted at once (D-182)
        await identity.SignInAsync(userId, persistent: false, cancellationToken);
        return await accounts.GetByUserIdAsync(userId, cancellationToken);
    }

    private async Task<SignupLead> ValidLeadAsync(string token, CancellationToken cancellationToken)
    {
        var lead = string.IsNullOrWhiteSpace(token) ? null : await leads.FindByTokenHashAsync(InviteTokens.Hash(token), cancellationToken);
        if (lead is null)
        {
            throw new NotFoundException("invite.invalid", "رابط التسجيل مش صحيح أو انستخدم قبل. عبّي النموذج من جديد ليوصلك رابط جديد.");
        }

        if (!lead.InviteIsValid(clock.UtcNow))
        {
            throw new GoneException("invite.expired", "رابط التسجيل انتهت صلاحيته. عبّي النموذج من جديد ليوصلك رابط جديد.");
        }

        return lead;
    }
}
