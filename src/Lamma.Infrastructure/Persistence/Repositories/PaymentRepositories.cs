using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public const string UniqueOperationIndex = "UX_Payments_BusinessId_OperationId";

    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments", t => t.HasCheckConstraint("CK_Payments_Amount", "[Amount] > 0"));
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Note).HasMaxLength(Payment.NoteMaxLength);
        builder.Property(p => p.ReversalReason).HasMaxLength(Payment.ReversalReasonMaxLength);
        builder.Ignore(p => p.IsReversed);

        builder.HasIndex(p => new { p.BusinessId, p.OperationId }).IsUnique().HasDatabaseName(UniqueOperationIndex);
        builder.HasIndex(p => new { p.BusinessId, p.PaidOn });
        builder.HasIndex(p => new { p.BusinessId, p.CustomerId });

        builder.HasOne<Business>().WithMany().HasForeignKey(p => p.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Customer>().WithMany().HasForeignKey(p => p.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Order>().WithMany().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.Allocations).WithOne().HasForeignKey(a => a.PaymentId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Allocations).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class PaymentAllocationConfiguration : IEntityTypeConfiguration<PaymentAllocation>
{
    public void Configure(EntityTypeBuilder<PaymentAllocation> builder)
    {
        builder.ToTable("PaymentAllocations", t => t.HasCheckConstraint("CK_PaymentAllocations_Amount", "[Amount] > 0"));
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        // Order paid = Σ active allocations (D-131): one covering index serves every per-order sum.
        builder.HasIndex(a => a.OrderId).IncludeProperties(a => new { a.Amount, a.IsReversed });
        builder.HasOne<Order>().WithMany().HasForeignKey(a => a.OrderId).OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>
/// Locks are taken with a no-op UPDATE (exclusive row lock until commit). On Orders it also bumps the rowversion, so a
/// status change that loaded the order earlier fails its save, retries and sees the new payment (D-137).
/// </summary>
internal sealed class PaymentRepository(LammaDbContext db, ICurrentBusiness currentBusiness) : IPaymentRepository
{
    public void Add(Payment payment) => db.Payments.Add(payment);

    public async Task<OrderPaymentState?> LockOrderAsync(Guid orderId, CancellationToken cancellationToken)
    {
        EnsureTransaction();
        var businessId = currentBusiness.BusinessId;
        var locked = await db.Database.ExecuteSqlAsync(
            $"UPDATE [Orders] SET [UpdatedAt] = [UpdatedAt] WHERE [Id] = {orderId} AND [BusinessId] = {businessId}",
            cancellationToken);
        if (locked == 0)
        {
            return null;
        }

        return await States(db.Orders.AsNoTracking().Where(o => o.Id == orderId)).SingleAsync(cancellationToken);
    }

    public async Task<bool> LockCustomerAsync(Guid customerId, CancellationToken cancellationToken)
    {
        EnsureTransaction();
        var businessId = currentBusiness.BusinessId;
        var locked = await db.Database.ExecuteSqlAsync(
            $"UPDATE [Customers] SET [UpdatedAt] = [UpdatedAt] WHERE [Id] = {customerId} AND [BusinessId] = {businessId}",
            cancellationToken);
        if (locked == 0)
        {
            return false;
        }

        var delivered = OrderStatus.Delivered.ToCode();
        await db.Database.ExecuteSqlAsync(
            $"UPDATE [Orders] SET [UpdatedAt] = [UpdatedAt] WHERE [BusinessId] = {businessId} AND [CustomerId] = {customerId} AND [Status] = {delivered}",
            cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<OrderPaymentState>> DeliveredOrdersAsync(Guid customerId, CancellationToken cancellationToken)
        => await States(db.Orders.AsNoTracking().Where(o => o.CustomerId == customerId && o.Status == OrderStatus.Delivered)).ToListAsync(cancellationToken);

    public async Task<Payment?> LockForUpdateAsync(Guid paymentId, CancellationToken cancellationToken)
    {
        EnsureTransaction();
        var businessId = currentBusiness.BusinessId;
        var locked = await db.Database.ExecuteSqlAsync(
            $"UPDATE [Payments] SET [RecordedAt] = [RecordedAt] WHERE [Id] = {paymentId} AND [BusinessId] = {businessId}",
            cancellationToken);
        return locked == 0 ? null : await db.Payments.Include(p => p.Allocations).FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);
    }

    public Task<bool> HasActivePaymentsAsync(Guid orderId, CancellationToken cancellationToken)
        => db.PaymentAllocations.AnyAsync(a => a.OrderId == orderId && !a.IsReversed, cancellationToken);

    public async Task<decimal> PaidAsync(Guid orderId, CancellationToken cancellationToken)
        => await db.PaymentAllocations.Where(a => a.OrderId == orderId && !a.IsReversed).SumAsync(a => (decimal?)a.Amount, cancellationToken) ?? 0m;

    private IQueryable<OrderPaymentState> States(IQueryable<Order> orders)
        => orders.Select(o => new OrderPaymentState(
            o.Id,
            o.CustomerId,
            o.OrderNumber,
            o.Status,
            o.PaymentMethodHint,
            o.Total,
            db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m,
            o.CreatedAt,
            o.DeliveredAt));

    private void EnsureTransaction()
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Payment locks are taken inside the writing transaction.");
        }
    }
}

/// <summary>Payment, receivable and aging read models (D-131–D-134). SQL projections; per-order paid is one indexed sum.</summary>
internal sealed class PaymentQueries(LammaDbContext db) : IPaymentQueries
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<PagedResult<PaymentDto>> ListAsync(PaymentListQuery query, CancellationToken cancellationToken)
    {
        var payments = db.Payments.AsNoTracking();
        if (query.From is { } from)
        {
            payments = payments.Where(p => p.PaidOn >= from);
        }

        if (query.To is { } to)
        {
            payments = payments.Where(p => p.PaidOn <= to);
        }

        if (query.Method is not null && EnumCode.TryParse<PaymentMethod>(query.Method, out var method))
        {
            payments = payments.Where(p => p.Method == method);
        }

        if (query.CustomerId is { } customerId)
        {
            payments = payments.Where(p => p.CustomerId == customerId);
        }

        if (query.OrderId is { } orderId)
        {
            payments = payments.Where(p => p.Allocations.Any(a => a.OrderId == orderId));
        }

        var total = await payments.CountAsync(cancellationToken);
        var page = await Rows(payments)
            .OrderByDescending(r => r.PaidOn).ThenByDescending(r => r.RecordedAt).ThenByDescending(r => r.Id)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<PaymentDto>(await ToDtosAsync(page, cancellationToken), query.Page, query.PageSize, total);
    }

    public async Task<PaymentDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await Rows(db.Payments.AsNoTracking().Where(p => p.Id == id)).FirstOrDefaultAsync(cancellationToken);
        return row is null ? null : (await ToDtosAsync([row], cancellationToken))[0];
    }

    public async Task<PagedResult<ReceivableDto>> ReceivablesAsync(ReceivableListQuery query, DateOnly today, CancellationToken cancellationToken)
    {
        var rows = Receivables();
        if (query.CustomerId is { } customerId)
        {
            rows = rows.Where(r => r.CustomerId == customerId);
        }

        if (query.Bucket is not null && EnumCode.TryParse<AgingBucket>(query.Bucket, out var bucket))
        {
            var freshFromUtc = StartUtc(today.AddDays(-PaymentStatusPolicy.FreshMaxDays));
            var lateFromUtc = StartUtc(today.AddDays(-PaymentStatusPolicy.LateMaxDays));
            rows = bucket switch
            {
                AgingBucket.Fresh => rows.Where(r => r.DeliveredAt >= freshFromUtc),
                AgingBucket.Late => rows.Where(r => r.DeliveredAt >= lateFromUtc && r.DeliveredAt < freshFromUtc),
                _ => rows.Where(r => r.DeliveredAt < lateFromUtc),
            };
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().TrimStart('#').Trim();
            var digits = PhoneNumber.SearchDigits(search);
            var hasNumber = int.TryParse(search, out var number);
            rows = rows.Where(r =>
                (hasNumber && r.Number == number)
                || r.CustomerName.Contains(search)
                || (digits.Length >= 3 && r.CustomerPhone != null && r.CustomerPhone.Contains(digits)));
        }

        var total = await rows.CountAsync(cancellationToken);
        var page = await rows.OrderBy(r => r.DeliveredAt).ThenBy(r => r.Number)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToListAsync(cancellationToken);
        var items = page.Select(r =>
        {
            var age = PaymentStatusPolicy.AgeDays(BusinessTime.LocalDate(r.DeliveredAt, Zone), today);
            return new ReceivableDto(
                r.OrderId, r.Number, r.CustomerId, r.CustomerName, r.CustomerPhone, r.Total, r.Paid, r.Total - r.Paid,
                (r.Paid > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid).ToCode(), r.DeliveredAt, age, PaymentStatusPolicy.BucketOf(age).ToCode());
        }).ToList();
        return new PagedResult<ReceivableDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<ReceivablesAgingDto> AgingAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var rows = await Receivables().Select(r => new { r.CustomerId, Remaining = r.Total - r.Paid, r.DeliveredAt }).ToListAsync(cancellationToken);
        var byBucket = rows
            .GroupBy(r => PaymentStatusPolicy.BucketOf(PaymentStatusPolicy.AgeDays(BusinessTime.LocalDate(r.DeliveredAt, Zone), today)))
            .ToDictionary(g => g.Key, g => new AgingBucketDto(g.Sum(r => r.Remaining), g.Count()));
        AgingBucketDto Of(AgingBucket b) => byBucket.GetValueOrDefault(b) ?? new AgingBucketDto(0m, 0);

        // D-133: COD orders with the courier or delivered, something still due. Settled through the courier in Phase 7.
        var held = await db.Orders.AsNoTracking()
            .Where(o => o.PaymentMethodHint == PaymentMethod.Cod && (o.Status == OrderStatus.Courier || o.Status == OrderStatus.Delivered))
            .Select(o => o.Total - (db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m))
            .Where(remaining => remaining > 0)
            .ToListAsync(cancellationToken);

        return new ReceivablesAgingDto(
            rows.Sum(r => r.Remaining),
            rows.Count,
            rows.Select(r => r.CustomerId).Distinct().Count(),
            Of(AgingBucket.Fresh),
            Of(AgingBucket.Late),
            Of(AgingBucket.Overdue),
            held.Sum(),
            held.Count);
    }

    public async Task<IReadOnlyList<OrderPaymentSummaryDto>> OrderSummariesAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken cancellationToken)
    {
        var ids = orderIds.Distinct().ToList();
        var rows = await db.Orders.AsNoTracking()
            .Where(o => ids.Contains(o.Id))
            .Select(o => new
            {
                o.Id,
                o.OrderNumber,
                o.Status,
                o.PaymentMethodHint,
                o.Total,
                Paid = db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m,
            })
            .OrderBy(o => o.OrderNumber)
            .ToListAsync(cancellationToken);
        return rows
            .Select(o => new OrderPaymentSummaryDto(o.Id, o.OrderNumber, o.Total, o.Paid, o.Total - o.Paid, PaymentStatusPolicy.For(o.Status, o.PaymentMethodHint, o.Total, o.Paid)?.ToCode()))
            .ToList();
    }

    public async Task<decimal> CustomerBalanceAsync(Guid customerId, CancellationToken cancellationToken)
        => (await Receivables().Where(r => r.CustomerId == customerId).Select(r => r.Total - r.Paid).ToListAsync(cancellationToken)).Sum(); // SQL Server cannot SUM over a subquery

    /// <summary>
    /// Customer receivables (D-134): delivered, not COD (COD money is courier-held), something still due.
    /// Keep in step with the balance in <c>CustomerQueries.Rows</c>.
    /// </summary>
    private IQueryable<ReceivableRow> Receivables()
        => db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Delivered && o.DeliveredAt != null && (o.PaymentMethodHint == null || o.PaymentMethodHint != PaymentMethod.Cod))
            .Join(db.Customers.AsNoTracking(), o => o.CustomerId, c => c.Id, (o, c) => new ReceivableRow
            {
                OrderId = o.Id,
                Number = o.OrderNumber,
                CustomerId = c.Id,
                CustomerName = c.Name,
                CustomerPhone = c.PhoneE164,
                Total = o.Total,
                Paid = db.PaymentAllocations.Where(a => a.OrderId == o.Id && !a.IsReversed).Sum(a => (decimal?)a.Amount) ?? 0m,
                DeliveredAt = o.DeliveredAt!.Value,
            })
            .Where(r => r.Total - r.Paid > 0);

    private IQueryable<PaymentRow> Rows(IQueryable<Payment> payments)
        => payments.Join(db.Customers.AsNoTracking(), p => p.CustomerId, c => c.Id, (p, c) => new PaymentRow
        {
            Id = p.Id,
            CustomerId = p.CustomerId,
            CustomerName = c.Name,
            OrderId = p.OrderId,
            Amount = p.Amount,
            Method = p.Method,
            PaidOn = p.PaidOn,
            RecordedAt = p.RecordedAt,
            Note = p.Note,
            ReversedAt = p.ReversedAt,
            ReversalReason = p.ReversalReason,
        });

    private async Task<List<PaymentDto>> ToDtosAsync(IReadOnlyList<PaymentRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var allocations = await db.PaymentAllocations.AsNoTracking()
            .Where(a => ids.Contains(a.PaymentId))
            .Join(db.Orders.AsNoTracking(), a => a.OrderId, o => o.Id, (a, o) => new { a.PaymentId, a.OrderId, o.OrderNumber, a.Amount })
            .ToListAsync(cancellationToken);
        return rows.Select(r =>
        {
            var lines = allocations.Where(a => a.PaymentId == r.Id).OrderBy(a => a.OrderNumber).Select(a => new PaymentAllocationDto(a.OrderId, a.OrderNumber, a.Amount)).ToList();
            return new PaymentDto(
                r.Id, r.CustomerId, r.CustomerName, r.OrderId, r.OrderId is { } orderId ? lines.FirstOrDefault(l => l.OrderId == orderId)?.OrderNumber : null,
                r.Amount, r.Method.ToCode(), r.PaidOn, r.RecordedAt, r.Note, r.ReversedAt is not null, r.ReversedAt, r.ReversalReason, lines);
        }).ToList();
    }

    private static DateTime StartUtc(DateOnly day) => TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), Zone);

    private sealed class ReceivableRow
    {
        public Guid OrderId { get; init; }

        public int Number { get; init; }

        public Guid CustomerId { get; init; }

        public string CustomerName { get; init; } = string.Empty;

        public string? CustomerPhone { get; init; }

        public decimal Total { get; init; }

        public decimal Paid { get; init; }

        public DateTime DeliveredAt { get; init; }
    }

    private sealed class PaymentRow
    {
        public Guid Id { get; init; }

        public Guid CustomerId { get; init; }

        public string CustomerName { get; init; } = string.Empty;

        public Guid? OrderId { get; init; }

        public decimal Amount { get; init; }

        public PaymentMethod Method { get; init; }

        public DateOnly PaidOn { get; init; }

        public DateTime RecordedAt { get; init; }

        public string? Note { get; init; }

        public DateTime? ReversedAt { get; init; }

        public string? ReversalReason { get; init; }
    }
}
