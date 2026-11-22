using Lamma.Application.Admin;
using Lamma.Application.Subscriptions;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Platform;
using Lamma.Domain.Signup;
using Lamma.Domain.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

// Billing and platform records (Phase 11-II). They carry a BusinessId but are NOT tenant-filtered: the platform admin
// writes them for any business. Owner-side code always filters them explicitly by the current business.

internal sealed class SubscriptionPeriodConfiguration : IEntityTypeConfiguration<SubscriptionPeriod>
{
    public void Configure(EntityTypeBuilder<SubscriptionPeriod> builder)
    {
        builder.ToTable("SubscriptionPeriods");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.CliqReference).HasMaxLength(SubscriptionPeriod.ReferenceMaxLength);
        builder.Property(p => p.Note).HasMaxLength(SubscriptionPeriod.NoteMaxLength);
        builder.Ignore(p => p.IsActive);
        builder.HasIndex(p => new { p.BusinessId, p.StartsOn });
        builder.HasOne<Business>().WithMany().HasForeignKey(p => p.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(t => t.HasCheckConstraint("CK_SubscriptionPeriods_Dates", "[EndsOn] >= [StartsOn]"));
    }
}

internal sealed class PaymentRequestConfiguration : IEntityTypeConfiguration<PaymentRequest>
{
    public const string OnePendingIndex = "UX_PaymentRequests_BusinessId_Pending";

    public void Configure(EntityTypeBuilder<PaymentRequest> builder)
    {
        builder.ToTable("PaymentRequests");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.ProofPath).HasMaxLength(260).IsRequired();
        builder.Property(r => r.ProofContentType).HasMaxLength(64).IsUnicode(false).IsRequired();
        builder.Property(r => r.RejectReason).HasMaxLength(PaymentRequest.ReasonMaxLength);
        builder.HasIndex(r => new { r.Status, r.SubmittedAt });
        // At most one pending request per business (D-178), also under concurrency.
        builder.HasIndex(r => r.BusinessId).IsUnique().HasFilter("[Status] = 'pending'").HasDatabaseName(OnePendingIndex);
        builder.HasOne<Business>().WithMany().HasForeignKey(r => r.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AdminAuditLogConfiguration : IEntityTypeConfiguration<AdminAuditLog>
{
    public void Configure(EntityTypeBuilder<AdminAuditLog> builder)
    {
        builder.ToTable("AdminAuditLogs");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Action).HasMaxLength(AdminAuditLog.ActionMaxLength).IsUnicode(false).IsRequired();
        builder.Property(a => a.Details).HasMaxLength(AdminAuditLog.DetailsMaxLength);
        builder.HasIndex(a => new { a.BusinessId, a.At });
        builder.HasIndex(a => a.RequestKey).IsUnique().HasFilter("[RequestKey] IS NOT NULL").HasDatabaseName("UX_AdminAuditLogs_RequestKey");
    }
}

internal sealed class ReminderLogConfiguration : IEntityTypeConfiguration<ReminderLog>
{
    public void Configure(EntityTypeBuilder<ReminderLog> builder)
    {
        builder.ToTable("ReminderLogs");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Kind).HasMaxLength(ReminderLog.KindMaxLength).IsUnicode(false).IsRequired();
        builder.HasIndex(r => new { r.BusinessId, r.Kind, r.TargetDate }).IsUnique();
    }
}

internal sealed class SubscriptionRepository(LammaDbContext db) : ISubscriptionRepository
{
    public Task<Business?> GetBusinessAsync(Guid businessId, CancellationToken cancellationToken)
        => db.Businesses.FirstOrDefaultAsync(b => b.Id == businessId, cancellationToken);

    public async Task<IReadOnlyList<SubscriptionPeriod>> GetPeriodsAsync(Guid businessId, CancellationToken cancellationToken)
        => await db.SubscriptionPeriods.Where(p => p.BusinessId == businessId).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PaymentRequest>> GetRequestsAsync(Guid businessId, CancellationToken cancellationToken)
        => await db.PaymentRequests.Where(r => r.BusinessId == businessId).OrderByDescending(r => r.SubmittedAt).ToListAsync(cancellationToken);

    public Task<PaymentRequest?> GetRequestAsync(Guid id, CancellationToken cancellationToken)
        => db.PaymentRequests.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<int> NextReferenceNumberAsync(CancellationToken cancellationToken)
        => Math.Max(Business.FirstReferenceNumber, (await db.Businesses.MaxAsync(b => b.ReferenceNumber, cancellationToken) ?? Business.FirstReferenceNumber - 1) + 1);

    public void Add(SubscriptionPeriod period) => db.SubscriptionPeriods.Add(period);

    public void Add(PaymentRequest request) => db.PaymentRequests.Add(request);
}

