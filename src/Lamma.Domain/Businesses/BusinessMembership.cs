using Lamma.Domain.Common;

namespace Lamma.Domain.Businesses;

/// <summary>
/// Links a user to a business (D-079). V1: unique per user, role Owner only.
/// The user itself lives in Identity (Infrastructure); the domain only keeps its id.
/// </summary>
public sealed class BusinessMembership : Entity
{
    private BusinessMembership(Guid id, Guid userId, Guid businessId, MembershipRole role, DateTime createdAt)
        : base(id)
    {
        Guard.NotEmpty(userId, nameof(userId));
        Guard.NotEmpty(businessId, nameof(businessId));
        UserId = userId;
        BusinessId = businessId;
        Role = role;
        CreatedAt = createdAt;
    }

    private BusinessMembership()
    {
    }

    public Guid UserId { get; private set; }

    public Guid BusinessId { get; private set; }

    public MembershipRole Role { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public static BusinessMembership CreateOwner(Guid userId, Guid businessId, DateTime nowUtc)
        => new(NewId(), userId, businessId, MembershipRole.Owner, nowUtc);
}
