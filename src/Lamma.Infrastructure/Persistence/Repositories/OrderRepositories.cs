using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Orders;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

/// <summary>Per-business sequence row (D-123). Updated only by <see cref="OrderRepository.NextOrderNumberAsync"/> under a lock.</summary>
public sealed class BusinessCounter : IBusinessOwned
{
    public const string OrderNumber = "order_number";

    private BusinessCounter()
    {
    }

    public Guid BusinessId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>The next value to hand out.</summary>
    public int NextValue { get; private set; }
}

internal sealed class BusinessCounterConfiguration : IEntityTypeConfiguration<BusinessCounter>
{
    public void Configure(EntityTypeBuilder<BusinessCounter> builder)
    {
        builder.ToTable("BusinessCounters");
        builder.HasKey(c => new { c.BusinessId, c.Name });
        builder.Property(c => c.Name).HasMaxLength(32).IsUnicode(false);
        builder.HasOne<Business>().WithMany().HasForeignKey(c => c.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public const string UniqueNumberIndex = "UX_Orders_BusinessId_OrderNumber";

    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders", t =>
        {
            t.HasCheckConstraint("CK_Orders_Total", "[Total] = [ItemsSubtotal] + [DeliveryFee] - [Discount]");
            t.HasCheckConstraint("CK_Orders_Discount", "[Discount] >= 0 AND [Discount] <= [ItemsSubtotal]");
            t.HasCheckConstraint("CK_Orders_DeliveryFee", "[DeliveryFee] >= 0");
            t.HasCheckConstraint("CK_Orders_OrderNumber", $"[OrderNumber] >= {Order.FirstNumber}");
        });
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();
        builder.Property(o => o.DeliveryAddress).HasMaxLength(Order.AddressMaxLength);
        builder.Property(o => o.RecipientName).HasMaxLength(Order.RecipientNameMaxLength);
        builder.Property(o => o.RecipientPhone).HasMaxLength(PhoneNumber.MaxLength).IsUnicode(false);
        builder.Property(o => o.GiftMessage).HasMaxLength(Order.GiftMessageMaxLength);
        builder.Property(o => o.Note).HasMaxLength(Order.NoteMaxLength);
        builder.Property(o => o.CancelNote).HasMaxLength(Order.CancelNoteMaxLength);
        builder.Property(o => o.RowVersion).IsRowVersion();
        builder.Ignore(o => o.Label);
        builder.Ignore(o => o.ItemsCost);
        builder.Ignore(o => o.Profit);

        builder.HasIndex(o => new { o.BusinessId, o.OrderNumber }).IsUnique().HasDatabaseName(UniqueNumberIndex);
        builder.HasIndex(o => new { o.BusinessId, o.Status, o.CreatedAt }).IsDescending(false, false, true);
        builder.HasIndex(o => new { o.BusinessId, o.CustomerId, o.CreatedAt });
        builder.HasIndex(o => new { o.BusinessId, o.DeliveredAt });
        builder.HasIndex(o => new { o.BusinessId, o.CreatedAt }).IsDescending(false, true);

        builder.HasOne<Business>().WithMany().HasForeignKey(o => o.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Customer>().WithMany().HasForeignKey(o => o.CustomerId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasMany(o => o.StatusLogs).WithOne().HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.StatusLogs).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems", t =>
        {
            t.HasCheckConstraint("CK_OrderItems_Quantity", "[Quantity] > 0");
            t.HasCheckConstraint("CK_OrderItems_UnitPrice", "[UnitPrice] > 0");
            t.HasCheckConstraint("CK_OrderItems_UnitCost", "[UnitCost] >= 0");
        });
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.ProductName).HasMaxLength(OrderItem.ProductNameMaxLength).IsRequired();
        builder.Property(i => i.VariantLabel).HasMaxLength(OrderItem.VariantLabelMaxLength);
        builder.Ignore(i => i.DisplayName);

        builder.HasIndex(i => i.VariantId);
        builder.HasIndex(i => i.ProductId);
        builder.HasOne<ProductVariant>().WithMany().HasForeignKey(i => i.VariantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Product>().WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OrderStatusLogConfiguration : IEntityTypeConfiguration<OrderStatusLog>
{
    public void Configure(EntityTypeBuilder<OrderStatusLog> builder)
    {
        builder.ToTable("OrderStatusLogs");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.Note).HasMaxLength(Order.CancelNoteMaxLength);

        // The sequence orders the history and makes two concurrent writers of the same change fail.
        builder.HasIndex(l => new { l.OrderId, l.Sequence }).IsUnique();
    }
}

internal sealed class OrderRepository(LammaDbContext db, ICurrentBusiness currentBusiness) : IOrderRepository
{
    public Task<Order?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.Orders.Include(o => o.Items).Include(o => o.StatusLogs).AsSplitQuery().FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

