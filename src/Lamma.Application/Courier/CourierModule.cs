using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Businesses;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Expenses;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Courier;
using Lamma.Domain.Orders;

namespace Lamma.Application.Courier;

// ---------- Contracts (API-DESIGN §17) ----------

public sealed record CourierSettingsRequest(string CompanyName);

/// <summary>Records a transfer from the courier for the picked orders (D-141). Requires an Idempotency-Key.</summary>
public sealed record CreateSettlementRequest(
    IReadOnlyList<Guid> OrderIds,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ReceivedAmount,
    DateOnly SettledOn,
    string? Note);

public sealed record ReverseSettlementRequest(string? Reason);

public sealed class SettlementListQuery
{
    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

/// <summary>A delivered COD order whose money is still with the courier.</summary>
public sealed record HeldOrderDto(
    Guid OrderId,
    int Number,
    Guid CustomerId,
    string CustomerName,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Total,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Paid,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Remaining,
    DateTime DeliveredAt);

public sealed record SettlementOrderDto(
    Guid OrderId,
    int Number,
    string CustomerName,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ExpectedAmount);

public sealed record SettlementDto(
    Guid Id,
    DateOnly SettledOn,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ExpectedAmount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ReceivedAmount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Difference,
    string? Note,
    DateTime RecordedAt,
    bool IsReversed,
    DateTime? ReversedAt,
    string? ReversalReason,
    Guid? ExpenseId,
    IReadOnlyList<SettlementOrderDto> Orders);

/// <summary>The courier page (D-139–D-141): money waiting for transfer, on the way, the last transfer and the month's fees.</summary>
public sealed record CourierOverviewDto(
    string CompanyName,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Held,
    int WaitingCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal OnTheWay,
    int OnTheWayCount,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MonthFees,
    SettlementDto? LastSettlement,
    IReadOnlyList<HeldOrderDto> Waiting);

// ---------- Validators ----------

public sealed class CourierSettingsRequestValidator : AbstractValidator<CourierSettingsRequest>
{
    public CourierSettingsRequestValidator()
    {
        RuleFor(x => x.CompanyName).NotEmpty().WithMessage("اكتب اسم شركة التوصيل.");
        RuleFor(x => x.CompanyName).MaximumLength(Business.CourierCompanyNameMaxLength).WithMessage($"اسم الشركة لازم يكون {Business.CourierCompanyNameMaxLength} حرف أو أقل.");
    }
}

public sealed class CreateSettlementRequestValidator : AbstractValidator<CreateSettlementRequest>
{
    public CreateSettlementRequestValidator()
    {
        RuleFor(x => x.OrderIds).Must(ids => ids is { Count: > 0 }).WithMessage("اختار طلب واحد على الأقل.");
        RuleFor(x => x.OrderIds).Must(ids => ids is null || ids.Count <= CourierSettlement.MaxOrders).WithMessage($"الحد الأقصى {CourierSettlement.MaxOrders} طلب بالتسوية.");
        RuleFor(x => x.OrderIds).Must(ids => ids is null || ids.Distinct().Count() == ids.Count).WithMessage("الطلب مكرر بالتسوية.");
        RuleFor(x => x.ReceivedAmount).Must(a => Orders.OrderValidation.IsMoneyInput(a, allowZero: true)).WithMessage("المبلغ لازم يكون صفر أو أكثر وبمنزلتين عشريتين بالأكثر.");
        RuleFor(x => x.SettledOn).NotEmpty().WithMessage("اختار تاريخ التحويل.");
        RuleFor(x => x.Note).MaximumLength(CourierSettlement.NoteMaxLength).WithMessage($"الملاحظة لازم تكون {CourierSettlement.NoteMaxLength} حرف أو أقل.");
    }
}

public sealed class ReverseSettlementRequestValidator : AbstractValidator<ReverseSettlementRequest>
{
    public ReverseSettlementRequestValidator()
        => RuleFor(x => x.Reason).MaximumLength(CourierSettlement.NoteMaxLength).WithMessage($"السبب لازم يكون {CourierSettlement.NoteMaxLength} حرف أو أقل.");
}

public sealed class SettlementListQueryValidator : AbstractValidator<SettlementListQuery>
{
    public SettlementListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
    }
}

// ---------- Ports ----------

public interface ICourierRepository
{
    void Add(CourierSettlement settlement);

    /// <summary>Locks the settlement row until commit, then loads it with its order lines, tracked.</summary>
    Task<CourierSettlement?> LockForUpdateAsync(Guid id, CancellationToken cancellationToken);
}

public interface ICourierQueries
{
    Task<CourierOverviewDto> OverviewAsync(string companyName, DateOnly monthStart, CancellationToken cancellationToken);

    Task<PagedResult<SettlementDto>> ListAsync(SettlementListQuery query, CancellationToken cancellationToken);

