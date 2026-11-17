using Lamma.Application.Common;
using Lamma.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Tenancy;

/// <summary>
/// Per-request holder of the resolved business (scoped). It has no dependencies, so the DbContext can use it
/// for query filters without a DI cycle. Unresolved = no business (safe default: filters match nothing).
/// </summary>
public sealed class TenantContext : ICurrentBusiness
{
    public bool IsResolved { get; private set; }

    public Guid? ResolvedBusinessId { get; private set; }

    public bool HasBusiness => ResolvedBusinessId.HasValue;

    public Guid BusinessId => ResolvedBusinessId
        ?? throw new ForbiddenException("business.not_onboarded", "لازم تكمّل تهيئة مشروعك أول.");

    public void Set(Guid? businessId)
    {
        ResolvedBusinessId = businessId;
        IsResolved = true;
    }
}

/// <summary>Looks up the current user's membership once per request (MASTER-ARCHITECTURE §6.2).</summary>
internal sealed class CurrentBusinessResolver(ICurrentUser currentUser, TenantContext tenant, LammaDbContext db) : ICurrentBusinessResolver
{
    public async Task ResolveAsync(CancellationToken cancellationToken)
    {
        if (tenant.IsResolved)
        {
            return;
        }

        if (currentUser.UserId is not { } userId)
        {
            tenant.Set(null);
            return;
        }

        var businessId = await db.Memberships
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => (Guid?)m.BusinessId)
            .FirstOrDefaultAsync(cancellationToken);

        tenant.Set(businessId);
    }
}
