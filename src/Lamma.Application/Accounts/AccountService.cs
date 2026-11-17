using Lamma.Application.Common;
using Lamma.Application.Identity;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Application.Accounts;

/// <summary>Read model for the account screen (implemented in Infrastructure with a projection).</summary>
public interface IAccountQueries
{
    Task<BusinessSummaryRow?> GetBusinessSummaryForUserAsync(Guid userId, CancellationToken cancellationToken);
}

public interface IAccountService
{
    Task<AccountDto> GetCurrentAsync(CancellationToken cancellationToken);

    Task<AccountDto> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken);

    Task<AccountDto> UpdateAsync(UpdateAccountRequest request, CancellationToken cancellationToken);

    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken);
}

/// <summary>The owner's profile and password. Responsibility: account read/update use cases.</summary>
internal sealed class AccountService(
    ICurrentUser currentUser,
    IIdentityService identity,
    IAccountQueries queries,
    IClock clock) : IAccountService
{
    public Task<AccountDto> GetCurrentAsync(CancellationToken cancellationToken)
        => GetByUserIdAsync(currentUser.RequiredUserId, cancellationToken);

    public async Task<AccountDto> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        var profile = await identity.GetProfileAsync(userId, cancellationToken)
            ?? throw new UnauthorizedException("auth.unauthenticated", "لازم تسجّل دخول.");

        var row = await queries.GetBusinessSummaryForUserAsync(userId, cancellationToken);
        BusinessSummaryDto? business = null;
        if (row is not null)
        {
            var days = Business.TrialDaysRemaining(row.TrialEndsAt, clock.UtcNow, BusinessTime.FindZone(row.TimeZoneId));
            business = new BusinessSummaryDto(row.Id, row.Name, row.BusinessType.ToCode(), row.TrialEndsAt, days, row.Plan.ToCode());
        }

        return new AccountDto(profile.Id, profile.FullName, profile.Email, business is not null, business);
    }

    public async Task<AccountDto> UpdateAsync(UpdateAccountRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequiredUserId;
        var result = await identity.UpdateFullNameAsync(userId, request.FullName.Trim(), cancellationToken);
        if (!result.Succeeded)
        {
            throw new UnauthorizedException("auth.unauthenticated", "لازم تسجّل دخول.");
        }

        return await GetByUserIdAsync(userId, cancellationToken);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await identity.ChangePasswordAsync(currentUser.RequiredUserId, request.CurrentPassword, request.NewPassword, cancellationToken);
        if (result.Succeeded)
        {
            return;
        }

        if (result.ErrorCodes.Contains(IdentityErrorCodes.PasswordMismatch))
        {
            throw RequestValidationException.ForField("currentPassword", "كلمة السر الحالية غلط.", "auth.wrong_password");
        }

        throw PasswordErrors.ToValidationException("newPassword", result.ErrorCodes);
    }
}