    Task<SettlementDto?> GetAsync(Guid id, CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface ICourierService
{
    Task<CourierOverviewDto> OverviewAsync(CancellationToken cancellationToken);

    Task<CourierOverviewDto> UpdateSettingsAsync(CourierSettingsRequest request, CancellationToken cancellationToken);

    Task<PagedResult<SettlementDto>> SettlementsAsync(SettlementListQuery query, CancellationToken cancellationToken);

    Task<SettlementDto> SettleAsync(Guid idempotencyKey, CreateSettlementRequest request, CancellationToken cancellationToken);

    Task<SettlementDto> ReverseAsync(Guid id, Guid idempotencyKey, ReverseSettlementRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Courier company and settlements (Phase 7, D-139–D-141). A settlement locks every picked order, checks it is still
/// courier-held, and writes the settlement, one COD payment per order and the difference expense in one transaction.
/// </summary>
internal sealed class CourierService(
    ICurrentBusiness currentBusiness,
    IBusinessRepository businesses,
    ICourierRepository settlements,
    ICourierQueries queries,
    IPaymentRepository payments,
    IExpenseRepository expenses,
    IExpenseCategoryRepository categories,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : ICourierService
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public async Task<CourierOverviewDto> OverviewAsync(CancellationToken cancellationToken)
    {
        var business = await businesses.GetForUpdateAsync(currentBusiness.BusinessId, cancellationToken) ?? throw new NotFoundException("business.not_found", "ما لقينا المحل.");
        var today = BusinessTime.LocalDate(clock.UtcNow, Zone);
        return await queries.OverviewAsync(business.CourierCompanyName ?? CourierSettlement.DefaultCompanyName, new DateOnly(today.Year, today.Month, 1), cancellationToken);
    }

    public async Task<CourierOverviewDto> UpdateSettingsAsync(CourierSettingsRequest request, CancellationToken cancellationToken)
    {
        var business = await businesses.GetForUpdateAsync(currentBusiness.BusinessId, cancellationToken) ?? throw new NotFoundException("business.not_found", "ما لقينا المحل.");
        business.SetCourierCompanyName(request.CompanyName);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await OverviewAsync(cancellationToken);
    }

    public Task<PagedResult<SettlementDto>> SettlementsAsync(SettlementListQuery query, CancellationToken cancellationToken) => queries.ListAsync(query, cancellationToken);

    public Task<SettlementDto> SettleAsync(Guid idempotencyKey, CreateSettlementRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, request, ct => SettleCoreAsync(request, ct), cancellationToken);

    public Task<SettlementDto> ReverseAsync(Guid id, Guid idempotencyKey, ReverseSettlementRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { id, request }, ct => ReverseCoreAsync(id, request, ct), cancellationToken);

    private async Task<SettlementDto> SettleCoreAsync(CreateSettlementRequest request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await categories.EnsureDefaultsAsync(now, cancellationToken);
        var deliveryId = await categories.DeliveryIdAsync(cancellationToken);

        // Locks in id order (no deadlock between two settlements); each lock also bumps the order's rowversion (D-137).
        var held = new List<HeldOrder>(request.OrderIds.Count);
        foreach (var orderId in request.OrderIds.Order())
        {
            var order = await payments.LockOrderAsync(orderId, cancellationToken) ?? throw new NotFoundException("order.not_found", "ما لقينا الطلب.");
            if (order.Status is not (OrderStatus.Delivered or OrderStatus.Returned) || order.ExpectedMethod != PaymentMethod.Cod || order.DeliveredAt is null)
            {
                throw new ConflictException("settlement.order_not_held", $"الطلب #{order.Number} مش عند شركة التوصيل (لازم يكون «عند الاستلام» وتوصّل).");
            }

            held.Add(new HeldOrder(order.OrderId, order.CustomerId, order.Number, order.Remaining, BusinessTime.LocalDate(order.DeliveredAt.Value, Zone)));
        }

        var (settlement, writes) = CourierSettlement.Create(
            currentBusiness.BusinessId,
            held.OrderBy(h => h.DeliveredOn).ThenBy(h => h.Number).ToList(),
            request.ReceivedAmount,
            request.SettledOn,
            BusinessTime.LocalDate(now, Zone),
            request.Note,
            deliveryId,
            Entity.NewId(),
            now);
        settlements.Add(settlement);
        foreach (var payment in writes.Payments)
        {
            payments.Add(payment);
        }

        if (writes.DifferenceExpense is { } expense)
        {
            expenses.Add(expense);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await queries.GetAsync(settlement.Id, cancellationToken) ?? throw NotFound();
    }

    private async Task<SettlementDto> ReverseCoreAsync(Guid id, ReverseSettlementRequest request, CancellationToken cancellationToken)
    {
        var settlement = await settlements.LockForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        var own = await payments.BySettlementForUpdateAsync(id, cancellationToken);
        var expense = await expenses.BySettlementForUpdateAsync(id, cancellationToken);
        settlement.Reverse(own, expense, request.Reason, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await queries.GetAsync(id, cancellationToken) ?? throw NotFound();
    }

    private static NotFoundException NotFound() => new("settlement.not_found", "ما لقينا التسوية.");
}
