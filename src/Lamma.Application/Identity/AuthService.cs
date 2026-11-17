using Lamma.Application.Accounts;
using Lamma.Application.Common;

namespace Lamma.Application.Identity;

public interface IAuthService
{
    Task<AccountDto> SignUpAsync(SignUpRequest request, CancellationToken cancellationToken);

    Task<AccountDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    Task LogoutAsync();

    /// <summary>Always completes the same way whether or not the email exists (no account enumeration).</summary>
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken);

    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken);
}

/// <summary>Sign-up, login, logout and password recovery (email only, D-078; no email confirmation yet, D-084).</summary>
internal sealed class AuthService(
    IIdentityService identity,
    IAccountService accounts,
    IEmailSender emailSender,
    IAppLinks links) : IAuthService
{
    public async Task<AccountDto> SignUpAsync(SignUpRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var result = await identity.CreateUserAsync(request.FullName.Trim(), email, request.Password, cancellationToken);
        if (!result.Succeeded)
        {
            if (result.ErrorCodes.Contains(IdentityErrorCodes.DuplicateEmail) || result.ErrorCodes.Contains(IdentityErrorCodes.DuplicateUserName))
            {
                throw new ConflictException("auth.email_taken", "هاد الإيميل مسجّل من قبل. جرّب تسجّل دخول.");
            }

            throw PasswordErrors.ToValidationException("password", result.ErrorCodes);
        }

        var userId = result.UserId!.Value;
        await identity.SignInAsync(userId, persistent: false, cancellationToken);
        return await accounts.GetByUserIdAsync(userId, cancellationToken);
    }

    public async Task<AccountDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var outcome = await identity.PasswordSignInAsync(request.Email.Trim(), request.Password, request.RememberMe, cancellationToken);
        return outcome.Status switch
        {
            PasswordSignInStatus.Succeeded => await accounts.GetByUserIdAsync(outcome.UserId!.Value, cancellationToken),
            PasswordSignInStatus.LockedOut => throw new LockedException(
                "auth.locked_out",
                "انقفل حسابك مؤقتًا بعد كذا محاولة دخول غلط. جرّب بعد 15 دقيقة أو غيّر كلمة السر."),
            _ => throw new UnauthorizedException("auth.invalid_credentials", "الإيميل أو كلمة السر غلط."),
        };
    }

    public Task LogoutAsync() => identity.SignOutAsync();

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        // Checked before any lookup so the response never depends on whether the email exists.
        if (!emailSender.IsConfigured)
        {
            throw new ServiceUnavailableException(
                "email.not_configured",
                "خدمة الإيميل مش جاهزة حاليًا، فما بنقدر نبعت رابط الاستعادة. تواصل مع الدعم.");
        }

        var email = request.Email.Trim();
        var reset = await identity.GeneratePasswordResetTokenAsync(email, cancellationToken);
        if (reset is null)
        {
            return;
        }

        await emailSender.SendPasswordResetAsync(email, reset.FullName, links.PasswordReset(email, reset.Token), cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await identity.ResetPasswordAsync(request.Email.Trim(), request.Token, request.NewPassword, cancellationToken);
        if (result.Succeeded)
        {
            return;
        }

        if (result.ErrorCodes.Contains(IdentityErrorCodes.InvalidToken) || result.ErrorCodes.Contains(IdentityErrorCodes.UserNotFound))
        {
            throw RequestValidationException.ForField("token", "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابط جديد.", "auth.invalid_token");
        }

        throw PasswordErrors.ToValidationException("newPassword", result.ErrorCodes);
    }
}

/// <summary>Maps Identity password errors to an Arabic field error.</summary>
internal static class PasswordErrors
{
    public static RequestValidationException ToValidationException(string field, IReadOnlyList<string> codes)
    {
        var messages = codes
            .Select(code => code switch
            {
                IdentityErrorCodes.PasswordTooShort => "كلمة السر لازم تكون 8 أحرف على الأقل.",
                IdentityErrorCodes.PasswordRequiresDigit => "كلمة السر لازم يكون فيها رقم واحد على الأقل.",
                IdentityErrorCodes.PasswordRequiresLetter => "كلمة السر لازم يكون فيها حرف واحد على الأقل.",
                _ => "كلمة السر مش مقبولة، جرّب وحدة ثانية.",
            })
            .Distinct()
            .ToArray();

        if (messages.Length == 0)
        {
            messages = ["كلمة السر مش مقبولة، جرّب وحدة ثانية."];
        }

        return new RequestValidationException(new Dictionary<string, string[]> { [field] = messages });
    }
}
