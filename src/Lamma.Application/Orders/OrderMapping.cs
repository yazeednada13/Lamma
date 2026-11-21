using Lamma.Application.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;

namespace Lamma.Application.Orders;

/// <summary>Builds order DTOs from the aggregate (server-computed totals, profit, allowed moves and the undo window).</summary>
public static class OrderMapping
{
    public static OrderDetailsDto ToDetails(
        Order order,
        OrderCustomerDto customer,
        IReadOnlyDictionary<Guid, string?> imagePaths,
        IReadOnlyList<OrderPaymentDto> payments,
        DateTime nowUtc)
    {
        var undoable = order.UndoableChange(nowUtc);
        var paid = payments.Where(p => !p.IsReversed).Sum(p => p.Amount); // D-131: Σ active allocations
        var timeline = order.StatusLogs
            .OrderBy(l => l.Sequence)
            .Select(l => new OrderStatusChangeDto(l.Id, l.FromStatus?.ToCode(), l.ToStatus.ToCode(), l.ChangedAt, l.IsUndo, l.Reason?.ToCode(), l.Note))
            .ToList();
        var items = order.Items
            .Select(i => new OrderItemDto(
                i.Id,
                i.ProductId,
                i.VariantId,
                i.ProductName,
                i.VariantLabel,
                CatalogMapping.ImageUrl(i.ProductId, imagePaths.GetValueOrDefault(i.ProductId)),
                i.Quantity,
                i.UnitPrice,
                i.UnitCost,
                i.LineTotal,
                order.ReturnedQuantity(i.Id)))
            .ToList();
        var itemsById = order.Items.ToDictionary(i => i.Id);
        var returns = order.Returns
            .OrderBy(r => r.RecordedAt)
            .Select(r =>
            {
                var refund = r.RefundPaymentId is { } refundId ? payments.FirstOrDefault(p => p.PaymentId == refundId) : null;
                return new OrderReturnDto(
                    r.Id,
                    r.ReturnedOn,
                    r.Amount,
                    r.Reason,
                    refund is null || refund.IsReversed ? 0 : refund.PaymentAmount,
                    refund?.Method,
                    r.RecordedAt,
                    r.Lines.Select(l => new OrderReturnLineDto(l.OrderItemId, itemsById[l.OrderItemId].ProductName, itemsById[l.OrderItemId].VariantLabel, l.Quantity, l.Restocked)).ToList());
            })
            .ToList();

        return new OrderDetailsDto(
            order.Id,
            order.OrderNumber,
            customer,
            order.Channel.ToCode(),
            order.Status.ToCode(),
            OrderStatusPolicy.NextStep(order.Status)?.ToCode(),
            OrderStatusPolicy.AllowedNext(order.Status).Select(s => s.ToCode()).ToList(),
            OrderStatusPolicy.CanEditItems(order.Status),
            OrderStatusPolicy.CanEditDetails(order.Status),
            items,
            order.Items.Sum(i => i.Quantity),
            order.ItemsSubtotal,
            order.DeliveryFee,
            order.Discount,
            order.Total,
            order.ItemsCost,
            order.Profit,
            order.PaymentMethodHint?.ToCode(),
            order.DeliveryAddress,
            order.IsGift,
            order.RecipientName,
            order.RecipientPhone,
            order.GiftMessage,
            order.Note,
            order.CancelReason?.ToCode(),
            order.CancelNote,
            timeline,
            undoable is null ? null : new OrderUndoDto(undoable.Id, undoable.ToStatus.ToCode(), undoable.FromStatus!.Value.ToCode(), undoable.ChangedAt + OrderStatusPolicy.UndoWindow),
            order.CreatedAt,
            order.ConfirmedAt,
            order.DeliveredAt,
            order.CancelledAt,
            order.UpdatedAt,
            paid,
            order.NetTotal - paid,
            PaymentStatusPolicy.For(order.Status, order.PaymentMethodHint, order.NetTotal, paid)?.ToCode(),
            payments,
            order.ReturnedAmount,
            order.NetTotal,
            order.IsPartiallyReturned,
            order.Status == OrderStatus.Delivered,
            returns,
            order.ExpectedDeliveryOn,
            order.ExpectedDeliveryTime?.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture));
    }
}
