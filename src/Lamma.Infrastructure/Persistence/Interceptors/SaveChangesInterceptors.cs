using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Lamma.Infrastructure.Persistence.Interceptors;

/// <summary>Sets CreatedAt/UpdatedAt (UTC, from <see cref="IClock"/>) on <see cref="IHasTimestamps"/> entities.</summary>
public sealed class TimestampsInterceptor(IClock clock) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Stamp(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Stamp(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private void Stamp(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var now = clock.UtcNow;
        foreach (var entry in context.ChangeTracker.Entries<IHasTimestamps>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(nameof(IHasTimestamps.CreatedAt)).CurrentValue = now;
                entry.Property(nameof(IHasTimestamps.UpdatedAt)).CurrentValue = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(nameof(IHasTimestamps.UpdatedAt)).CurrentValue = now;
            }
        }
    }
}

/// <summary>Raised when a write would touch another business's data. Never expected in correct code.</summary>
public sealed class CrossTenantWriteException(string message) : InvalidOperationException(message);

/// <summary>
/// Write-side tenant guard (MASTER-ARCHITECTURE §6.3, layer 3):
/// stamps BusinessId on new business-owned rows and rejects any write that crosses the current business.
/// </summary>
public sealed class TenancyInterceptor(TenantContext tenant) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Guard(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Guard(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private void Guard(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        // Onboarding creates a business and its rows before the user has a business context.
        var businessesBeingCreated = context.ChangeTracker.Entries<Business>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity.Id)
            .ToHashSet();

        var current = tenant.ResolvedBusinessId;
        foreach (var entry in context.ChangeTracker.Entries<IBusinessOwned>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    GuardAdded(entry, current, businessesBeingCreated);
                    break;
                case EntityState.Modified:
                case EntityState.Deleted:
                    var original = (Guid)entry.Property(nameof(IBusinessOwned.BusinessId)).OriginalValue!;
                    var now = entry.Entity.BusinessId;
                    if (current is null || original != current || now != current)
                    {
                        throw new CrossTenantWriteException($"Cross-tenant {entry.State} of {entry.Metadata.ClrType.Name} rejected.");
                    }

                    break;
            }
        }
    }

    private static void GuardAdded(EntityEntry<IBusinessOwned> entry, Guid? current, HashSet<Guid> businessesBeingCreated)
    {
        var property = entry.Property(nameof(IBusinessOwned.BusinessId));
        var businessId = (Guid)property.CurrentValue!;

        if (businessId == Guid.Empty)
        {
            property.CurrentValue = current ?? throw new CrossTenantWriteException(
                $"Cannot add {entry.Metadata.ClrType.Name} without a current business.");
            return;
        }

        if (businessId == current || businessesBeingCreated.Contains(businessId))
        {
            return;
        }

        throw new CrossTenantWriteException($"Adding {entry.Metadata.ClrType.Name} for another business was rejected.");
    }
}
