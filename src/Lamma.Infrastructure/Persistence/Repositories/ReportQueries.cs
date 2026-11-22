using Lamma.Application.Dashboard;
using Lamma.Application.Reports;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Persistence.Repositories;

/// <summary>
/// Reports (D-171, D-172). The rows of a span are read with SQL projections (orders delivered in it, their items, and
/// the returns recorded in it). Grouping by the business-local day and the discount and return shares are done in
/// memory, because they need the Asia/Amman date and exact remainders.
/// </summary>
internal sealed class ReportQueries(LammaDbContext db) : IReportQueries
{
    public const int RecentCustomers = 5;
    private const int ShareScale = 2; // shares are rounded like the D-148 discount share

    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<SalesData> SalesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var fromUtc = StartUtc(from);
        var toUtc = StartUtc(to.AddDays(1));

        // D-030: a sale counts on delivery; a returned order was still a sale in its delivery period (D-149).
        var deliveredQuery = db.Orders.AsNoTracking()
            .Where(o => (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Returned) && o.DeliveredAt >= fromUtc && o.DeliveredAt < toUtc);
        var orders = await deliveredQuery
            .Select(o => new { o.Id, At = o.DeliveredAt!.Value, o.Channel, o.Total, o.ItemsSubtotal, o.Discount, o.DeliveryFee })
            .ToListAsync(cancellationToken);
        var items = await db.OrderItems.AsNoTracking()
            .Where(i => deliveredQuery.Any(o => o.Id == i.OrderId))
            .Select(i => new { i.OrderId, i.Id, i.ProductId, i.ProductName, i.Quantity, i.UnitCost, i.LineTotal })
            .ToListAsync(cancellationToken);

        // Returns recorded in the span, by return date (D-149), with the order's channel and each line's price and cost.
        var returnLines = await (from l in db.OrderReturnLines.AsNoTracking()
                                 join r in db.OrderReturns.AsNoTracking() on l.ReturnId equals r.Id
                                 join i in db.OrderItems.AsNoTracking() on l.OrderItemId equals i.Id
                                 join o in db.Orders.AsNoTracking() on r.OrderId equals o.Id
                                 where r.ReturnedOn >= @from && r.ReturnedOn <= to
                                 select new { ReturnId = r.Id, r.ReturnedOn, r.Amount, o.Channel, LineId = l.Id, l.Quantity, l.Restocked, i.UnitPrice, i.UnitCost, i.ProductId, i.ProductName })
            .ToListAsync(cancellationToken);
        var returns = returnLines
            .GroupBy(l => l.ReturnId)
            .Select(g => new { g.First().ReturnedOn, g.First().Amount, g.First().Channel, Lines = g.OrderBy(l => l.LineId).ToList() })
            .ToList();

        var itemsByOrder = items.ToLookup(i => i.OrderId);

