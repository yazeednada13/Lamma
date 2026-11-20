using Lamma.Domain.Catalog;

namespace Lamma.Domain.Orders;

/// <summary>The seven order statuses (D-020). Codes: new, confirmed, preparing, courier, delivered, cancelled, returned.</summary>
public enum OrderStatus
{
    New,
    Confirmed,
    Preparing,
    Courier,
    Delivered,
    Cancelled,
    Returned,
}

/// <summary>Cancellation reasons (D-130). Codes: changed_mind, no_answer, unavailable, other («other» needs a note).</summary>
public enum CancelReason
{
    ChangedMind,
    NoAnswer,
    Unavailable,
    Other,
}

/// <summary>
/// Allowed manual status changes (D-121): forward only, skipping allowed. Going back is only through undo (D-122).
/// <c>delivered → returned</c> belongs to returns (Phase 8) and is not open yet.
/// </summary>
public static class OrderStatusPolicy
{
    /// <summary>A status change can be undone for 5 minutes on the server clock (D-122).</summary>
    public static readonly TimeSpan UndoWindow = TimeSpan.FromMinutes(5);

    private static readonly Dictionary<OrderStatus, OrderStatus[]> Allowed = new()
    {
        [OrderStatus.New] = [OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Courier, OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Preparing, OrderStatus.Courier, OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Preparing] = [OrderStatus.Courier, OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Courier] = [OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = [],
        [OrderStatus.Returned] = [],
    };

    /// <summary>Statuses that hold stock reserved for the order (D-024): confirmed, preparing, courier.</summary>
    public static bool IsReserving(OrderStatus status) => status is OrderStatus.Confirmed or OrderStatus.Preparing or OrderStatus.Courier;

    public static bool CanChange(OrderStatus from, OrderStatus to) => Allowed[from].Contains(to);

    public static IReadOnlyList<OrderStatus> AllowedNext(OrderStatus from) => Allowed[from];

    /// <summary>The usual next step (the "next" button), or null for a final status.</summary>
    public static OrderStatus? NextStep(OrderStatus from) => from switch
    {
        OrderStatus.New => OrderStatus.Confirmed,
        OrderStatus.Confirmed => OrderStatus.Preparing,
        OrderStatus.Preparing => OrderStatus.Courier,
        OrderStatus.Courier => OrderStatus.Delivered,
        _ => null,
    };

    /// <summary>Items, quantities, prices, fee and discount can change only while the order is new (D-127).</summary>
    public static bool CanEditItems(OrderStatus status) => status == OrderStatus.New;

    /// <summary>Address, recipient, gift message and note can change until the order is delivered or closed (D-127).</summary>
    public static bool CanEditDetails(OrderStatus status) => status is OrderStatus.New or OrderStatus.Confirmed or OrderStatus.Preparing or OrderStatus.Courier;

    public static string Label(OrderStatus status) => status switch
    {
        OrderStatus.New => "جديد",
        OrderStatus.Confirmed => "مؤكد",
        OrderStatus.Preparing => "قيد التجهيز",
        OrderStatus.Courier => "مع المندوب",
        OrderStatus.Delivered => "تم التوصيل",
        OrderStatus.Cancelled => "ملغي",
        _ => "مرتجع",
    };
}

/// <summary>Per-unit stock effect of moving an order between two statuses.</summary>
public readonly record struct StockEffect(StockMovementType? MovementType, int OnHandPerUnit, int ReservedPerUnit)
{
    /// <summary>Change of Available per unit; negative means the order needs that much available stock.</summary>
    public int AvailablePerUnit => OnHandPerUnit - ReservedPerUnit;
}

/// <summary>
/// DATABASE-DESIGN §6 (D-024–D-026) as a pure function. Each status holds stock in one of three states:
/// nothing (new, cancelled), reserved (confirmed, preparing, courier) or sold (delivered). The effect of a move is the
/// difference between the two states, so skips (D-121) and undo moves (D-122) use the same rule:
/// reserve, release, sale (on hand and reserved down) and a sale undo (a <c>sale</c> movement with positive deltas).
/// </summary>
public static class InventoryEffectCalculator
{
    public static StockEffect For(OrderStatus from, OrderStatus to)
    {
        var (fromReserved, fromSold) = State(from);
        var (toReserved, toSold) = State(to);
        var reserved = toReserved - fromReserved;
        var onHand = -(toSold - fromSold);
        StockMovementType? type = onHand != 0 ? StockMovementType.Sale
            : reserved > 0 ? StockMovementType.Reserve
            : reserved < 0 ? StockMovementType.Release
            : null;
        return new StockEffect(type, onHand, reserved);
    }

    private static (int Reserved, int Sold) State(OrderStatus status) => status switch
    {
        OrderStatus.New or OrderStatus.Cancelled => (0, 0),
        OrderStatus.Confirmed or OrderStatus.Preparing or OrderStatus.Courier => (1, 0),
        OrderStatus.Delivered => (0, 1),
        _ => throw new InvalidOperationException("Returns are handled by the returns flow (Phase 8)."),
    };
}
