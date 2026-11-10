using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class BusinessRepository(LammaDbContext db) : IBusinessRepository
{
    public Task<Business?> GetForUpdateAsync(Guid businessId, CancellationToken cancellationToken)
        => db.Businesses
            .Include(b => b.SalesChannels)
            .Include(b => b.PaymentMethods)
            .AsSplitQuery()
            .FirstOrDefaultAsync(b => b.Id == businessId, cancellationToken);

    public void Add(Business business) => db.Businesses.Add(business);
}

internal sealed class MembershipRepository(LammaDbContext db) : IMembershipRepository
{
    public Task<bool> ExistsForUserAsync(Guid userId, CancellationToken cancellationToken)
        => db.Memberships.AsNoTracking().AnyAsync(m => m.UserId == userId, cancellationToken);

    public void Add(BusinessMembership membership) => db.Memberships.Add(membership);
}

internal sealed class AccountQueries(LammaDbContext db) : IAccountQueries
{
    public Task<BusinessSummaryRow?> GetBusinessSummaryForUserAsync(Guid userId, CancellationToken cancellationToken)
        => (from m in db.Memberships.AsNoTracking()
            where m.UserId == userId
            join b in db.Businesses.AsNoTracking() on m.BusinessId equals b.Id
            select new BusinessSummaryRow(b.Id, b.Name, b.BusinessType, b.TrialEndsAt, b.TimeZoneId, b.SubscriptionPlan))
            .FirstOrDefaultAsync(cancellationToken);
}

internal sealed class BusinessSettingsQueries(LammaDbContext db) : IBusinessSettingsQueries
{
    public async Task<BusinessSettingsDto?> GetProfileAsync(Guid businessId, CancellationToken cancellationToken)
    {
        var row = await db.Businesses.AsNoTracking()
            .Where(b => b.Id == businessId)
            .Select(b => new { b.Name, b.BusinessType, b.DefaultLowStockThreshold, b.Currency })
            .FirstOrDefaultAsync(cancellationToken);

        return row is null ? null : new BusinessSettingsDto(row.Name, row.BusinessType.ToCode(), row.DefaultLowStockThreshold, row.Currency);
    }

    // The tenant query filter also applies here; the explicit BusinessId predicate keeps the intent visible.
    public async Task<IReadOnlyList<SettingFlagRow<SalesChannel>>> GetSalesChannelsAsync(Guid businessId, CancellationToken cancellationToken)
        => await db.BusinessSalesChannels.AsNoTracking()
            .Where(c => c.BusinessId == businessId)
            .Select(c => new SettingFlagRow<SalesChannel>(c.Channel, c.IsEnabled))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<SettingFlagRow<PaymentMethod>>> GetPaymentMethodsAsync(Guid businessId, CancellationToken cancellationToken)
        => await db.BusinessPaymentMethods.AsNoTracking()
            .Where(m => m.BusinessId == businessId)
            .Select(m => new SettingFlagRow<PaymentMethod>(m.Method, m.IsEnabled))
            .ToListAsync(cancellationToken);
}