        // ----- by day: net sales and gross profit (same rounding as the dashboard series) -----
        var dayOf = orders.ToDictionary(o => o.Id, o => BusinessTime.LocalDate(o.At, Zone));
        var days = new List<SeriesDayDto>();
        var salesByDay = orders.GroupBy(o => dayOf[o.Id]).ToDictionary(g => g.Key, g => (Sales: g.Sum(o => o.Total), Cost: g.Sum(o => itemsByOrder[o.Id].Sum(i => i.Quantity * i.UnitCost))));
        var returnsByDay = returns.GroupBy(r => r.ReturnedOn).ToDictionary(g => g.Key, g => (Amount: g.Sum(r => r.Amount), Restocked: g.Sum(r => r.Lines.Where(l => l.Restocked).Sum(l => l.Quantity * l.UnitCost))));
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var sold = salesByDay.GetValueOrDefault(day);
            var back = returnsByDay.GetValueOrDefault(day);
            var sales = sold.Sales - back.Amount;
            var cogs = MoneyMath.Round(sold.Cost) - MoneyMath.Round(back.Restocked);
            days.Add(new SeriesDayDto(day, sales, sales - cogs));
        }

        // ----- by channel: a return reduces the channel of its own order -----
        var channels = orders.GroupBy(o => o.Channel).Select(g => (g.Key, Amount: g.Sum(o => o.Total), Orders: g.Count()))
            .Concat(returns.GroupBy(r => r.Channel).Select(g => (g.Key, Amount: -g.Sum(r => r.Amount), Orders: 0)))
            .GroupBy(x => x.Key)
            .Select(g => new ChannelSalesDto(g.Key.ToCode(), g.Sum(x => x.Amount), g.Sum(x => x.Orders)))
            .ToList();

        // ----- by weekday (0 = Sunday) -----
        var weekdays = new decimal[7];
        foreach (var o in orders)
        {
            weekdays[(int)dayOf[o.Id].DayOfWeek] += o.Total;
        }

        foreach (var r in returns)
        {
            weekdays[(int)r.ReturnedOn.DayOfWeek] -= r.Amount;
        }

        // ----- by product: line total minus its discount share, net of returned pieces (D-171) -----
        var products = new Dictionary<Guid, ProductAcc>();
        ProductAcc Acc(Guid id, string name) => products.TryGetValue(id, out var acc) ? acc : products[id] = new ProductAcc(name);
        foreach (var o in orders)
        {
            var lines = itemsByOrder[o.Id].OrderBy(i => i.Id).ToList();
            var shares = Allocate(o.Discount, lines.Select(i => i.LineTotal).ToList());
            for (var k = 0; k < lines.Count; k++)
            {
                var acc = Acc(lines[k].ProductId, lines[k].ProductName);
                acc.Quantity += lines[k].Quantity;
                acc.Revenue += lines[k].LineTotal - shares[k];
                acc.Cost += lines[k].Quantity * lines[k].UnitCost;
            }
        }

        foreach (var r in returns)
        {
            var shares = Allocate(r.Amount, r.Lines.Select(l => l.Quantity * l.UnitPrice).ToList());
            for (var k = 0; k < r.Lines.Count; k++)
            {
                var line = r.Lines[k];
                var acc = Acc(line.ProductId, line.ProductName);
                acc.Quantity -= line.Quantity;
                acc.Revenue -= shares[k];
                if (line.Restocked)
                {
                    acc.Cost -= line.Quantity * line.UnitCost; // damaged pieces keep their cost (D-147)
                }
            }
        }

        var productRows = products
            .Select(p => new ProductSalesDto(p.Key, p.Value.Name, p.Value.Quantity, MoneyMath.Round(p.Value.Revenue), MoneyMath.Round(p.Value.Revenue) - MoneyMath.Round(p.Value.Cost)))
            .ToList();

        return new SalesData(days, channels, weekdays, productRows, orders.Sum(o => o.DeliveryFee), orders.Count);
    }

    public async Task<SummaryData> SummaryAsync(CancellationToken cancellationToken)
    {
        var customers = db.Customers.AsNoTracking().Where(c => !c.IsArchived);
        var count = await customers.CountAsync(cancellationToken);
        var recent = await customers.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id).Take(RecentCustomers)
            .Select(c => new SummaryCustomerDto(c.Id, c.Name))
            .ToListAsync(cancellationToken);

        // D-172: available pieces now × the current effective cost (variant override, else the product cost).
        var stockValue = await (from v in db.ProductVariants.AsNoTracking()
                                join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                                where !v.IsArchived && !p.IsArchived && v.OnHand - v.Reserved > 0
                                select (decimal?)((v.OnHand - v.Reserved) * (v.CostOverride ?? p.Cost))).SumAsync(cancellationToken) ?? 0m;
        return new SummaryData(count, recent, MoneyMath.Round(stockValue));
    }

    /// <summary>
    /// Splits <paramref name="total"/> over <paramref name="weights"/> proportionally: each share rounded to 2 decimals,
    /// the last one takes the remainder, so the shares always add up to the total exactly.
    /// </summary>
    public static IReadOnlyList<decimal> Allocate(decimal total, IReadOnlyList<decimal> weights)
    {
        var shares = new decimal[weights.Count];
        if (weights.Count == 0)
        {
            return shares;
        }

        var sum = weights.Sum();
        var given = 0m;
        for (var k = 0; k < weights.Count - 1; k++)
        {
            shares[k] = sum == 0 ? 0m : Math.Round(total * weights[k] / sum, ShareScale, MidpointRounding.AwayFromZero);
            given += shares[k];
        }

        shares[^1] = total - given;
        return shares;
    }

    private static DateTime StartUtc(DateOnly day) => TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), Zone);

    private sealed class ProductAcc(string name)
    {
        public string Name { get; } = name;

        public int Quantity { get; set; }

        public decimal Revenue { get; set; }

        public decimal Cost { get; set; }
    }
}
