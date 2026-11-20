using Lamma.Application.Catalog;
using Lamma.Application.Customers;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;
using Lamma.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public const string UniquePhoneIndex = "UX_Customers_BusinessId_PhoneE164";

    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(Customer.NameMaxLength).IsRequired();
        builder.Property(c => c.PhoneE164).HasMaxLength(PhoneNumber.MaxLength).IsUnicode(false);
        builder.Property(c => c.Area).HasMaxLength(Customer.AreaMaxLength);
        builder.Property(c => c.Notes).HasMaxLength(Customer.NotesMaxLength);

        // Unique per business when present, archived customers included (D-116).
        builder.HasIndex(c => new { c.BusinessId, c.PhoneE164 }).IsUnique().HasFilter("[PhoneE164] IS NOT NULL").HasDatabaseName(UniquePhoneIndex);
        builder.HasIndex(c => new { c.BusinessId, c.Name });
        builder.HasOne<Business>().WithMany().HasForeignKey(c => c.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class CustomerRepository(LammaDbContext db) : ICustomerRepository
{
    public Task<Customer?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken)
        => db.Customers.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<(Guid Id, string Name)?> FindByPhoneAsync(string phoneE164, Guid? excludeId, CancellationToken cancellationToken)
    {
        var match = await db.Customers.AsNoTracking()
            .Where(c => c.PhoneE164 == phoneE164 && (excludeId == null || c.Id != excludeId))
            .Select(c => new { c.Id, c.Name })
            .FirstOrDefaultAsync(cancellationToken);
        return match is null ? null : (match.Id, match.Name);
    }

    public void Add(Customer customer) => db.Customers.Add(customer);
}

