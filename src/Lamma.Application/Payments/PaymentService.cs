using Lamma.Application.Businesses;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Payments;

namespace Lamma.Application.Payments;

public interface IPaymentService
{
    Task<PagedResult<PaymentDto>> ListAsync(PaymentListQuery query, CancellationToken cancellationToken);

    Task<PaymentDto> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<ReceivableDto>> ReceivablesAsync(ReceivableListQuery query, CancellationToken cancellationToken);

    Task<ReceivablesAgingDto> AgingAsync(CancellationToken cancellationToken);

    Task<PaymentResultDto> RecordForOrderAsync(Guid orderId, Guid idempotencyKey, RecordPaymentRequest request, CancellationToken cancellationToken);

    Task<PaymentResultDto> RecordForCustomerAsync(Guid customerId, Guid idempotencyKey, RecordPaymentRequest request, CancellationToken cancellationToken);

    Task<PaymentResultDto> ReverseAsync(Guid paymentId, Guid idempotencyKey, ReversePaymentRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Payments and receivables (Phase 6, D-131–D-138). Every write is idempotent (D-112) and runs in one transaction that
/// first locks the rows it reads (order, or customer and their delivered orders, or the payment), so two payments can
/// never together exceed what is due. Paid, remaining, status and balance are computed from allocations (D-033).
/// </summary>
internal sealed class PaymentService(
    ICurrentBusiness currentBusiness,
    IPaymentRepository payments,
    IPaymentQueries queries,
    IBusinessSettingsQueries settings,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : IPaymentService
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public Task<PagedResult<PaymentDto>> ListAsync(PaymentListQuery query, CancellationToken cancellationToken) => queries.ListAsync(query, cancellationToken);

    public async Task<PaymentDto> GetAsync(Guid id, CancellationToken cancellationToken)
        => await queries.GetAsync(id, cancellationToken) ?? throw NotFound();

    public Task<PagedResult<ReceivableDto>> ReceivablesAsync(ReceivableListQuery query, CancellationToken cancellationToken) => queries.ReceivablesAsync(query, Today(), cancellationToken);

    public Task<ReceivablesAgingDto> AgingAsync(CancellationToken cancellationToken) => queries.AgingAsync(Today(), cancellationToken);

    public Task<PaymentResultDto> RecordForOrderAsync(Guid orderId, Guid idempotencyKey, RecordPaymentRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { orderId, request }, ct => RecordForOrderCoreAsync(orderId, request, ct), cancellationToken);

    public Task<PaymentResultDto> RecordForCustomerAsync(Guid customerId, Guid idempotencyKey, RecordPaymentRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { customerId, request }, ct => RecordForCustomerCoreAsync(customerId, request, ct), cancellationToken);

    public Task<PaymentResultDto> ReverseAsync(Guid paymentId, Guid idempotencyKey, ReversePaymentRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { paymentId, request }, ct => ReverseCoreAsync(paymentId, request, ct), cancellationToken);

    /// <summary>The method must be recordable by hand (not COD, D-138) and enabled in settings.</summary>
    internal static async Task<PaymentMethod> RecordableMethodAsync(IBusinessSettingsQueries settings, Guid businessId, string code, string field, CancellationToken cancellationToken)
    {
        var method = EnumCode.Parse<PaymentMethod>(code);
        if (!PaymentRules.IsRecordable(method))
        {
            throw RequestValidationException.ForField(field, "الدفع عند الاستلام بيجمعه المندوب، وبينسجّل مع تسوية شركة التوصيل.", "payment.method_not_allowed");
        }

        if (!(await settings.GetPaymentMethodsAsync(businessId, cancellationToken)).Any(r => r.Value == method && r.IsEnabled))
        {
            throw RequestValidationException.ForField(field, "طريقة الدفع هاي مش مفعّلة بالإعدادات.", "payment.method_not_allowed");
        }

        return method;
    }

    private async Task<PaymentResultDto> RecordForOrderCoreAsync(Guid orderId, RecordPaymentRequest request, CancellationToken cancellationToken)
    {
        var method = await RecordableMethodAsync(settings, currentBusiness.BusinessId, request.Method, "method", cancellationToken);
        var order = await payments.LockOrderAsync(orderId, cancellationToken) ?? throw new NotFoundException("order.not_found", "ما لقينا الطلب.");
        if (!PaymentStatusPolicy.CanReceivePayment(order.Status))
        {
            throw new ConflictException("order.not_payable", "الطلب ملغي أو مرجّع، ما بنسجّل عليه دفعات.");
        }

        var now = clock.UtcNow;
        var payment = Payment.ForOrder(
            currentBusiness.BusinessId,
            order.CustomerId,
            order.OrderId,
            order.Remaining,
            request.Amount,
            method,
            request.PaidOn,
            BusinessTime.LocalDate(now, Zone),
            BusinessTime.LocalDate(order.CreatedAt, Zone),
            request.Note,
            Entity.NewId(),
            now);
        payments.Add(payment);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await ResultAsync(payment, cancellationToken);
    }

    private async Task<PaymentResultDto> RecordForCustomerCoreAsync(Guid customerId, RecordPaymentRequest request, CancellationToken cancellationToken)
    {
        var method = await RecordableMethodAsync(settings, currentBusiness.BusinessId, request.Method, "method", cancellationToken);
        if (!await payments.LockCustomerAsync(customerId, cancellationToken))
        {
            throw new NotFoundException("customer.not_found", "ما لقينا العميل.");
        }

        // FIFO (D-131): oldest delivery first, then the lowest order number.
        var receivables = (await payments.DeliveredOrdersAsync(customerId, cancellationToken))
            .Where(o => PaymentStatusPolicy.IsReceivable(o.Status, o.ExpectedMethod, o.Remaining))
            .OrderBy(o => o.DeliveredAt)
            .ThenBy(o => o.Number)
            .Select(o => new AllocationLine(o.OrderId, o.Remaining))
            .ToList();

        var now = clock.UtcNow;
        var payment = Payment.ForCustomer(currentBusiness.BusinessId, customerId, receivables, request.Amount, method, request.PaidOn, BusinessTime.LocalDate(now, Zone), request.Note, Entity.NewId(), now);
        payments.Add(payment);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await ResultAsync(payment, cancellationToken);
    }

    private async Task<PaymentResultDto> ReverseCoreAsync(Guid paymentId, ReversePaymentRequest request, CancellationToken cancellationToken)
    {
        var payment = await payments.LockForUpdateAsync(paymentId, cancellationToken) ?? throw NotFound();
        payment.Reverse(request.Reason, Entity.NewId(), clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await ResultAsync(payment, cancellationToken);
    }

    private async Task<PaymentResultDto> ResultAsync(Payment payment, CancellationToken cancellationToken)
    {
        var dto = await queries.GetAsync(payment.Id, cancellationToken) ?? throw NotFound();
        var orders = await queries.OrderSummariesAsync(payment.Allocations.Select(a => a.OrderId).ToList(), cancellationToken);
        return new PaymentResultDto(dto, orders, await queries.CustomerBalanceAsync(payment.CustomerId, cancellationToken));
    }

    private DateOnly Today() => BusinessTime.LocalDate(clock.UtcNow, Zone);

    private static NotFoundException NotFound() => new("payment.not_found", "ما لقينا الدفعة.");
}
