using FluentValidation;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Businesses;

namespace Lamma.Application.Accounts;

/// <summary>
/// The signed-in user and, once onboarded, a summary of their business. <c>IsPlatformAdmin</c> sends the admin to the
/// admin area (D-175); <c>SuggestedBusinessName</c> prefills onboarding from the sign-up form (D-185).
/// </summary>
public sealed record AccountDto(
    Guid Id,
    string FullName,
    string Email,
    bool IsOnboarded,
    BusinessSummaryDto? Business,
    bool IsPlatformAdmin = false,
    string? SuggestedBusinessName = null);

/// <summary>The business and its subscription status (D-167, D-183), so the app shell can show banners.</summary>
public sealed record BusinessSummaryDto(
    Guid Id,
    string Name,
    string BusinessType,
    DateTime TrialEndsAt,
    int TrialDaysRemaining,
    string Plan,
    Subscriptions.SubscriptionSummaryDto? Subscription = null);

public sealed record UpdateAccountRequest(string FullName);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>Read model row used to build <see cref="BusinessSummaryDto"/>.</summary>
public sealed record BusinessSummaryRow(
    Guid Id,
    string Name,
    BusinessType BusinessType,
    DateTime TrialEndsAt,
    string TimeZoneId);

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
