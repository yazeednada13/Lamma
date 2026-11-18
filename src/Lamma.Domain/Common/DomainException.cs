namespace Lamma.Domain.Common;

/// <summary>
/// A business rule was violated. <see cref="Code"/> is a stable machine code (e.g. "settings.channel_required");
/// the message is user-safe Arabic.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}

/// <summary>A business rule rejected the operation because of the record's current state (mapped to 409).</summary>
public sealed class DomainConflictException(string code, string message) : DomainException(code, message);