    /// <summary>
    /// MERGE under HOLDLOCK: the first order of a business inserts the counter row, later ones increment it. The lock is
    /// held until the creating transaction ends, so numbers are unique, and a rolled-back order releases its number.
    /// </summary>
    public async Task<int> NextOrderNumberAsync(CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Order numbers are allocated inside the creating transaction.");
        }

        var businessId = currentBusiness.BusinessId;
        const string name = BusinessCounter.OrderNumber;
        const int first = Order.FirstNumber;
        var values = await db.Database.SqlQuery<int>($"""
            MERGE [BusinessCounters] WITH (HOLDLOCK) AS t
            USING (SELECT {businessId} AS [BusinessId], {name} AS [Name]) AS s
            ON t.[BusinessId] = s.[BusinessId] AND t.[Name] = s.[Name]
            WHEN MATCHED THEN UPDATE SET t.[NextValue] = t.[NextValue] + 1
            WHEN NOT MATCHED THEN INSERT ([BusinessId], [Name], [NextValue]) VALUES (s.[BusinessId], s.[Name], {first + 1})
            OUTPUT CASE WHEN $action = 'INSERT' THEN {first} ELSE deleted.[NextValue] END AS [Value];
            """).ToListAsync(cancellationToken);
        return values.Single();
    }

    public void Add(Order order) => db.Orders.Add(order);
}

