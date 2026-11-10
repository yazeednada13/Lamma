namespace Lamma.Domain.Common;

/// <summary>CreatedAt / UpdatedAt (UTC) are maintained by persistence, never by callers.</summary>
public interface IHasTimestamps
{
    DateTime CreatedAt { get; }

    DateTime UpdatedAt { get; }
}