internal sealed class AdminRepository(LammaDbContext db) : IAdminRepository
{
    public Task<Business?> GetBusinessAsync(Guid businessId, CancellationToken cancellationToken)
        => db.Businesses.FirstOrDefaultAsync(b => b.Id == businessId, cancellationToken);

    public async Task<SubscriptionPeriod?> GetCurrentPeriodAsync(Guid businessId, DateOnly today, CancellationToken cancellationToken)
    {
        var periods = await db.SubscriptionPeriods.Where(p => p.BusinessId == businessId && p.CancelledAt == null && p.EndsOn >= today).ToListAsync(cancellationToken);
        return periods.Where(p => p.StartsOn <= today).OrderByDescending(p => p.StartsOn).FirstOrDefault()
               ?? periods.OrderByDescending(p => p.StartsOn).FirstOrDefault();
    }

    public void Add(SubscriptionPeriod period) => db.SubscriptionPeriods.Add(period);

    public void Add(AdminAuditLog entry) => db.AdminAuditLogs.Add(entry);

    public Task<bool> RequestKeyUsedAsync(Guid key, CancellationToken cancellationToken)
        => db.AdminAuditLogs.AnyAsync(a => a.RequestKey == key, cancellationToken);

    public void Reset() => db.ChangeTracker.Clear();
}

internal sealed class ReminderRepository(LammaDbContext db) : IReminderRepository
{
    public Task<bool> ExistsAsync(Guid businessId, string kind, DateOnly targetDate, CancellationToken cancellationToken)
        => db.ReminderLogs.AnyAsync(r => r.BusinessId == businessId && r.Kind == kind && r.TargetDate == targetDate, cancellationToken);

    public void Add(ReminderLog log) => db.ReminderLogs.Add(log);

    public void Forget(ReminderLog log) => db.Entry(log).State = EntityState.Detached;
}

/// <summary>
/// The admin's read side (P-025): businesses with their owner, billing rows and counts only. Order and product counts
/// read tenant-owned tables, so they ignore the tenant filter and filter by the business explicitly.
/// </summary>
internal sealed class AdminQueries(LammaDbContext db) : IAdminQueries
{
    public async Task<IReadOnlyList<AdminBusinessRow>> BusinessesAsync(Guid? businessId, CancellationToken cancellationToken)
    {
        var rows = await (from b in db.Businesses.AsNoTracking()
                          where businessId == null || b.Id == businessId
                          join m in db.Memberships.AsNoTracking() on b.Id equals m.BusinessId
                          join u in db.Users.AsNoTracking() on m.UserId equals u.Id
                          select new
                          {
                              b.Id, b.Name, b.BusinessType, b.TimeZoneId, b.TrialStartsAt, b.TrialEndsAt, b.SuspendedAt, b.SuspendReason,
                              b.ReferenceNumber, b.CreatedAt, u.FullName, u.Email, u.PhoneNumber, u.LastLoginAt,
                          })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new AdminBusinessRow(
                r.Id, r.Name, r.BusinessType.ToCode(), r.TimeZoneId, r.TrialStartsAt, r.TrialEndsAt, r.SuspendedAt, r.SuspendReason,
                r.ReferenceNumber is { } n ? Business.FormatReference(n) : null, r.CreatedAt, r.FullName, r.Email ?? string.Empty, r.PhoneNumber, r.LastLoginAt))
            .ToList();
    }

    public async Task<IReadOnlyList<SubscriptionPeriod>> PeriodsAsync(Guid? businessId, CancellationToken cancellationToken)
        => await db.SubscriptionPeriods.AsNoTracking().Where(p => businessId == null || p.BusinessId == businessId).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PaymentRequest>> PaymentRequestsAsync(Guid? businessId, PaymentRequestStatus? status, CancellationToken cancellationToken)
        => await db.PaymentRequests.AsNoTracking()
            .Where(r => (businessId == null || r.BusinessId == businessId) && (status == null || r.Status == status))
            .ToListAsync(cancellationToken);

    public async Task<(int Orders, int Products)> CountsAsync(Guid businessId, CancellationToken cancellationToken)
    {
        var orders = await db.Orders.IgnoreQueryFilters().AsNoTracking().CountAsync(o => o.BusinessId == businessId, cancellationToken);
        var products = await db.Products.IgnoreQueryFilters().AsNoTracking().CountAsync(p => p.BusinessId == businessId && !p.IsArchived, cancellationToken);
        return (orders, products);
    }

    public async Task<IReadOnlyList<AdminAuditLog>> AuditAsync(Guid businessId, int take, CancellationToken cancellationToken)
        => await db.AdminAuditLogs.AsNoTracking().Where(a => a.BusinessId == businessId).OrderByDescending(a => a.At).Take(take).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<SignupLead>> LeadsAsync(CancellationToken cancellationToken)
        => await db.SignupLeads.AsNoTracking().ToListAsync(cancellationToken);
}
