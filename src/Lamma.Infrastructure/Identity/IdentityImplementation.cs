using System.Security.Claims;
using Lamma.Application.Common;
using Lamma.Application.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;

namespace Lamma.Infrastructure.Identity;

/// <summary>The owner's login account (ASP.NET Core Identity). UserName = Email.</summary>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    public ApplicationUser()
    {
        Id = Guid.CreateVersion7();
        SecurityStamp = Guid.NewGuid().ToString();
    }

    public string FullName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

/// <summary>Requires at least one letter in any script (Arabic or Latin). Identity has no built-in rule for this.</summary>
public sealed class RequireLetterPasswordValidator : IPasswordValidator<ApplicationUser>
{
    public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user, string? password)
        => Task.FromResult(password is not null && password.Any(char.IsLetter)
            ? IdentityResult.Success
            : IdentityResult.Failed(new IdentityError { Code = IdentityErrorCodes.PasswordRequiresLetter, Description = "Password requires a letter." }));
}

/// <summary>Reads the user id from the authenticated principal.</summary>
internal sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public bool IsAuthenticated => UserId.HasValue;

    public Guid? UserId
    {
        get
        {
            var principal = accessor.HttpContext?.User;
            if (principal?.Identity?.IsAuthenticated != true)
            {
                return null;
            }

            return Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        }
    }

    public Guid RequiredUserId => UserId ?? throw new UnauthorizedException("auth.unauthenticated", "لازم تسجّل دخول.");
}

/// <summary>Adapter from the application's <see cref="IIdentityService"/> port to UserManager/SignInManager.</summary>
internal sealed class IdentityService(
    UserManager<ApplicationUser> users,
    SignInManager<ApplicationUser> signIn,
    IClock clock) : IIdentityService
{
    public async Task<IdentityResultInfo> CreateUserAsync(string fullName, string email, string password, CancellationToken cancellationToken)
    {
        var user = new ApplicationUser { UserName = email, Email = email, FullName = fullName, CreatedAt = clock.UtcNow };
        var result = await users.CreateAsync(user, password);
        return result.Succeeded ? IdentityResultInfo.Success(user.Id) : Fail(result);
    }

    public async Task<PasswordSignInOutcome> PasswordSignInAsync(string email, string password, bool persistent, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            return new PasswordSignInOutcome(PasswordSignInStatus.InvalidCredentials, null);
        }

        var result = await signIn.PasswordSignInAsync(user, password, persistent, lockoutOnFailure: true);
        if (result.Succeeded)
        {
            return new PasswordSignInOutcome(PasswordSignInStatus.Succeeded, user.Id);
        }

        return new PasswordSignInOutcome(result.IsLockedOut ? PasswordSignInStatus.LockedOut : PasswordSignInStatus.InvalidCredentials, null);
    }

    public async Task SignInAsync(Guid userId, bool persistent, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString()) ?? throw new InvalidOperationException("User not found.");
        await signIn.SignInAsync(user, persistent);
    }

    public Task SignOutAsync() => signIn.SignOutAsync();

    public async Task<PasswordResetToken?> GeneratePasswordResetTokenAsync(string email, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        return user is null ? null : new PasswordResetToken(user.FullName, await users.GeneratePasswordResetTokenAsync(user));
    }

    public async Task<IdentityResultInfo> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            return IdentityResultInfo.Failure(IdentityErrorCodes.UserNotFound);
        }

        var result = await users.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded)
        {
            return Fail(result);
        }

        // A successful reset also clears a lockout caused by the forgotten password.
        await users.ResetAccessFailedCountAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
        return IdentityResultInfo.Success(user.Id);
    }

    public async Task<IdentityResultInfo> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return IdentityResultInfo.Failure(IdentityErrorCodes.UserNotFound);
        }

        var result = await users.ChangePasswordAsync(user, currentPassword, newPassword);
        if (!result.Succeeded)
        {
            return Fail(result);
        }

        // The security stamp changed: other sessions are rejected; re-issue this session's cookie.
        await signIn.RefreshSignInAsync(user);
        return IdentityResultInfo.Success(user.Id);
    }

    public async Task<UserProfile?> GetProfileAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        return user is null ? null : new UserProfile(user.Id, user.FullName, user.Email ?? string.Empty);
    }

    public async Task<IdentityResultInfo> UpdateFullNameAsync(Guid userId, string fullName, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return IdentityResultInfo.Failure(IdentityErrorCodes.UserNotFound);
        }

        user.FullName = fullName;
        var result = await users.UpdateAsync(user);
        return result.Succeeded ? IdentityResultInfo.Success(user.Id) : Fail(result);
    }

    private static IdentityResultInfo Fail(IdentityResult result) => new(false, result.Errors.Select(e => e.Code).ToList());
}
