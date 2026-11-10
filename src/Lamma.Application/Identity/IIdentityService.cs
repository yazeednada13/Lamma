namespace Lamma.Application.Identity;

/// <summary>
/// Port over ASP.NET Core Identity (implemented in Infrastructure). Keeps Application free of Identity/EF types
/// while the auth use-case rules (validation, enumeration safety, error mapping) live in <see cref="AuthService"/>.
/// </summary>
public interface IIdentityService
{
    Task<IdentityResultInfo> CreateUserAsync(string fullName, string email, string password, CancellationToken cancellationToken);

    Task<PasswordSignInOutcome> PasswordSignInAsync(string email, string password, bool persistent, CancellationToken cancellationToken);

    Task SignInAsync(Guid userId, bool persistent, CancellationToken cancellationToken);

    Task SignOutAsync();

    /// <summary>Returns null when no user has that email.</summary>
    Task<PasswordResetToken?> GeneratePasswordResetTokenAsync(string email, CancellationToken cancellationToken);

    Task<IdentityResultInfo> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken);

    /// <summary>Changes the password, rotates the security stamp (other sessions end) and re-issues the current session cookie.</summary>
    Task<IdentityResultInfo> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken);

    Task<UserProfile?> GetProfileAsync(Guid userId, CancellationToken cancellationToken);

    Task<IdentityResultInfo> UpdateFullNameAsync(Guid userId, string fullName, CancellationToken cancellationToken);
}

/// <summary>Outcome of an Identity operation. <see cref="ErrorCodes"/> are Identity error codes (e.g. "DuplicateEmail").</summary>
public sealed record IdentityResultInfo(bool Succeeded, IReadOnlyList<string> ErrorCodes, Guid? UserId = null)
{
    public static IdentityResultInfo Success(Guid? userId = null) => new(true, [], userId);

    public static IdentityResultInfo Failure(params string[] codes) => new(false, codes);
}

public enum PasswordSignInStatus
{
    Succeeded,
    InvalidCredentials,
    LockedOut,
}

public sealed record PasswordSignInOutcome(PasswordSignInStatus Status, Guid? UserId);

public sealed record PasswordResetToken(string FullName, string Token);

public sealed record UserProfile(Guid Id, string FullName, string Email);

/// <summary>ASP.NET Core Identity error codes the application reacts to.</summary>
public static class IdentityErrorCodes
{
    public const string DuplicateEmail = "DuplicateEmail";
    public const string DuplicateUserName = "DuplicateUserName";
    public const string InvalidToken = "InvalidToken";
    public const string PasswordMismatch = "PasswordMismatch";
    public const string UserNotFound = "UserNotFound";
    public const string PasswordTooShort = "PasswordTooShort";
    public const string PasswordRequiresDigit = "PasswordRequiresDigit";
    public const string PasswordRequiresLetter = "PasswordRequiresLetter";
}
