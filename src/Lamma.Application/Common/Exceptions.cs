namespace Lamma.Application.Common;

/// <summary>
/// Base for expected application errors. The API maps each subtype to an HTTP status and a ProblemDetails body
/// with the stable <see cref="Code"/> and the Arabic, user-safe <see cref="Exception.Message"/>.
/// </summary>
public abstract class AppException : Exception
{
    protected AppException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}

/// <summary>404. Also used for another business's records, so their existence is not revealed.</summary>
public sealed class NotFoundException(string code, string message) : AppException(code, message);

/// <summary>409. The request conflicts with the current state.</summary>
public sealed class ConflictException(string code, string message) : AppException(code, message);

/// <summary>403. Authenticated but not allowed (e.g. not onboarded).</summary>
public sealed class ForbiddenException(string code, string message) : AppException(code, message);

/// <summary>401. Not authenticated, or invalid credentials.</summary>
public sealed class UnauthorizedException(string code, string message) : AppException(code, message);

/// <summary>423. The account is temporarily locked after repeated failed logins.</summary>
public sealed class LockedException(string code, string message) : AppException(code, message);

/// <summary>503. A required external service is not configured or unavailable.</summary>
public sealed class ServiceUnavailableException(string code, string message) : AppException(code, message);

/// <summary>422. Field-level validation errors (keys are camelCase JSON paths).</summary>
public sealed class RequestValidationException : AppException
{
    public const string DefaultCode = "validation.failed";

    public RequestValidationException(IReadOnlyDictionary<string, string[]> errors, string? code = null, string? message = null)
        : base(code ?? DefaultCode, message ?? "في معلومات ناقصة أو غلط، راجعها وجرّب كمان مرة.")
    {
        Errors = errors;
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }

    public static RequestValidationException ForField(string field, string message, string? code = null)
        => new(new Dictionary<string, string[]> { [field] = [message] }, code);
}

/// <summary>
/// Thrown by <see cref="IUnitOfWork.SaveChangesAsync"/> when a unique index is violated
/// (e.g. a second membership for the same user). Services translate it into a domain-specific conflict.
/// </summary>
public sealed class UniqueConstraintViolationException(string? constraintName, Exception inner)
    : Exception("A unique constraint was violated.", inner)
{
    public string? ConstraintName { get; } = constraintName;
}
