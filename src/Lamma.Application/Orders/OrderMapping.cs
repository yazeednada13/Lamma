using Lamma.Application.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;

namespace Lamma.Application.Orders;

/// <summary>Builds order DTOs from the aggregate (server-computed totals, profit, allowed moves and the undo window).</summary>
public static class OrderMapping
{
    public static OrderDetailsDto ToDetails(Order order, OrderCustomerDto customer, IReadOnlyDictionary<Guid, string?> imagePaths, DateTime nowUtc)
    {
        var undoable = order.UndoableChange(nowUtc);
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
                i.LineTotal))
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
            order.UpdatedAt);
    }
}
