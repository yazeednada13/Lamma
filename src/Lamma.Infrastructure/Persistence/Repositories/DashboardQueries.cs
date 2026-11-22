using Lamma.Application.Common;
using Lamma.Application.Dashboard;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Expenses;
using Lamma.Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Persistence.Repositories;

/// <summary>
/// The non-money part of «لمّة اليوم» (D-153–D-158), read with SQL projections; per-day and per-weekday groupings are
/// done in memory over bounded rows (14 and 90 days) because they need the business-local date (Asia/Amman).
/// </summary>
internal sealed class DashboardQueries(LammaDbContext db, IPaymentQueries payments, ICurrentBusiness currentBusiness) : IDashboardQueries
{
    private const int InsightDays = 90;
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<DashboardActivityData> ActivityAsync(DateOnly today, DateOnly monthStart, DateOnly seriesFrom, CancellationToken cancellationToken)
    {
        var monthStartUtc = StartUtc(monthStart);
        var tomorrowUtc = StartUtc(today.AddDays(1));

        // Journey (D-154): open orders by stage now.
        var byStatus = (await db.Orders.AsNoTracking().GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count(), Value = g.Sum(o => o.Total) }).ToListAsync(cancellationToken))
            .ToDictionary(x => x.Key);
        int Count(OrderStatus s) => byStatus.GetValueOrDefault(s)?.Count ?? 0;
        decimal Value(OrderStatus s) => byStatus.GetValueOrDefault(s)?.Value ?? 0m;
        var open = new[] { OrderStatus.New, OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Courier };

        var stock = await db.Products.AsNoTracking()
            .Where(p => !p.IsArchived)
            .Select(p => new { p.Id, p.Name, p.LowStockThreshold, Available = p.Variants.Where(v => !v.IsArchived).Sum(v => v.OnHand - v.Reserved) })
            .ToListAsync(cancellationToken);
        var low = stock.Where(p => p.Available <= p.LowStockThreshold).OrderBy(p => p.Available).ThenBy(p => p.Name).ToList();

        var delivered = db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Returned);
        var deliveredThisMonth = await delivered.CountAsync(o => o.DeliveredAt >= monthStartUtc && o.DeliveredAt < tomorrowUtc, cancellationToken);
        var activeCustomers = await db.Orders.AsNoTracking()
            .Where(o => o.Status != OrderStatus.Cancelled && o.CreatedAt >= monthStartUtc && o.CreatedAt < tomorrowUtc)
            .Select(o => o.CustomerId).Distinct().CountAsync(cancellationToken);

        var channels = await ChannelsAsync(monthStartUtc, tomorrowUtc, cancellationToken);
        var topProducts = await TopProductsAsync(monthStartUtc, tomorrowUtc, cancellationToken);
        var journey = new JourneyDto(stock.Count, low.Count, Count(OrderStatus.New), Count(OrderStatus.Confirmed) + Count(OrderStatus.Preparing), Count(OrderStatus.Courier), deliveredThisMonth, activeCustomers);

        return new DashboardActivityData(
            journey,
            open.Sum(Count),
            open.Sum(Value),
            await SeriesAsync(seriesFrom, today, cancellationToken),
            await AttentionAsync(today, low.Take(2).Select(p => (p.Id, p.Name, p.Available, p.LowStockThreshold)).ToList(), cancellationToken),
            channels,
            topProducts,
            await LatestOrdersAsync(cancellationToken),
            await ActivityFeedAsync(cancellationToken),
            await InsightAsync(today, tomorrowUtc, channels, topProducts, cancellationToken),
            stock.Count == 0 && byStatus.Count == 0);
    }

    public async Task<DashboardIndicatorsDto> IndicatorsAsync(CancellationToken cancellationToken)
    {
        var newOrders = await db.Orders.AsNoTracking().CountAsync(o => o.Status == OrderStatus.New, cancellationToken);
        var lowStock = await db.Products.AsNoTracking()
            .Where(p => !p.IsArchived)
            .CountAsync(p => p.Variants.Where(v => !v.IsArchived).Sum(v => v.OnHand - v.Reserved) <= p.LowStockThreshold, cancellationToken);
        var hasDues = await Receivables().AnyAsync(cancellationToken);
        return new DashboardIndicatorsDto(newOrders, lowStock, hasDues);
    }

    public async Task<DateTime?> TrialEndsAtAsync(CancellationToken cancellationToken)
    {
        var businessId = currentBusiness.BusinessId;
        return await db.Businesses.AsNoTracking().Where(b => b.Id == businessId).Select(b => (DateTime?)b.TrialEndsAt).FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// 14 days by delivery date (D-153): sales = Σ totals delivered that day − returns booked that day; gross profit =
    /// sales − (items cost − restocked cost), the finance-overview formulas per day (D-149).
    /// </summary>
    private async Task<IReadOnlyList<SeriesDayDto>> SeriesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var fromUtc = StartUtc(from);
        var toUtc = StartUtc(to.AddDays(1));
        var sold = await db.Orders.AsNoTracking()
            .Where(o => (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Returned) && o.DeliveredAt >= fromUtc && o.DeliveredAt < toUtc)
            .Select(o => new { At = o.DeliveredAt!.Value, o.Total, Cost = db.OrderItems.Where(i => i.OrderId == o.Id).Sum(i => (decimal?)(i.Quantity * i.UnitCost)) ?? 0m })
            .ToListAsync(cancellationToken);
        var returns = await db.OrderReturns.AsNoTracking()
            .Where(r => r.ReturnedOn >= from && r.ReturnedOn <= to)
            .Select(r => new
            {
                r.ReturnedOn,
                r.Amount,
                Restocked = r.Lines.Where(l => l.Restocked).Sum(l => (decimal?)(l.Quantity * db.OrderItems.Where(i => i.Id == l.OrderItemId).Select(i => i.UnitCost).FirstOrDefault())) ?? 0m,
            })
            .ToListAsync(cancellationToken);

        var days = new List<SeriesDayDto>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var d = day;
            var orders = sold.Where(o => BusinessTime.LocalDate(o.At, Zone) == d).ToList();
            var dayReturns = returns.Where(r => r.ReturnedOn == d).ToList();
            var sales = orders.Sum(o => o.Total) - dayReturns.Sum(r => r.Amount);
            var cogs = MoneyMath.Round(orders.Sum(o => o.Cost)) - MoneyMath.Round(dayReturns.Sum(r => r.Restocked));
            days.Add(new SeriesDayDto(d, sales, sales - cogs));
        }

        return days;
    }

    /// <summary>«يحتاج انتباهك» in the D-157 order: prepare, confirm, up to 2 stock items, courier money, top debtor.</summary>
    private async Task<IReadOnlyList<AttentionDto>> AttentionAsync(DateOnly today, IReadOnlyList<(Guid Id, string Name, int Available, int Threshold)> lowStock, CancellationToken cancellationToken)
    {
        var items = new List<AttentionDto>();
        var preparing = db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Preparing);
        var preparingCount = await preparing.CountAsync(cancellationToken);
        if (preparingCount > 0)
        {
            var oldest = await preparing.OrderBy(o => o.CreatedAt).Select(o => new { o.Id, o.OrderNumber, o.CreatedAt }).FirstAsync(cancellationToken);
            items.Add(new AttentionDto("prepare", "high", preparingCount, null, oldest.Id, null, oldest.OrderNumber, oldest.CreatedAt, null, null));
        }

        var newCount = await db.Orders.AsNoTracking().CountAsync(o => o.Status == OrderStatus.New, cancellationToken);
        if (newCount > 0)
        {
            items.Add(new AttentionDto("confirm", "mid", newCount, null, null, null, null, null, null, null));
        }

        items.AddRange(lowStock.Select(p => new AttentionDto("low_stock", p.Available <= 0 ? "high" : "mid", null, null, p.Id, p.Name, null, null, Math.Max(p.Available, 0), p.Threshold)));

        var aging = await payments.AgingAsync(today, cancellationToken);
        if (aging.CourierHeld > 0)
        {
            items.Add(new AttentionDto("courier", "low", aging.CourierHeldCount, aging.CourierHeld, null, null, null, null, null, null));
        }

        var debtor = (await Receivables().Select(r => new { r.CustomerId, r.Remaining }).ToListAsync(cancellationToken))
            .GroupBy(r => r.CustomerId)
            .Select(g => new { CustomerId = g.Key, Balance = g.Sum(r => r.Remaining) })
            .OrderByDescending(g => g.Balance)
            .FirstOrDefault();
        if (debtor is not null)
        {
            var name = await db.Customers.AsNoTracking().Where(c => c.Id == debtor.CustomerId).Select(c => c.Name).FirstAsync(cancellationToken);
            items.Add(new AttentionDto("due", "low", null, debtor.Balance, debtor.CustomerId, name, null, null, null, null));
        }

        return items;
    }

    private async Task<IReadOnlyList<ChannelShareDto>> ChannelsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
        => (await DeliveredBetween(fromUtc, toUtc).GroupBy(o => o.Channel).Select(g => new { g.Key, Amount = g.Sum(o => o.Total) }).ToListAsync(cancellationToken))
            .OrderByDescending(x => x.Amount)
            .Select(x => new ChannelShareDto(x.Key.ToCode(), x.Amount))
            .ToList();

    private async Task<IReadOnlyList<TopProductDto>> TopProductsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        var orders = DeliveredBetween(fromUtc, toUtc);
        var rows = await db.OrderItems.AsNoTracking()
            .Where(i => orders.Any(o => o.Id == i.OrderId))
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Name = g.Max(i => i.ProductName), Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .OrderByDescending(x => x.Revenue).ThenByDescending(x => x.Quantity)
            .Take(4)
            .ToListAsync(cancellationToken);
        return rows.Select(r => new TopProductDto(r.ProductId, r.Name ?? string.Empty, r.Quantity, r.Revenue)).ToList();
    }

    private async Task<IReadOnlyList<LatestOrderDto>> LatestOrdersAsync(CancellationToken cancellationToken)
        => await db.Orders.AsNoTracking()
            .Where(o => o.Status != OrderStatus.Cancelled)
            .OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.OrderNumber)
            .Take(4)
            .Join(db.Customers.AsNoTracking(), o => o.CustomerId, c => c.Id, (o, c) => new { o.Id, o.OrderNumber, c.Name, o.Status, o.Total, o.CreatedAt })
            .Select(o => new LatestOrderDto(o.Id, o.OrderNumber, o.Name, o.Status.ToCode(), o.Total, o.CreatedAt))
            .ToListAsync(cancellationToken);

    /// <summary>The latest 5 events: new orders, stock receipts / adjustments / returns, and manual expenses.</summary>
    private async Task<IReadOnlyList<ActivityDto>> ActivityFeedAsync(CancellationToken cancellationToken)
    {
        var orders = await db.Orders.AsNoTracking()
            .OrderByDescending(o => o.CreatedAt).Take(5)
            .Join(db.Customers.AsNoTracking(), o => o.CustomerId, c => c.Id, (o, c) => new { o.CreatedAt, o.OrderNumber, c.Name, o.Total })
            .ToListAsync(cancellationToken);
        var kinds = new[] { StockMovementType.Receive, StockMovementType.Adjustment, StockMovementType.Return };
        var movements = await db.StockMovements.AsNoTracking()
            .Where(m => kinds.Contains(m.Type))
            .OrderByDescending(m => m.CreatedAt).Take(5)
            .Join(db.Products.AsNoTracking(), m => m.ProductId, p => p.Id, (m, p) => new { m.CreatedAt, m.Type, p.Name, m.OnHandDelta, m.ReferenceLabel })
            .ToListAsync(cancellationToken);
        var expenses = await db.Expenses.AsNoTracking()
            .Where(e => e.VoidedAt == null && e.Source == ExpenseSource.Manual)
            .OrderByDescending(e => e.RecordedAt).Take(5)
            .Join(db.ExpenseCategories.AsNoTracking(), e => e.CategoryId, c => c.Id, (e, c) => new { e.RecordedAt, c.Name, e.Note, e.Amount })
            .ToListAsync(cancellationToken);

        return orders.Select(o => new ActivityDto("order", o.CreatedAt, o.Name, o.OrderNumber, o.Total, null, null, null))
            .Concat(movements.Select(m => new ActivityDto("movement", m.CreatedAt, m.Name, null, null, m.Type.ToCode(), m.OnHandDelta, m.ReferenceLabel)))
            .Concat(expenses.Select(e => new ActivityDto("expense", e.RecordedAt, e.Name, null, e.Amount, null, null, e.Note)))
            .OrderByDescending(a => a.At)
            .Take(5)
            .ToList();
    }

    /// <summary>«ملاحظة لمّة» data (D-157): this month's top channel and product, and the best weekday over 90 days.</summary>
    private async Task<InsightDto> InsightAsync(DateOnly today, DateTime tomorrowUtc, IReadOnlyList<ChannelShareDto> channels, IReadOnlyList<TopProductDto> topProducts, CancellationToken cancellationToken)
    {
        var total = channels.Sum(c => c.Amount);
        var top = channels.FirstOrDefault();
        var product = topProducts.FirstOrDefault();
        var recent = await DeliveredBetween(StartUtc(today.AddDays(-(InsightDays - 1))), tomorrowUtc)
            .Select(o => new { At = o.DeliveredAt!.Value, o.Total })
            .ToListAsync(cancellationToken);
        var best = recent
            .GroupBy(o => (int)BusinessTime.LocalDate(o.At, Zone).DayOfWeek)
            .Select(g => new { Day = g.Key, Amount = g.Sum(o => o.Total) })
            .OrderByDescending(g => g.Amount)
            .FirstOrDefault();
        return new InsightDto(
            top?.Channel,
            top is null || total <= 0 ? null : (int)Math.Round(top.Amount / total * 100m, MidpointRounding.AwayFromZero),
            product?.Name,
            best?.Day);
    }

    private IQueryable<Order> DeliveredBetween(DateTime fromUtc, DateTime toUtc)
        => db.Orders.AsNoTracking().Where(o => (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Returned) && o.DeliveredAt >= fromUtc && o.DeliveredAt < toUtc);

    /// <summary>Customer receivables (D-134, net of returns): same predicate as <c>PaymentQueries.Receivables</c>.</summary>
    private IQueryable<ReceivableLite> Receivables()
        => db.Orders.AsNoTracking()
            .Where(o => (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Returned) && (o.PaymentMethodHint == null || o.PaymentMethodHint != PaymentMethod.Cod))
            .Select(o => new ReceivableLite
            {
                CustomerId = o.CustomerId,
                Remaining = o.Total - o.ReturnedAmount - (db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m),
            })
            .Where(r => r.Remaining > 0);

    private static DateTime StartUtc(DateOnly day) => TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), Zone);

    private sealed class ReceivableLite
    {
        public Guid CustomerId { get; init; }

        public decimal Remaining { get; init; }
    }
}
