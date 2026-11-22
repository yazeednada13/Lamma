using Lamma.Domain.Common;

namespace Lamma.Domain.Orders;

/// <summary>One returned line of a return request: which order item, how many pieces, and whether they go back to stock (D-147).</summary>
public readonly record struct ReturnLineRequest(Guid OrderItemId, int Quantity, bool Restock);

/// <summary>
/// A return of some or all pieces of a delivered order (D-145–D-150). Part of the order aggregate; final in V1.
/// <see cref="Amount"/> is this return's share of the order's returned value (pieces × unit price − their discount share).
/// </summary>
public sealed class OrderReturn : Entity, IBusinessOwned
{
    public const int ReasonMaxLength = 200;

    private readonly List<OrderReturnLine> _lines = [];

    internal OrderReturn(Order order, DateOnly returnedOn, string? reason, Guid operationId, DateTime nowUtc)
        : base(NewId())
    {
        BusinessId = order.BusinessId;
        OrderId = order.Id;
        ReturnedOn = returnedOn;
        Reason = reason;
        OperationId = operationId;
        RecordedAt = nowUtc;
    }

    private OrderReturn()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid OrderId { get; private set; }

    /// <summary>Business-local date of the return; returns count in this date's period (D-149).</summary>
    public DateOnly ReturnedOn { get; private set; }

    public string? Reason { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>The «استرداد» payment of this return, when money went back to the customer (D-148).</summary>
    public Guid? RefundPaymentId { get; private set; }

    public Guid OperationId { get; private set; }

    public DateTime RecordedAt { get; private set; }

    public IReadOnlyCollection<OrderReturnLine> Lines => _lines;

    internal void AddLine(OrderItem item, int quantity, bool restock) => _lines.Add(new OrderReturnLine(this, item, quantity, restock));

    internal void SetAmount(decimal amount) => Amount = amount;

    public void LinkRefund(Guid paymentId) => RefundPaymentId = paymentId;
}

/// <summary>A returned quantity of one order item, restocked or damaged (D-147).</summary>
public sealed class OrderReturnLine : Entity, IBusinessOwned
{
    internal OrderReturnLine(OrderReturn orderReturn, OrderItem item, int quantity, bool restock)
        : base(NewId())
    {
        BusinessId = orderReturn.BusinessId;
        ReturnId = orderReturn.Id;
        OrderItemId = item.Id;
        Quantity = quantity;
        Restocked = restock;
    }

    private OrderReturnLine()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid ReturnId { get; private set; }

    public Guid OrderItemId { get; private set; }

    public int Quantity { get; private set; }

    /// <summary>True: back to stock with a <c>return</c> movement. False: damaged, no stock change (its cost stays a loss).</summary>
    public bool Restocked { get; private set; }
}

/// <summary>Refund bounds of a return (D-148): no customer credit, never more than paid or than the returned value.</summary>
public readonly record struct RefundRange(decimal Minimum, decimal Maximum)
{
    public bool Contains(decimal amount) => amount >= Minimum && amount <= Maximum;

    /// <param name="paid">What the customer paid on the order before this return (net of earlier refunds).</param>
    /// <param name="netTotalAfter">The order's net total after this return.</param>
    /// <param name="returnValue">This return's value.</param>
    public static RefundRange For(decimal paid, decimal netTotalAfter, decimal returnValue)
        => new(Math.Max(0, paid - netTotalAfter), Math.Max(0, Math.Min(paid, returnValue)));
}