internal sealed class CustomerQueries(LammaDbContext db) : ICustomerQueries
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    /// <summary>
    /// Customers with their derived figures (D-033, Phase 5 rules): order count = non-cancelled orders; total spent =
    /// Σ total of delivered orders; last order = latest non-cancelled order. The single place where stats come from.
    /// The balance due stays 0 until payments exist (Phase 6).
    /// </summary>
    private IQueryable<CustomerRow> Rows() => db.Customers.AsNoTracking().Select(c => new CustomerRow
    {
        Id = c.Id,
        Name = c.Name,
        PhoneE164 = c.PhoneE164,
        Channel = c.Channel,
        City = c.City,
        Area = c.Area,
        Notes = c.Notes,
        IsArchived = c.IsArchived,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
        OrderCount = db.Orders.Count(o => o.CustomerId == c.Id && o.Status != OrderStatus.Cancelled),
        TotalSpent = db.Orders.Where(o => o.CustomerId == c.Id && o.Status == OrderStatus.Delivered).Sum(o => (decimal?)o.Total) ?? 0m,
        BalanceDue = 0m, // payments arrive in Phase 6
        LastOrderAt = db.Orders.Where(o => o.CustomerId == c.Id && o.Status != OrderStatus.Cancelled).Max(o => (DateTime?)o.CreatedAt),
    });

    public async Task<PagedResult<CustomerListItemDto>> ListAsync(CustomerListQuery query, DateOnly today, CancellationToken cancellationToken)
    {
        var cutoff = await VipCutoffAsync(cancellationToken);
        var rows = Rows().Where(r => r.IsArchived == query.Archived);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            var digits = PhoneNumber.SearchDigits(search);
            rows = digits.Length >= 3
                ? rows.Where(r => r.Name.Contains(search) || (r.PhoneE164 != null && r.PhoneE164.Contains(digits)))
                : rows.Where(r => r.Name.Contains(search));
        }

        rows = FilterSegment(rows, query.Segment, cutoff, today);
        var total = await rows.CountAsync(cancellationToken);
        var ordered = query.Sort switch
        {
            "name" => rows.OrderBy(r => r.Name).ThenBy(r => r.Id),
            "-createdAt" => rows.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id),
            _ => rows.OrderByDescending(r => r.TotalSpent).ThenBy(r => r.Name).ThenBy(r => r.Id),
        };

        var page = await ordered.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        var items = page.Select(r =>
        {
            var stats = Stats(r);
            return new CustomerListItemDto(
                r.Id, r.Name, r.PhoneE164, r.Channel.ToCode(), r.City?.ToCode(), r.Area,
                stats.OrderCount, stats.TotalSpent, stats.BalanceDue, stats.LastOrderOn, Segments(stats, today, cutoff), r.IsArchived, r.CreatedAt);
        }).ToList();
        return new PagedResult<CustomerListItemDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<CustomersSummaryDto> SummaryAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var rows = await Rows().Where(r => !r.IsArchived).ToListAsync(cancellationToken);
        var stats = rows.Select(Stats).ToList();
        var cutoff = CustomerSegmentPolicy.VipCutoff(stats.Select(s => s.TotalSpent));
        var segments = stats.SelectMany(s => CustomerSegmentPolicy.For(s, today, cutoff)).ToList();
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        return new CustomersSummaryDto(
            rows.Count,
            stats.Count(s => s.LastOrderOn >= monthStart),
            rows.Count == 0 ? 0 : MoneyMath.Round(stats.Sum(s => s.TotalSpent) / rows.Count),
            stats.Sum(s => s.BalanceDue),
            stats.Count(s => s.BalanceDue > 0),
            new SegmentCountsDto(
                segments.Count(s => s == CustomerSegment.Vip),
                segments.Count(s => s == CustomerSegment.Owes),
                segments.Count(s => s == CustomerSegment.New),
                segments.Count(s => s == CustomerSegment.Dormant)));
    }

    public async Task<CustomerDetailsDto?> GetAsync(Guid id, DateOnly today, CancellationToken cancellationToken)
    {
        var row = await Rows().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
        {
            return null;
        }

        var cutoff = await VipCutoffAsync(cancellationToken);
        var stats = Stats(row);
        var average = stats.OrderCount == 0 ? 0 : MoneyMath.Round(stats.TotalSpent / stats.OrderCount);
        return new CustomerDetailsDto(
            row.Id, row.Name, row.PhoneE164, row.Channel.ToCode(), row.City?.ToCode(), row.Area, row.Notes,
            stats.OrderCount, stats.TotalSpent, average, stats.BalanceDue, stats.LastOrderOn, Segments(stats, today, cutoff), row.IsArchived, row.CreatedAt, row.UpdatedAt);
    }

    private async Task<decimal?> VipCutoffAsync(CancellationToken cancellationToken)
        => CustomerSegmentPolicy.VipCutoff(await Rows().Where(r => !r.IsArchived).Select(r => r.TotalSpent).ToListAsync(cancellationToken));

    /// <summary>Segment filters as SQL over the derived figures (same rules as <see cref="CustomerSegmentPolicy"/>).</summary>
    private static IQueryable<CustomerRow> FilterSegment(IQueryable<CustomerRow> rows, string? segment, decimal? cutoff, DateOnly today)
    {
        if (segment is null || !EnumCode.TryParse<CustomerSegment>(segment, out var value))
        {
            return rows;
        }

        var dormantBeforeUtc = TimeZoneInfo.ConvertTimeToUtc(today.AddDays(-CustomerSegmentPolicy.DormantAfterDays).ToDateTime(TimeOnly.MinValue), Zone);
        return value switch
        {
            CustomerSegment.Vip => cutoff is { } c ? rows.Where(r => r.TotalSpent > 0 && r.TotalSpent >= c) : rows.Where(_ => false),
            CustomerSegment.Owes => rows.Where(r => r.BalanceDue > 0),
            CustomerSegment.New => rows.Where(r => r.OrderCount <= CustomerSegmentPolicy.NewMaxOrders),
            _ => rows.Where(r => r.LastOrderAt != null && r.LastOrderAt < dormantBeforeUtc),
        };
    }

    private static CustomerStats Stats(CustomerRow r)
        => new(r.OrderCount, r.TotalSpent, r.BalanceDue, r.LastOrderAt is { } at ? BusinessTime.LocalDate(at, Zone) : null);

    private static IReadOnlyList<string> Segments(CustomerStats stats, DateOnly today, decimal? cutoff)
        => CustomerSegmentPolicy.For(stats, today, cutoff).Select(s => s.ToCode()).ToList();

    private sealed class CustomerRow
    {
        public Guid Id { get; init; }

        public string Name { get; init; } = string.Empty;

        public string? PhoneE164 { get; init; }

        public SalesChannel Channel { get; init; }

        public JordanGovernorate? City { get; init; }

        public string? Area { get; init; }

        public string? Notes { get; init; }

        public bool IsArchived { get; init; }

        public DateTime CreatedAt { get; init; }

        public DateTime UpdatedAt { get; init; }

        public int OrderCount { get; init; }

        public decimal TotalSpent { get; init; }

        public decimal BalanceDue { get; init; }

        public DateTime? LastOrderAt { get; init; }
    }
}
