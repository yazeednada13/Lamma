using Lamma.Application.Businesses;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Customers;
using Lamma.Application.Inventory;
using Lamma.Application.Payments;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;

namespace Lamma.Application.Orders;

// ---------- Ports (Infrastructure) ----------

public interface IOrderRepository
{
    /// <summary>The order of the current business with its items and status log, tracked for update.</summary>
    Task<Order?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Allocates the next order number of the current business (D-123). Must run inside the creating transaction.</summary>
    Task<int> NextOrderNumberAsync(CancellationToken cancellationToken);

    void Add(Order order);
}

public interface IOrderQueries
{
    Task<PagedResult<OrderListItemDto>> ListAsync(OrderListQuery query, CancellationToken cancellationToken);

    /// <summary>Counts per status for the same search, date, customer and product filters (the status filter is ignored).</summary>
    Task<OrderStatusCountsDto> StatusCountsAsync(OrderListQuery query, CancellationToken cancellationToken);

    Task<OrderDetailsDto?> GetAsync(Guid id, DateTime nowUtc, CancellationToken cancellationToken);

    /// <summary>Active pre-orders (not cancelled, returned or delivered) expected between the two dates.</summary>
    Task<IReadOnlyList<PreOrderDto>> PreOrdersAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface IOrderService
{
    Task<PagedResult<OrderListItemDto>> ListAsync(OrderListQuery query, CancellationToken cancellationToken);

    Task<OrderStatusCountsDto> StatusCountsAsync(OrderListQuery query, CancellationToken cancellationToken);

    Task<OrderDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<OrderDetailsDto> CreateAsync(Guid idempotencyKey, CreateOrderRequest request, CancellationToken cancellationToken);

    Task<OrderDetailsDto> UpdateAsync(Guid id, UpdateOrderRequest request, CancellationToken cancellationToken);

    Task<OrderDetailsDto> UpdateDetailsAsync(Guid id, UpdateOrderDetailsRequest request, CancellationToken cancellationToken);

    Task<OrderDetailsDto> ChangeStatusAsync(Guid id, Guid idempotencyKey, ChangeOrderStatusRequest request, CancellationToken cancellationToken);

    Task<OrderDetailsDto> UndoAsync(Guid id, Guid idempotencyKey, UndoOrderStatusRequest request, CancellationToken cancellationToken);

    Task<OrderDetailsDto> ReturnAsync(Guid id, Guid idempotencyKey, ReturnOrderRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<PreOrderDto>> PreOrdersAsync(PreOrderQuery query, CancellationToken cancellationToken);
}

/// <summary>
/// Orders core (Phase 5). Create, status change and undo are idempotent (D-112) and run in one transaction with their
/// stock effects, movements and log row (D-026). A lost race on a versioned row is retried once against fresh data,
/// so a request that loses the last piece gets <c>stock.not_available</c> and a stale status gets <c>order.status_changed</c>.
/// </summary>
internal sealed class OrderService(
    ICurrentBusiness currentBusiness,
    IOrderRepository orders,
    IOrderQueries queries,
    ICustomerRepository customers,
    IInventoryRepository inventory,
    IPaymentRepository payments,
    IBusinessSettingsQueries settings,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : IOrderService
{
    private static readonly TimeZoneInfo Zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);

    public Task<PagedResult<OrderListItemDto>> ListAsync(OrderListQuery query, CancellationToken cancellationToken) => queries.ListAsync(query, cancellationToken);

    public Task<OrderStatusCountsDto> StatusCountsAsync(OrderListQuery query, CancellationToken cancellationToken) => queries.StatusCountsAsync(query, cancellationToken);

    public async Task<OrderDetailsDto> GetAsync(Guid id, CancellationToken cancellationToken)
        => await queries.GetAsync(id, clock.UtcNow, cancellationToken) ?? throw NotFound();

    public Task<OrderDetailsDto> CreateAsync(Guid idempotencyKey, CreateOrderRequest request, CancellationToken cancellationToken)
        => RetryOnceAsync(() => idempotency.ExecuteAsync(idempotencyKey, request, ct => CreateCoreAsync(request, ct), cancellationToken));

    public Task<OrderDetailsDto> ChangeStatusAsync(Guid id, Guid idempotencyKey, ChangeOrderStatusRequest request, CancellationToken cancellationToken)
        => RetryOnceAsync(() => idempotency.ExecuteAsync(idempotencyKey, new { id, request }, ct => ChangeStatusCoreAsync(id, request, ct), cancellationToken));

    public Task<OrderDetailsDto> UndoAsync(Guid id, Guid idempotencyKey, UndoOrderStatusRequest request, CancellationToken cancellationToken)
        => RetryOnceAsync(() => idempotency.ExecuteAsync(idempotencyKey, new { id, request }, ct => UndoCoreAsync(id, request, ct), cancellationToken));

    public Task<OrderDetailsDto> ReturnAsync(Guid id, Guid idempotencyKey, ReturnOrderRequest request, CancellationToken cancellationToken)
        => RetryOnceAsync(() => idempotency.ExecuteAsync(idempotencyKey, new { id, request }, ct => ReturnCoreAsync(id, request, ct), cancellationToken));

    public Task<IReadOnlyList<PreOrderDto>> PreOrdersAsync(PreOrderQuery query, CancellationToken cancellationToken)
    {
        var today = BusinessTime.LocalDate(clock.UtcNow, Zone);
        return queries.PreOrdersAsync(query.From ?? today, query.To ?? (query.From ?? today).AddDays(13), cancellationToken);
    }

    public async Task<OrderDetailsDto> UpdateAsync(Guid id, UpdateOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await orders.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        if (!OrderStatusPolicy.CanEditItems(order.Status))
        {
            throw new DomainConflictException("order.locked", "المنتجات بتنعدّل بس والطلب «جديد». ألغِ الطلب واعمل طلب جديد.");
        }

        var channel = EnumCode.Parse<SalesChannel>(request.Channel);
        var method = PaymentMethodOf(request.PaymentMethod);
        await EnsureEnabledAsync(channel == order.Channel ? null : channel, method == order.PaymentMethodHint ? null : method, cancellationToken);
        var (lines, _) = await LinesAsync(request.Items, cancellationToken);
        order.ReplaceItems(channel, lines, request.DeliveryFee, request.Discount, method);
        order.Schedule(request.ExpectedDeliveryOn, OrderValidation.ParseTime(request.ExpectedDeliveryTime), Today());
        if (order.Total < await payments.PaidAsync(id, cancellationToken))
        {
            // D-132: paid never exceeds the total. A deposit recorded meanwhile bumps the rowversion, so the save fails.
            throw new ConflictException("order.total_below_paid", "مجموع الطلب صار أقل من المدفوع. ألغِ الدفعة الزايدة أول.");
        }

        order.UpdateDetails(Delivery(request.DeliveryAddress, request.IsGift, request.RecipientName, request.RecipientPhone, request.GiftMessage), request.Note);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<OrderDetailsDto> UpdateDetailsAsync(Guid id, UpdateOrderDetailsRequest request, CancellationToken cancellationToken)
    {
        var order = await orders.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        order.UpdateDetails(Delivery(request.DeliveryAddress, request.IsGift, request.RecipientName, request.RecipientPhone, request.GiftMessage), request.Note);
        order.Schedule(request.ExpectedDeliveryOn, OrderValidation.ParseTime(request.ExpectedDeliveryTime), Today());
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private async Task<OrderDetailsDto> CreateCoreAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetForUpdateAsync(request.CustomerId, cancellationToken)
            ?? throw new NotFoundException("order.customer_not_found", "ما لقينا العميل.");
        if (customer.IsArchived)
        {
            throw new ConflictException("order.customer_archived", "العميل مؤرشف. استرجعه أول.");
        }

        var channel = EnumCode.Parse<SalesChannel>(request.Channel);
        var method = PaymentMethodOf(request.PaymentMethod);
        await EnsureEnabledAsync(channel, method, cancellationToken);

        // The number lock is taken first and held until commit, so concurrent creates of one business run one after
        // another and each reads the stock committed by the previous one (no lost race on the variants).
        var number = await orders.NextOrderNumberAsync(cancellationToken);
        var (lines, variants) = await LinesAsync(request.Items, cancellationToken);
        var now = clock.UtcNow;
        var order = Order.Create(
            currentBusiness.BusinessId,
            number,
            customer.Id,
            channel,
            lines,
            request.DeliveryFee,
            request.Discount,
            method,
            Delivery(request.DeliveryAddress, request.IsGift, request.RecipientName, request.RecipientPhone, request.GiftMessage),
            request.Note,
            now);
        order.Schedule(request.ExpectedDeliveryOn, OrderValidation.ParseTime(request.ExpectedDeliveryTime), BusinessTime.LocalDate(now, Zone)); // D-151
        orders.Add(order);

        if (request.Status == "confirmed")
        {
            inventory.AddMovements(order.ChangeStatus(OrderStatus.Confirmed, null, null, variants, Entity.NewId(), now)); // D-128
        }

        if (request.Payment is { } deposit)
        {
            // D-135: a deposit is an early payment, saved in the order's transaction and dated today.
            var depositMethod = await PaymentService.RecordableMethodAsync(settings, currentBusiness.BusinessId, deposit.Method, "payment.method", cancellationToken);
            var today = BusinessTime.LocalDate(now, Zone);
            payments.Add(Payment.ForOrder(currentBusiness.BusinessId, customer.Id, order.Id, order.Total, deposit.Amount, depositMethod, today, today, today, null, Entity.NewId(), now));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(order.Id, cancellationToken);
    }

    private async Task<OrderDetailsDto> ChangeStatusCoreAsync(Guid id, ChangeOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var order = await orders.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        var expected = EnumCode.Parse<OrderStatus>(request.ExpectedStatus);
        if (order.Status != expected)
        {
            throw StatusChanged(order.Status);
        }

        var to = EnumCode.Parse<OrderStatus>(request.To);
        if (to == OrderStatus.Cancelled && await payments.HasActivePaymentsAsync(id, cancellationToken))
        {
            // D-137. A payment recorded meanwhile bumps the order's rowversion, so this check is retried, never skipped.
            throw new ConflictException("order.has_payments", "على الطلب دفعات. ألغِ الدفعات أول، بعدين ألغِ الطلب.");
        }

        var variants = await VariantsOfAsync(order, cancellationToken);
        var reason = request.CancelReason is null ? (CancelReason?)null : EnumCode.Parse<CancelReason>(request.CancelReason);
        inventory.AddMovements(order.ChangeStatus(to, reason, request.CancelNote, variants, Entity.NewId(), clock.UtcNow));
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private async Task<OrderDetailsDto> UndoCoreAsync(Guid id, UndoOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var order = await orders.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        var variants = await VariantsOfAsync(order, cancellationToken);
        inventory.AddMovements(order.Undo(request.ChangeId, variants, Entity.NewId(), clock.UtcNow));
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    /// <summary>
    /// A return (D-145–D-150): the order and its variants are versioned, so a payment or status change meanwhile makes
    /// this retry once on fresh data. The refund (D-148) must lie in the range that leaves no customer credit; it is
    /// a «استرداد» payment saved in the same transaction.
    /// </summary>
    private async Task<OrderDetailsDto> ReturnCoreAsync(Guid id, ReturnOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await orders.GetForUpdateAsync(id, cancellationToken) ?? throw NotFound();
        var paid = await payments.PaidAsync(id, cancellationToken);
        var variants = await VariantsOfAsync(order, cancellationToken);
        var now = clock.UtcNow;
        var today = BusinessTime.LocalDate(now, Zone);
        var deliveredOn = order.DeliveredAt is { } at ? BusinessTime.LocalDate(at, Zone) : today;
        var (orderReturn, movements) = order.Return(
            request.Lines.Select(l => new ReturnLineRequest(l.OrderItemId, l.Quantity, l.Restock)).ToList(),
            variants,
            request.ReturnedOn,
            today,
            deliveredOn,
            request.Reason,
            Entity.NewId(),
            now);

        var range = RefundRange.For(paid, order.NetTotal, orderReturn.Amount);
        var refund = request.Refund?.Amount ?? 0m;
        if (!range.Contains(refund))
        {
            throw new ConflictException(
                "return.refund_out_of_range",
                range.Minimum == range.Maximum
                    ? $"المبلغ المسترد لازم يكون {range.Minimum:0.00} د.أ."
                    : $"المبلغ المسترد لازم يكون بين {range.Minimum:0.00} و {range.Maximum:0.00} د.أ.",
                new Dictionary<string, object?> { ["minimum"] = range.Minimum, ["maximum"] = range.Maximum });
        }

        if (refund > 0)
        {
            var method = await PaymentService.RecordableMethodAsync(settings, currentBusiness.BusinessId, request.Refund!.Method, "refund.method", cancellationToken);
            var payment = Domain.Payments.Payment.ForRefund(currentBusiness.BusinessId, order.CustomerId, order.Id, refund, method, request.ReturnedOn, today, Entity.NewId(), now);
            payments.Add(payment);
            orderReturn.LinkRefund(payment.Id);
        }

        inventory.AddMovements(movements);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private DateOnly Today() => BusinessTime.LocalDate(clock.UtcNow, Zone);

    /// <summary>Builds the line snapshots from the current catalog. Another business's variant is not found (404).</summary>
    private async Task<(List<OrderLine> Lines, Dictionary<Guid, ProductVariant> Variants)> LinesAsync(IReadOnlyList<OrderItemRequest> items, CancellationToken cancellationToken)
    {
        var products = await inventory.GetProductsForVariantsAsync(items.Select(i => i.VariantId).ToList(), cancellationToken);
        var byVariant = products.SelectMany(p => p.Variants.Select(v => (Product: p, Variant: v))).ToDictionary(x => x.Variant.Id);
        var lines = items.Select(i => byVariant.TryGetValue(i.VariantId, out var match)
                ? OrderLine.From(match.Product, match.Variant, i.Quantity, i.UnitPrice)
                : throw new NotFoundException("order.variant_not_found", "ما لقينا المنتج أو النسخة."))
            .ToList();
        return (lines, byVariant.ToDictionary(kv => kv.Key, kv => kv.Value.Variant));
    }

    private async Task<Dictionary<Guid, ProductVariant>> VariantsOfAsync(Order order, CancellationToken cancellationToken)
    {
        var products = await inventory.GetProductsForVariantsAsync(order.Items.Select(i => i.VariantId).ToList(), cancellationToken);
        return products.SelectMany(p => p.Variants).ToDictionary(v => v.Id);
    }

    /// <summary>The order's channel and expected payment method must be enabled in settings (checked when set or changed).</summary>
    private async Task EnsureEnabledAsync(SalesChannel? channel, PaymentMethod? method, CancellationToken cancellationToken)
    {
        if (channel is { } c && !(await settings.GetSalesChannelsAsync(currentBusiness.BusinessId, cancellationToken)).Any(r => r.Value == c && r.IsEnabled))
        {
            throw RequestValidationException.ForField("channel", "قناة البيع هاي مش مفعّلة بالإعدادات.", "order.channel_disabled");
        }

        if (method is { } m && !(await settings.GetPaymentMethodsAsync(currentBusiness.BusinessId, cancellationToken)).Any(r => r.Value == m && r.IsEnabled))
        {
            throw RequestValidationException.ForField("paymentMethod", "طريقة الدفع هاي مش مفعّلة بالإعدادات.", "order.payment_method_disabled");
        }
    }

    /// <summary>One retry after losing a race on a versioned row; the idempotency service already rolled back and cleared state.</summary>
    private static async Task<T> RetryOnceAsync<T>(Func<Task<T>> run)
    {
        try
        {
            return await run();
        }
        catch (ConflictException ex) when (ex.Code == "concurrency.conflict")
        {
            return await run();
        }
    }

    private static PaymentMethod? PaymentMethodOf(string? code) => code is null ? null : EnumCode.Parse<PaymentMethod>(code);

    private static OrderDelivery Delivery(string? address, bool isGift, string? recipientName, string? recipientPhone, string? giftMessage)
        => new(address, isGift, recipientName, recipientPhone, giftMessage);

    private static ConflictException StatusChanged(OrderStatus current)
        => new(
            "order.status_changed",
            $"حالة الطلب تغيّرت وصارت «{OrderStatusPolicy.Label(current)}». حدّث الصفحة.",
            new Dictionary<string, object?> { ["currentStatus"] = current.ToCode() });

    private static NotFoundException NotFound() => new("order.not_found", "ما لقينا الطلب.");
}
