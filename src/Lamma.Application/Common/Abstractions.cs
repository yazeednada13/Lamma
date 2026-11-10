namespace Lamma.Application.Common;

/// <summary>Current time. Always use this instead of DateTime.UtcNow so tests can control time.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

/// <summary>The authenticated user of the current request (from the auth cookie claims).</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>The user id, or null when anonymous.</summary>
    Guid? UserId { get; }

    /// <summary>The user id; throws <see cref="UnauthorizedException"/> when anonymous.</summary>
    Guid RequiredUserId { get; }
}

/// <summary>
/// The business of the current request, resolved ON THE SERVER from the user's membership
/// (MASTER-ARCHITECTURE §6.2). Never taken from client input.
/// </summary>
public interface ICurrentBusiness
{
    bool HasBusiness { get; }

    /// <summary>The business id; throws <see cref="ForbiddenException"/> (business.not_onboarded) when the user has none.</summary>
    Guid BusinessId { get; }
}

/// <summary>Resolves <see cref="ICurrentBusiness"/> once per request (called by the API pipeline after authentication).</summary>
public interface ICurrentBusinessResolver
{
    Task ResolveAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Commit boundary for one business operation (MASTER-ARCHITECTURE §4.3).
/// Repositories never save; the application service commits once.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>Commits tracked changes atomically. Unique-key violations surface as <see cref="UniqueConstraintViolationException"/>.</summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Runs <paramref name="work"/> inside one database transaction (within the retry execution strategy).</summary>
    Task ExecuteInTransactionAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken);
}

/// <summary>Outgoing email. A real provider is not chosen yet (OQ-003); see <see cref="IsConfigured"/>.</summary>
public interface IEmailSender
{
    bool IsConfigured { get; }

    Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken);
}

/// <summary>Builds links into the frontend app (e.g. the password-reset page).</summary>
public interface IAppLinks
{
    string PasswordReset(string email, string token);
}
