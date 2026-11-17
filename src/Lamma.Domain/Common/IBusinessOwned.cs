namespace Lamma.Domain.Common;

/// <summary>
/// Marks a record that belongs to exactly one business (tenant).
/// Infrastructure applies a global query filter and a write guard to every implementer.
/// </summary>
public interface IBusinessOwned
{
    Guid BusinessId { get; }
}
