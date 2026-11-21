using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Courier;
using Lamma.Application.Finance;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Courier;
using Lamma.Domain.Expenses;
using Lamma.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class CourierSettlementConfiguration : IEntityTypeConfiguration<CourierSettlement>
{
    public void Configure(EntityTypeBuilder<CourierSettlement> builder)
    {
        builder.ToTable("CourierSettlements", t =>
        {
            t.HasCheckConstraint("CK_CourierSettlements_Expected", "[ExpectedAmount] > 0");
            t.HasCheckConstraint("CK_CourierSettlements_Received", "[ReceivedAmount] >= 0 AND [ReceivedAmount] <= [ExpectedAmount]");
            t.HasCheckConstraint("CK_CourierSettlements_Difference", "[Difference] = [ExpectedAmount] - [ReceivedAmount]");
        });
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Note).HasMaxLength(CourierSettlement.NoteMaxLength);
        builder.Property(s => s.ReversalReason).HasMaxLength(CourierSettlement.NoteMaxLength);
        builder.Ignore(s => s.IsReversed);

        builder.HasIndex(s => new { s.BusinessId, s.OperationId }).IsUnique();
        builder.HasIndex(s => new { s.BusinessId, s.SettledOn });
        builder.HasOne<Business>().WithMany().HasForeignKey(s => s.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(s => s.Orders).WithOne().HasForeignKey(o => o.SettlementId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Orders).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class CourierSettlementOrderConfiguration : IEntityTypeConfiguration<CourierSettlementOrder>
{
    public void Configure(EntityTypeBuilder<CourierSettlementOrder> builder)
    {
        builder.ToTable("CourierSettlementOrders", t => t.HasCheckConstraint("CK_CourierSettlementOrders_Expected", "[ExpectedAmount] > 0"));
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();

        // An order is in at most one active settlement (D-141); reversed lines free it again.
        builder.HasIndex(o => o.OrderId).IsUnique().HasFilter("[IsReversed] = 0");
        builder.HasOne<Order>().WithMany().HasForeignKey(o => o.OrderId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class CourierRepository(LammaDbContext db, ICurrentBusiness currentBusiness) : ICourierRepository
{
    public void Add(CourierSettlement settlement) => db.CourierSettlements.Add(settlement);

    public async Task<CourierSettlement?> LockForUpdateAsync(Guid id, CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Settlement locks are taken inside the writing transaction.");
        }

        var businessId = currentBusiness.BusinessId;
        var locked = await db.Database.ExecuteSqlAsync(
            $"UPDATE [CourierSettlements] SET [RecordedAt] = [RecordedAt] WHERE [Id] = {id} AND [BusinessId] = {businessId}",
            cancellationToken);
        return locked == 0 ? null : await db.CourierSettlements.Include(s => s.Orders).FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }
}

internal sealed class CourierQueries(LammaDbContext db) : ICourierQueries
{
    public async Task<CourierOverviewDto> OverviewAsync(string companyName, DateOnly monthStart, CancellationToken cancellationToken)
    {
        // D-140: delivered COD orders with something left are waiting for the courier's transfer.
        var waiting = await CodOrders(OrderStatus.Delivered)
            .Join(db.Customers.AsNoTracking(), o => o.CustomerId, c => c.Id, (o, c) => new { o.Id, o.OrderNumber, o.CustomerId, c.Name, o.Total, o.Paid, o.DeliveredAt })
            .OrderBy(o => o.DeliveredAt).ThenBy(o => o.OrderNumber)
            .ToListAsync(cancellationToken);
        var onTheWay = await CodOrders(OrderStatus.Courier).Select(o => o.Total - o.Paid).ToListAsync(cancellationToken);
        var fees = await db.Expenses.AsNoTracking()
            .Where(e => e.VoidedAt == null && e.Source == ExpenseSource.CourierSettlement && e.SpentOn >= monthStart)
            .SumAsync(e => (decimal?)e.Amount, cancellationToken) ?? 0m;
        var lastId = await db.CourierSettlements.AsNoTracking()
            .Where(s => s.ReversedAt == null)
            .OrderByDescending(s => s.SettledOn).ThenByDescending(s => s.RecordedAt)
            .Select(s => (Guid?)s.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var rows = waiting.Select(o => new HeldOrderDto(o.Id, o.OrderNumber, o.CustomerId, o.Name, o.Total, o.Paid, o.Total - o.Paid, o.DeliveredAt!.Value)).ToList();
        return new CourierOverviewDto(
            companyName,
            rows.Sum(r => r.Remaining),
            rows.Count,
            onTheWay.Sum(),
            onTheWay.Count,
            fees,
            lastId is { } id ? await GetAsync(id, cancellationToken) : null,
            rows);
    }

    public async Task<PagedResult<SettlementDto>> ListAsync(SettlementListQuery query, CancellationToken cancellationToken)
    {
        var settlements = db.CourierSettlements.AsNoTracking();
        var total = await settlements.CountAsync(cancellationToken);
        var ids = await settlements
            .OrderByDescending(s => s.SettledOn).ThenByDescending(s => s.RecordedAt)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);
        return new PagedResult<SettlementDto>(await ToDtosAsync(ids, cancellationToken), query.Page, query.PageSize, total);
    }

    public async Task<SettlementDto?> GetAsync(Guid id, CancellationToken cancellationToken)
        => (await ToDtosAsync([id], cancellationToken)).FirstOrDefault();

    /// <summary>COD orders in <paramref name="status"/> with something still due (paid = Σ active allocations).</summary>
    private IQueryable<CodRow> CodOrders(OrderStatus status)
        => db.Orders.AsNoTracking()
            .Where(o => o.Status == status && o.PaymentMethodHint == PaymentMethod.Cod)
            .Select(o => new CodRow
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                CustomerId = o.CustomerId,
                Total = o.Total,
                Paid = db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m,
                DeliveredAt = o.DeliveredAt,
            })
            .Where(o => o.Total - o.Paid > 0);

    /// <summary>Settlement DTOs in the order of <paramref name="ids"/>, with their orders and difference expense.</summary>
    private async Task<List<SettlementDto>> ToDtosAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken)
    {
        var list = ids.ToList();
        var settlements = await db.CourierSettlements.AsNoTracking().Where(s => list.Contains(s.Id)).ToListAsync(cancellationToken);
        var lines = await db.CourierSettlementOrders.AsNoTracking()
            .Where(l => list.Contains(l.SettlementId))
            .Join(db.Orders.AsNoTracking(), l => l.OrderId, o => o.Id, (l, o) => new { l.SettlementId, l.OrderId, o.OrderNumber, o.CustomerId, l.ExpectedAmount })
            .Join(db.Customers.AsNoTracking(), x => x.CustomerId, c => c.Id, (x, c) => new { x.SettlementId, x.OrderId, x.OrderNumber, c.Name, x.ExpectedAmount })
            .ToListAsync(cancellationToken);
        var expenses = await db.Expenses.AsNoTracking()
            .Where(e => e.SettlementId != null && list.Contains(e.SettlementId.Value))
            .Select(e => new { SettlementId = e.SettlementId!.Value, e.Id })
            .ToDictionaryAsync(e => e.SettlementId, e => e.Id, cancellationToken);

        return list
            .Select(id => settlements.FirstOrDefault(s => s.Id == id))
            .Where(s => s is not null)
            .Select(s => new SettlementDto(
                s!.Id, s.SettledOn, s.ExpectedAmount, s.ReceivedAmount, s.Difference, s.Note, s.RecordedAt, s.ReversedAt is not null, s.ReversedAt, s.ReversalReason,
                expenses.TryGetValue(s.Id, out var expenseId) ? expenseId : null,
                lines.Where(l => l.SettlementId == s.Id).OrderBy(l => l.OrderNumber).Select(l => new SettlementOrderDto(l.OrderId, l.OrderNumber, l.Name, l.ExpectedAmount)).ToList()))
            .ToList();
    }

    private sealed class CodRow
    {
        public Guid Id { get; init; }

        public int OrderNumber { get; init; }

        public Guid CustomerId { get; init; }

        public decimal Total { get; init; }

        public decimal Paid { get; init; }

        public DateTime? DeliveredAt { get; init; }
    }
}

/// <summary>Finance overview (D-144): period figures from orders, items, payments, settlements and expenses; snapshot from receivables.</summary>
internal sealed class FinanceQueries(LammaDbContext db, IPaymentQueries payments) : IFinanceQueries
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<FinanceOverviewDto> OverviewAsync(DateOnly from, DateOnly to, DateOnly today, CancellationToken cancellationToken)
    {
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(from.ToDateTime(TimeOnly.MinValue), Zone);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(to.AddDays(1).ToDateTime(TimeOnly.MinValue), Zone);

        // D-030: revenue is recognised on delivery.
        var delivered = db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Delivered && o.DeliveredAt >= startUtc && o.DeliveredAt < endUtc);
        var sales = await delivered.SumAsync(o => (decimal?)o.Total, cancellationToken) ?? 0m;
        var deliveredCount = await delivered.CountAsync(cancellationToken);
        var cogs = MoneyMath.Round(await db.OrderItems.AsNoTracking()
            .Where(i => delivered.Any(o => o.Id == i.OrderId))
            .SumAsync(i => (decimal?)(i.Quantity * i.UnitCost), cancellationToken) ?? 0m);

        var expenses = db.Expenses.AsNoTracking().Where(e => e.VoidedAt == null && e.SpentOn >= from && e.SpentOn <= to);
        var byCategory = await expenses
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Amount = g.Sum(e => e.Amount) })
            .Join(db.ExpenseCategories.AsNoTracking(), g => g.CategoryId, c => c.Id, (g, c) => new { g.CategoryId, c.Name, c.Code, g.Amount })
            .ToListAsync(cancellationToken);
        var expenseTotal = byCategory.Sum(c => c.Amount);
        var cashOut = await expenses.Where(e => e.Source == ExpenseSource.Manual).SumAsync(e => (decimal?)e.Amount, cancellationToken) ?? 0m;

        // Cash in: manual payments by their date + what the courier actually transferred (D-144).
        var manualIn = await db.Payments.AsNoTracking()
            .Where(p => p.ReversedAt == null && p.SettlementId == null && p.PaidOn >= from && p.PaidOn <= to)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;
        var settledIn = await db.CourierSettlements.AsNoTracking()
            .Where(s => s.ReversedAt == null && s.SettledOn >= from && s.SettledOn <= to)
            .SumAsync(s => (decimal?)s.ReceivedAmount, cancellationToken) ?? 0m;
        var expected = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Preparing || o.Status == OrderStatus.Courier)
            .SumAsync(o => (decimal?)o.Total, cancellationToken) ?? 0m;
        var aging = await payments.AgingAsync(today, cancellationToken);

        var gross = sales - cogs;
        var cashIn = manualIn + settledIn;
        return new FinanceOverviewDto(
            from,
            to,
            sales,
            deliveredCount,
            cogs,
            gross,
            expenseTotal,
            gross - expenseTotal,
            cashIn,
            cashOut,
            cashIn - cashOut,
            aging.Total,
            aging.CourierHeld,
            expected,
            byCategory.OrderByDescending(c => c.Amount).ThenBy(c => c.Name).Select(c => new ExpenseShareDto(c.CategoryId, c.Name, c.Code?.ToCode(), c.Amount)).ToList());
    }
}
