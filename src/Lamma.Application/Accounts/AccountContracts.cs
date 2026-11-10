using FluentValidation;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Businesses;

namespace Lamma.Application.Accounts;

/// <summary>The signed-in owner and, once onboarded, a summary of their business.</summary>
public sealed record AccountDto(Guid Id, string FullName, string Email, bool IsOnboarded, BusinessSummaryDto? Business);

/// <summary>Trial figures are display-only; trial-expiry enforcement is not approved (D-011).</summary>
public sealed record BusinessSummaryDto(
    Guid Id,
    string Name,
    string BusinessType,
    DateTime TrialEndsAt,
    int TrialDaysRemaining,
    string Plan);

public sealed record UpdateAccountRequest(string FullName);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>Read model row used to build <see cref="BusinessSummaryDto"/>.</summary>
public sealed record BusinessSummaryRow(
    Guid Id,
    string Name,
    BusinessType BusinessType,
    DateTime TrialEndsAt,
    string TimeZoneId,
    SubscriptionPlan Plan);

public sealed class UpdateAccountRequestValidator : AbstractValidator<UpdateAccountRequest>
{
    public UpdateAccountRequestValidator()
    {
        RuleFor(x => x.FullName).LammaPersonName();
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("اكتب كلمة السر الحالية.");
        RuleFor(x => x.NewPassword).LammaPassword();
        RuleFor(x => x.NewPassword)
            .NotEqual(x => x.CurrentPassword)
            .WithMessage("كلمة السر الجديدة لازم تختلف عن الحالية.");
    }
}
