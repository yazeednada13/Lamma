using FluentValidation;
using Lamma.Application.Common.Validation;

namespace Lamma.Application.Identity;

public sealed record SignUpRequest(string FullName, string Email, string Password);

public sealed record LoginRequest(string Email, string Password, bool RememberMe);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);

public sealed class SignUpRequestValidator : AbstractValidator<SignUpRequest>
{
    public SignUpRequestValidator()
    {
        RuleFor(x => x.FullName).LammaPersonName();
        RuleFor(x => x.Email).LammaEmail();
        RuleFor(x => x.Password).LammaPassword();
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("الإيميل مطلوب.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("كلمة السر مطلوبة.");
    }
}

public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email).LammaEmail();
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email).LammaEmail();
        RuleFor(x => x.Token).NotEmpty().WithMessage("رابط الاستعادة غير صالح.");
        RuleFor(x => x.NewPassword).LammaPassword();
    }
}