internal sealed class OrderQueries(LammaDbContext db) : IOrderQueries
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<PagedResult<OrderListItemDto>> ListAsync(OrderListQuery query, CancellationToken cancellationToken)
    {
        var orders = Filter(query);
        if (query.Status is not null && EnumCode.TryParse<OrderStatus>(query.Status, out var status))
        {
            orders = orders.Where(o => o.Status == status);
        }

        var total = await orders.CountAsync(cancellationToken);
        var rows = from o in orders
                   join c in db.Customers.AsNoTracking() on o.CustomerId equals c.Id
                   select new ListRow
                   {
                       Id = o.Id,
                       Number = o.OrderNumber,
                       CustomerId = o.CustomerId,
                       CustomerName = c.Name,
                       CustomerPhone = c.PhoneE164,
                       Channel = o.Channel,
                       Status = o.Status,
                       Total = o.Total,
                       PaymentMethodHint = o.PaymentMethodHint,
                       Paid = db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m,
                       CreatedAt = o.CreatedAt,
                       DeliveredAt = o.DeliveredAt,
                   };
        var ordered = query.Sort switch
        {
            "createdAt" => rows.OrderBy(r => r.CreatedAt).ThenBy(r => r.Number),
            "-total" => rows.OrderByDescending(r => r.Total).ThenByDescending(r => r.Number),
            _ => rows.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Number),
        };

        var page = await ordered.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        var ids = page.Select(p => p.Id).ToList();
        var items = await db.OrderItems.AsNoTracking()
            .Where(i => ids.Contains(i.OrderId))
            .Select(i => new { i.OrderId, i.Id, i.ProductName, i.VariantLabel, i.Quantity })
            .ToListAsync(cancellationToken);

        var result = page
            .Select(p =>
            {
                var lines = items.Where(i => i.OrderId == p.Id).OrderBy(i => i.Id).ToList();
                return new OrderListItemDto(
                    p.Id,
                    p.Number,
                    p.CustomerId,
                    p.CustomerName,
                    p.CustomerPhone,
                    p.Channel.ToCode(),
                    p.Status.ToCode(),
                    OrderStatusPolicy.NextStep(p.Status)?.ToCode(),
                    lines.Sum(i => i.Quantity),
                    lines.Select(i => new OrderItemSummaryDto(i.ProductName, i.VariantLabel, i.Quantity)).ToList(),
                    p.Total,
                    p.CreatedAt,
                    p.DeliveredAt,
                    p.Paid,
                    p.Total - p.Paid,
                    PaymentStatusPolicy.For(p.Status, p.PaymentMethodHint, p.Total, p.Paid)?.ToCode());
            })
            .ToList();
        return new PagedResult<OrderListItemDto>(result, query.Page, query.PageSize, total);
    }

    public async Task<OrderStatusCountsDto> StatusCountsAsync(OrderListQuery query, CancellationToken cancellationToken)
    {
        var counts = (await Filter(query).GroupBy(o => o.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(cancellationToken))
            .ToDictionary(x => x.Status, x => x.Count);
        int Of(OrderStatus s) => counts.GetValueOrDefault(s);
        return new OrderStatusCountsDto(
            counts.Values.Sum(),
            Of(OrderStatus.New),
            Of(OrderStatus.Confirmed),
            Of(OrderStatus.Preparing),
            Of(OrderStatus.Courier),
            Of(OrderStatus.Delivered),
            Of(OrderStatus.Cancelled),
            Of(OrderStatus.Returned));
    }

    public async Task<OrderDetailsDto?> GetAsync(Guid id, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusLogs).AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (order is null)
        {
            return null;
        }

        var customer = await db.Customers.AsNoTracking()
            .Where(c => c.Id == order.CustomerId)
            .Select(c => new { c.Id, c.Name, c.PhoneE164, c.City, c.Area, c.IsArchived })
            .SingleAsync(cancellationToken);
        var productIds = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var images = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.ImagePath })
            .ToDictionaryAsync(p => p.Id, p => p.ImagePath, cancellationToken);
        var payments = await db.PaymentAllocations.AsNoTracking()
            .Where(a => a.OrderId == id)
            .Join(db.Payments.AsNoTracking(), a => a.PaymentId, p => p.Id, (a, p) => new
            {
                p.Id,
                a.Amount,
                PaymentAmount = p.Amount,
                p.Method,
                p.PaidOn,
                p.RecordedAt,
                p.Note,
                IsCustomerLevel = p.OrderId == null,
                a.IsReversed,
                p.ReversedAt,
                p.ReversalReason,
            })
            .OrderBy(p => p.PaidOn).ThenBy(p => p.RecordedAt)
            .ToListAsync(cancellationToken);

        return OrderMapping.ToDetails(
            order,
            new OrderCustomerDto(customer.Id, customer.Name, customer.PhoneE164, customer.City?.ToCode(), customer.Area, customer.IsArchived),
            images,
            payments.Select(p => new OrderPaymentDto(p.Id, p.Amount, p.PaymentAmount, p.Method.ToCode(), p.PaidOn, p.RecordedAt, p.Note, p.IsCustomerLevel, p.IsReversed, p.ReversedAt, p.ReversalReason)).ToList(),
            nowUtc);
    }

    /// <summary>Search (number, customer name or ≥ 3 phone digits), business-local date range, customer and product filters.</summary>
    private IQueryable<Order> Filter(OrderListQuery query)
    {
        var orders = db.Orders.AsNoTracking();
        if (query.CustomerId is { } customerId)
        {
            orders = orders.Where(o => o.CustomerId == customerId);
        }

        if (query.ProductId is { } productId)
        {
            orders = orders.Where(o => o.Items.Any(i => i.ProductId == productId));
        }

        if (query.From is { } from)
        {
            var fromUtc = TimeZoneInfo.ConvertTimeToUtc(from.ToDateTime(TimeOnly.MinValue), Zone);
            orders = orders.Where(o => o.CreatedAt >= fromUtc);
        }

        if (query.To is { } to)
        {
            var toUtc = TimeZoneInfo.ConvertTimeToUtc(to.AddDays(1).ToDateTime(TimeOnly.MinValue), Zone);
            orders = orders.Where(o => o.CreatedAt < toUtc);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().TrimStart('#').Trim();
            var digits = PhoneNumber.SearchDigits(search);
            var customers = db.Customers.AsNoTracking();
            if (int.TryParse(search, out var number))
            {
                orders = digits.Length >= 3
                    ? orders.Where(o => o.OrderNumber == number || customers.Any(c => c.Id == o.CustomerId && c.PhoneE164 != null && c.PhoneE164.Contains(digits)))
                    : orders.Where(o => o.OrderNumber == number);
            }
            else
            {
                orders = digits.Length >= 3
                    ? orders.Where(o => customers.Any(c => c.Id == o.CustomerId && (c.Name.Contains(search) || (c.PhoneE164 != null && c.PhoneE164.Contains(digits)))))
                    : orders.Where(o => customers.Any(c => c.Id == o.CustomerId && c.Name.Contains(search)));
            }
        }

        return orders;
    }

    private sealed class ListRow
    {
        public Guid Id { get; init; }

        public int Number { get; init; }

        public Guid CustomerId { get; init; }

        public string CustomerName { get; init; } = string.Empty;

        public string? CustomerPhone { get; init; }

        public SalesChannel Channel { get; init; }

        public OrderStatus Status { get; init; }

        public decimal Total { get; init; }

        public PaymentMethod? PaymentMethodHint { get; init; }

        public decimal Paid { get; init; }

        public DateTime CreatedAt { get; init; }

        public DateTime? DeliveredAt { get; init; }
    }
}
