using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;

namespace Lamma.Application.Customers;

// ---------- Contracts (API-DESIGN §14) ----------

/// <summary>Create or update a customer (D-116, D-117, D-118). Codes: channel = sales channel, city = governorate.</summary>
public sealed record CustomerRequest(string Name, string? Phone, string Channel, string? City, string? Area, string? Notes);

public sealed class CustomerListQuery
{
    public string? Search { get; set; }

    /// <summary>vip | owes | new | dormant.</summary>
    public string? Segment { get; set; }

    public bool Archived { get; set; }

    /// <summary>-spent (default) | name | -createdAt.</summary>
    public string? Sort { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

public sealed record CustomerListItemDto(
    Guid Id,
    string Name,
    string? Phone,
    string Channel,
    string? City,
    string? Area,
    int OrderCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal TotalSpent,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal BalanceDue,
    DateOnly? LastOrderOn,
    IReadOnlyList<string> Segments,
    bool IsArchived,
    DateTime CreatedAt);

public sealed record CustomerDetailsDto(
    Guid Id,
    string Name,
    string? Phone,
    string Channel,
    string? City,
    string? Area,
    string? Notes,
    int OrderCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal TotalSpent,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal AverageOrder,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal BalanceDue,
    DateOnly? LastOrderOn,
    IReadOnlyList<string> Segments,
    bool IsArchived,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SegmentCountsDto(int Vip, int Owes, int New, int Dormant);

public sealed record CustomersSummaryDto(
    int Total,
    int ActiveThisMonth,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal AverageSpent,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal TotalDue,
    int CustomersWithDue,
    SegmentCountsDto Segments);

// ---------- Validators ----------

public sealed class CustomerRequestValidator : AbstractValidator<CustomerRequest>
{
    public CustomerRequestValidator()
    {
        RuleFor(x => x.Name).LammaPersonName();
        RuleFor(x => x.Phone).MaximumLength(30).WithMessage("رقم الهاتف طويل كثير.");
        RuleFor(x => x.Channel).IsCodeOf<CustomerRequest, SalesChannel>("اختار من وين إجى العميل.");
        RuleFor(x => x.City).Must(c => c is null || EnumCode.TryParse<JordanGovernorate>(c, out _)).WithMessage("اختار المحافظة من القائمة.");
        RuleFor(x => x.Area).MaximumLength(Customer.AreaMaxLength).WithMessage($"المنطقة لازم تكون {Customer.AreaMaxLength} حرف أو أقل.");
        RuleFor(x => x.Notes).MaximumLength(Customer.NotesMaxLength).WithMessage($"الملاحظات لازم تكون {Customer.NotesMaxLength} حرف أو أقل.");
    }
}

public sealed class CustomerListQueryValidator : AbstractValidator<CustomerListQuery>
{
    public CustomerListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Segment).Must(s => s is null || EnumCode.TryParse<CustomerSegment>(s, out _)).WithMessage("الفئة غير معروفة.");
        RuleFor(x => x.Sort).Must(s => s is null or "-spent" or "name" or "-createdAt").WithMessage("الترتيب غير معروف.");
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل كثير.");
    }
}

// ---------- Ports ----------

public interface ICustomerRepository
{
    Task<Customer?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>A customer of the current business with this phone (archived included), other than <paramref name="excludeId"/>.</summary>
    Task<(Guid Id, string Name)?> FindByPhoneAsync(string phoneE164, Guid? excludeId, CancellationToken cancellationToken);

    void Add(Customer customer);
}

public interface ICustomerQueries
{
    Task<PagedResult<CustomerListItemDto>> ListAsync(CustomerListQuery query, DateOnly today, CancellationToken cancellationToken);

    Task<CustomersSummaryDto> SummaryAsync(DateOnly today, CancellationToken cancellationToken);

    Task<CustomerDetailsDto?> GetAsync(Guid id, DateOnly today, CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface ICustomerService
{
    Task<PagedResult<CustomerListItemDto>> ListAsync(CustomerListQuery query, CancellationToken cancellationToken);

    Task<CustomersSummaryDto> SummaryAsync(CancellationToken cancellationToken);

    Task<CustomerDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<CustomerDetailsDto> CreateAsync(CustomerRequest request, CancellationToken cancellationToken);

    Task<CustomerDetailsDto> UpdateAsync(Guid id, CustomerRequest request, CancellationToken cancellationToken);

    Task<CustomerDetailsDto> SetArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken);
}

internal sealed class CustomerService(
    ICurrentBusiness currentBusiness,
    ICustomerRepository customers,
    ICustomerQueries queries,
    IUnitOfWork unitOfWork,
    IClock clock) : ICustomerService
{
    public Task<PagedResult<CustomerListItemDto>> ListAsync(CustomerListQuery query, CancellationToken cancellationToken) => queries.ListAsync(query, Today(), cancellationToken);

    public Task<CustomersSummaryDto> SummaryAsync(CancellationToken cancellationToken) => queries.SummaryAsync(Today(), cancellationToken);

    public async Task<CustomerDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken)
        => await queries.GetAsync(id, Today(), cancellationToken) ?? throw NotFound();

    public async Task<CustomerDetailsDto> CreateAsync(CustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = Customer.Create(currentBusiness.BusinessId, request.Name, request.Phone, EnumCode.Parse<SalesChannel>(request.Channel), City(request.City), request.Area, request.Notes);
        await EnsureUniquePhoneAsync(customer.PhoneE164, null, cancellationToken);
        customers.Add(customer);
        await SaveAsync(customer.PhoneE164, cancellationToken);
        return await GetAsync(customer.Id, cancellationToken);
    }

    public async Task<CustomerDetailsDto> UpdateAsync(Guid id, CustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        customer.Update(request.Name, request.Phone, EnumCode.Parse<SalesChannel>(request.Channel), City(request.City), request.Area, request.Notes);
        await EnsureUniquePhoneAsync(customer.PhoneE164, id, cancellationToken);
        await SaveAsync(customer.PhoneE164, cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<CustomerDetailsDto> SetArchivedAsync(Guid id, bool archived, CancellationToken cancellationToken)
    {
        var customer = await customers.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        if (archived)
        {
            customer.Archive();
        }
        else
        {
            customer.Restore();
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private async Task EnsureUniquePhoneAsync(string? phone, Guid? excludeId, CancellationToken cancellationToken)
    {
        if (phone is not null && await customers.FindByPhoneAsync(phone, excludeId, cancellationToken) is { } existing)
        {
            throw DuplicatePhone(existing.Id, existing.Name);
        }
    }

    private async Task SaveAsync(string? phone, CancellationToken cancellationToken)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException) when (phone is not null)
        {
            throw DuplicatePhone(null, null); // a concurrent request saved the same number first
        }
    }

    private static ConflictException DuplicatePhone(Guid? id, string? name)
        => new(
            "customer.duplicate_phone",
            name is null ? "هاد الرقم مسجّل لعميل ثاني." : $"هاد الرقم مسجّل لـ «{name}».",
            id is null ? null : new Dictionary<string, object?> { ["existingCustomerId"] = id, ["existingCustomerName"] = name });

    private static JordanGovernorate? City(string? code) => code is null ? null : EnumCode.Parse<JordanGovernorate>(code);

    private DateOnly Today() => BusinessTime.LocalDate(clock.UtcNow, BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId));

    private static NotFoundException NotFound() => new("customer.not_found", "ما لقينا العميل.");
}
