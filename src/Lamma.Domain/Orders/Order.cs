using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;

namespace Lamma.Domain.Orders;

/// <summary>One requested line of an order, with the price and cost snapshots taken when it is saved (D-032).</summary>
public sealed class OrderLine
{
    private OrderLine(Guid productId, Guid variantId, string productName, string? variantLabel, int quantity, decimal unitPrice, decimal unitCost)
    {
        ProductId = productId;
        VariantId = variantId;
        ProductName = productName;
        VariantLabel = variantLabel;
        Quantity = quantity;
        UnitPrice = unitPrice;
        UnitCost = unitCost;
    }

    public Guid ProductId { get; }

    public Guid VariantId { get; }

    public string ProductName { get; }

    public string? VariantLabel { get; }

    public int Quantity { get; }

    public decimal UnitPrice { get; }

    public decimal UnitCost { get; }

    /// <summary>
    /// Builds a line from the current catalog: the unit price is the variant's effective price unless the merchant set one;
    /// the unit cost is always the variant's effective cost. Archived products or variants cannot be sold.
    /// </summary>
    public static OrderLine From(Product product, ProductVariant variant, int quantity, decimal? unitPrice)
    {
        if (product.IsArchived || variant.IsArchived)
        {
            throw new DomainConflictException("order.item_archived", $"«{product.Name}» مؤرشف، ما بنقدر نبيعه.");
        }

        if (quantity < 1 || quantity > Order.MaxLineQuantity)
        {
            throw new DomainException("order.invalid_quantity", $"الكمية لازم تكون بين 1 و {Order.MaxLineQuantity}.");
        }

        var price = unitPrice ?? product.EffectivePrice(variant);
        if (price <= 0 || price > Product.MaxMoney || !MoneyMath.HasValidScale(price))
        {
            throw new DomainException("order.invalid_price", "سعر القطعة لازم يكون أكبر من صفر.");
        }

        return new OrderLine(product.Id, variant.Id, product.Name, variant.IsDefault ? null : string.Join(" · ", variant.Values), quantity, price, product.EffectiveCost(variant));
    }
}

/// <summary>Delivery and gift details (D-129). Recipient fields apply only to a gift.</summary>
public sealed class OrderDelivery(string? address, bool isGift, string? recipientName, string? recipientPhone, string? giftMessage)
{
    public string? Address { get; } = address;

    public bool IsGift { get; } = isGift;

    public string? RecipientName { get; } = recipientName;

    public string? RecipientPhone { get; } = recipientPhone;

    public string? GiftMessage { get; } = giftMessage;
}

/// <summary>
/// Order aggregate (D-020, D-031, D-121–D-130). Totals are computed here from the line snapshots, never sent by clients.
/// Every status change goes through <see cref="ChangeStatus"/> or <see cref="Undo"/>, which apply the stock effect to the
/// given variants, return the stock movements and append a status-log row: all saved in one transaction by the caller.
/// </summary>
public sealed class Order : Entity, IBusinessOwned, IHasTimestamps
{
    public const int FirstNumber = 1001;
    public const int MaxItems = 50;
    public const int MaxLineQuantity = 1000;
    public const int AddressMaxLength = 200;
    public const int RecipientNameMaxLength = 100;
    public const int GiftMessageMaxLength = 300;
    public const int NoteMaxLength = 500;
    public const int CancelNoteMaxLength = 200;

    private readonly List<OrderItem> _items = [];
    private readonly List<OrderStatusLog> _statusLogs = [];

    private Order(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private Order()
    {
    }

    public Guid BusinessId { get; private set; }

    public int OrderNumber { get; private set; }

    public Guid CustomerId { get; private set; }

    public SalesChannel Channel { get; private set; }

    public OrderStatus Status { get; private set; }

    public decimal ItemsSubtotal { get; private set; }

    public decimal DeliveryFee { get; private set; }

    public decimal Discount { get; private set; }

    public decimal Total { get; private set; }

    /// <summary>The payment method expected at creation (recording payments is Phase 6).</summary>
    public PaymentMethod? PaymentMethodHint { get; private set; }

    public string? DeliveryAddress { get; private set; }

    public bool IsGift { get; private set; }

    public string? RecipientName { get; private set; }

    public string? RecipientPhone { get; private set; }

    public string? GiftMessage { get; private set; }

    public string? Note { get; private set; }

    public CancelReason? CancelReason { get; private set; }

    public string? CancelNote { get; private set; }

    public DateTime? ConfirmedAt { get; private set; }

    public DateTime? DeliveredAt { get; private set; }

    public DateTime? CancelledAt { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public IReadOnlyCollection<OrderItem> Items => _items;

    public IReadOnlyCollection<OrderStatusLog> StatusLogs => _statusLogs;

    /// <summary>Display number (D-123), also the stock movement label.</summary>
    public string Label => "#" + OrderNumber;

    /// <summary>Cost of the items at the time of sale (COGS, D-031).</summary>
    public decimal ItemsCost => MoneyMath.Round(_items.Sum(i => i.Quantity * i.UnitCost));

    /// <summary>"ربحك من الطلب" (D-125): items − discount − cost of items. The delivery fee is shown separately.</summary>
    public decimal Profit => ItemsSubtotal - Discount - ItemsCost;

    public static Order Create(
        Guid businessId,
        int orderNumber,
        Guid customerId,
        SalesChannel channel,
        IReadOnlyList<OrderLine> lines,
        decimal deliveryFee,
        decimal discount,
        PaymentMethod? paymentMethodHint,
        OrderDelivery delivery,
        string? note,
        DateTime nowUtc)
    {
        if (orderNumber < FirstNumber)
        {
            throw new ArgumentOutOfRangeException(nameof(orderNumber));
        }

        Guard.NotEmpty(customerId, nameof(customerId));
        var order = new Order(NewId(), businessId)
        {
            OrderNumber = orderNumber,
            CustomerId = customerId,
            Status = OrderStatus.New,
            CreatedAt = nowUtc,
        };
        order.SetItems(channel, lines, deliveryFee, discount, paymentMethodHint);
        order.SetDetails(delivery, note);
        order._statusLogs.Add(OrderStatusLog.Create(order, null, OrderStatus.New, Entity.NewId(), nowUtc, isUndo: false, undoOfLogId: null, reason: null, note: null));
        return order;
    }

    /// <summary>Replaces the items, fee, discount, channel and expected payment method. Only while the order is new (D-127).</summary>
    public void ReplaceItems(SalesChannel channel, IReadOnlyList<OrderLine> lines, decimal deliveryFee, decimal discount, PaymentMethod? paymentMethodHint)
    {
        if (!OrderStatusPolicy.CanEditItems(Status))
        {
            throw new DomainConflictException("order.locked", "المنتجات بتنعدّل بس والطلب «جديد». ألغِ الطلب واعمل طلب جديد.");
        }

        SetItems(channel, lines, deliveryFee, discount, paymentMethodHint);
    }

    /// <summary>Updates the address, gift details and note until the order is delivered or closed (D-127).</summary>
    public void UpdateDetails(OrderDelivery delivery, string? note)
    {
        if (!OrderStatusPolicy.CanEditDetails(Status))
        {
            throw new DomainConflictException("order.locked", "الطلب مسكّر، ما بنقدر نعدّل تفاصيله.");
        }

        SetDetails(delivery, note);
    }

    /// <summary>
    /// Moves the order forward (D-121) and applies the stock effect to <paramref name="variants"/> (all variants of the
    /// order, freshly loaded and versioned). Returns the stock movements to save with the order.
    /// </summary>
    public IReadOnlyList<StockMovement> ChangeStatus(OrderStatus to, CancelReason? reason, string? cancelNote, IReadOnlyDictionary<Guid, ProductVariant> variants, Guid operationId, DateTime nowUtc)
    {
        var from = Status;
        if (from == to || !OrderStatusPolicy.CanChange(from, to))
        {
            throw new DomainConflictException("order.invalid_transition", $"ما بنقدر ننقل الطلب من «{OrderStatusPolicy.Label(from)}» لـ «{OrderStatusPolicy.Label(to)}».");
        }

        string? note = null;
        if (to == OrderStatus.Cancelled)
        {
            if (reason is null)
            {
                throw new DomainException("order.cancel_reason_required", "اختار سبب الإلغاء.");
            }

            note = Clean(cancelNote, CancelNoteMaxLength, "سبب الإلغاء");
            if (reason == Orders.CancelReason.Other && note is null)
            {
                throw new DomainException("order.cancel_note_required", "اكتب سبب الإلغاء.");
            }
        }

        var movements = ApplyStock(from, to, variants, operationId, nowUtc, Label);
        Status = to;
        if (from == OrderStatus.New && to != OrderStatus.Cancelled)
        {
            ConfirmedAt ??= nowUtc;
        }

        if (to == OrderStatus.Delivered)
        {
            DeliveredAt = nowUtc;
        }

        if (to == OrderStatus.Cancelled)
        {
            CancelledAt = nowUtc;
            CancelReason = reason;
            CancelNote = note;
        }

        _statusLogs.Add(OrderStatusLog.Create(this, from, to, operationId, nowUtc, isUndo: false, undoOfLogId: null, reason: to == OrderStatus.Cancelled ? reason : null, note: note));
        return movements;
    }

    /// <summary>The latest status change, if it can still be undone now (D-122).</summary>
    public OrderStatusLog? UndoableChange(DateTime nowUtc)
    {
        var latest = LatestLog();
        return latest is { IsUndo: false, FromStatus: not null } && nowUtc - latest.ChangedAt <= OrderStatusPolicy.UndoWindow ? latest : null;
    }

    /// <summary>
    /// Reverts the latest status change <paramref name="changeId"/> with a compensating move (D-122): reverse stock
    /// movements and an undo log row. Never restores a snapshot, so other operations are untouched.
    /// </summary>
    public IReadOnlyList<StockMovement> Undo(Guid changeId, IReadOnlyDictionary<Guid, ProductVariant> variants, Guid operationId, DateTime nowUtc)
    {
        var latest = LatestLog()!;
        if (latest.Id != changeId)
        {
            throw new DomainConflictException("order.undo_not_latest", "صار على الطلب تغيير بعد هاد، ما بنقدر نتراجع عنه.");
        }

        if (latest.IsUndo || latest.FromStatus is null)
        {
            throw new DomainConflictException("order.undo_not_available", "ما في تغيير نتراجع عنه.");
        }

        if (nowUtc - latest.ChangedAt > OrderStatusPolicy.UndoWindow)
        {
            throw new DomainConflictException("order.undo_expired", "خلصت مدة التراجع (5 دقايق).");
        }

        var from = Status;
        var to = latest.FromStatus.Value;
        var movements = ApplyStock(from, to, variants, operationId, nowUtc, "تراجع " + Label);
        Status = to;
        if (latest.ToStatus == OrderStatus.Delivered)
        {
            DeliveredAt = null;
        }

        if (latest.ToStatus == OrderStatus.Cancelled)
        {
            CancelledAt = null;
            CancelReason = null;
            CancelNote = null;
        }

        if (to == OrderStatus.New)
        {
            ConfirmedAt = null;
        }

        _statusLogs.Add(OrderStatusLog.Create(this, from, to, operationId, nowUtc, isUndo: true, undoOfLogId: latest.Id, reason: null, note: null));
        return movements;
    }

    private OrderStatusLog? LatestLog() => _statusLogs.MaxBy(l => l.Sequence);

    private List<StockMovement> ApplyStock(OrderStatus from, OrderStatus to, IReadOnlyDictionary<Guid, ProductVariant> variants, Guid operationId, DateTime nowUtc, string label)
    {
        var effect = InventoryEffectCalculator.For(from, to);
        if (effect.MovementType is not { } type)
        {
            return [];
        }

        // Check every line before changing any variant, so a shortage leaves the aggregate untouched.
        if (effect.AvailablePerUnit < 0)
        {
            foreach (var item in _items)
            {
                var variant = variants.GetValueOrDefault(item.VariantId) ?? throw new InvalidOperationException("All variants of the order must be loaded.");
                if (variant.Available < item.Quantity * -effect.AvailablePerUnit)
                {
                    throw new DomainConflictException(
                        "stock.not_available",
                        $"الكمية المتوفرة من «{item.DisplayName}» ما بتكفي (المتوفر {Math.Max(variant.Available, 0)}، المطلوب {item.Quantity}).");
                }
            }
        }

        var movements = new List<StockMovement>(_items.Count);
        foreach (var item in _items)
        {
            var variant = variants[item.VariantId];
            var onHand = item.Quantity * effect.OnHandPerUnit;
            var reserved = item.Quantity * effect.ReservedPerUnit;
            variant.ApplyOrderEffect(onHand, reserved);
            movements.Add(StockMovement.ForOrder(BusinessId, item.ProductId, item.VariantId, type, onHand, reserved, item.UnitCost, Id, label, operationId, nowUtc));
        }

        return movements;
    }

    private void SetItems(SalesChannel channel, IReadOnlyList<OrderLine> lines, decimal deliveryFee, decimal discount, PaymentMethod? paymentMethodHint)
    {
        if (lines.Count == 0)
        {
            throw new DomainException("order.items_required", "أضف منتج واحد على الأقل.");
        }

        if (lines.Count > MaxItems)
        {
            throw new DomainException("order.too_many_items", $"الحد الأقصى {MaxItems} منتج بالطلب.");
        }

        if (lines.Select(l => l.VariantId).Distinct().Count() != lines.Count)
        {
            throw new DomainException("order.duplicate_item", "المنتج مكرر بالطلب. زيد الكمية بدل ما تضيفه مرتين.");
        }

        if (deliveryFee < 0 || deliveryFee > Product.MaxMoney || !MoneyMath.HasValidScale(deliveryFee))
        {
            throw new DomainException("order.invalid_delivery_fee", "رسوم التوصيل لازم تكون صفر أو أكثر.");
        }

        var items = lines.Select(l => new OrderItem(this, l)).ToList();
        var subtotal = items.Sum(i => i.LineTotal);
        if (discount < 0 || discount > subtotal || !MoneyMath.HasValidScale(discount))
        {
            throw new DomainException("order.invalid_discount", "الخصم لازم يكون بين صفر ومجموع المنتجات.");
        }

        _items.Clear();
        _items.AddRange(items);
        Channel = channel;
        PaymentMethodHint = paymentMethodHint;
        ItemsSubtotal = subtotal;
        DeliveryFee = deliveryFee;
        Discount = discount;
        Total = subtotal + deliveryFee - discount; // D-031; exact because every part has ≤ 3 decimals
    }

    private void SetDetails(OrderDelivery delivery, string? note)
    {
        DeliveryAddress = Clean(delivery.Address, AddressMaxLength, "العنوان");
        IsGift = delivery.IsGift;
        if (delivery.IsGift)
        {
            RecipientName = Clean(delivery.RecipientName, RecipientNameMaxLength, "اسم المستلم")
                ?? throw new DomainException("order.recipient_required", "اكتب اسم مستلم الهدية.");
            try
            {
                RecipientPhone = PhoneNumber.Normalize(delivery.RecipientPhone);
            }
            catch (DomainException)
            {
                throw new DomainException("order.invalid_recipient_phone", "رقم المستلم غير صحيح. مثال: 0791234567");
            }

            GiftMessage = Clean(delivery.GiftMessage, GiftMessageMaxLength, "رسالة الهدية");
        }
        else
        {
            RecipientName = null;
            RecipientPhone = null;
            GiftMessage = null;
        }

        Note = Clean(note, NoteMaxLength, "الملاحظة");
    }

    private static string? Clean(string? value, int max, string label)
    {
        var trimmed = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (trimmed is not null && trimmed.Length > max)
        {
            throw new DomainException("order.text_too_long", $"{label} لازم يكون {max} حرف أو أقل.");
        }

        return trimmed;
    }
}

/// <summary>An order line with the name, label, price and cost snapshots of the time of sale (D-032).</summary>
public sealed class OrderItem : Entity, IBusinessOwned
{
    public const int ProductNameMaxLength = Product.NameMaxLength;
    public const int VariantLabelMaxLength = 100;

    internal OrderItem(Order order, OrderLine line)
        : base(NewId())
    {
        BusinessId = order.BusinessId;
        OrderId = order.Id;
        ProductId = line.ProductId;
        VariantId = line.VariantId;
        ProductName = line.ProductName;
        VariantLabel = line.VariantLabel;
        Quantity = line.Quantity;
        UnitPrice = line.UnitPrice;
        UnitCost = line.UnitCost;
        LineTotal = MoneyMath.Round(line.Quantity * line.UnitPrice);
    }

    private OrderItem()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid OrderId { get; private set; }

    public Guid ProductId { get; private set; }

    public Guid VariantId { get; private set; }

    public string ProductName { get; private set; } = string.Empty;

    /// <summary>"M · زيتي", or null for a product without options.</summary>
    public string? VariantLabel { get; private set; }

    public int Quantity { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal UnitCost { get; private set; }

    public decimal LineTotal { get; private set; }

    public string DisplayName => VariantLabel is null ? ProductName : $"{ProductName} ({VariantLabel})";
}

/// <summary>Append-only status history of an order (DATABASE-DESIGN §5.5). Undo rows point at the change they revert.</summary>
public sealed class OrderStatusLog : Entity, IBusinessOwned
{
    private OrderStatusLog(Guid id)
        : base(id)
    {
    }

    private OrderStatusLog()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid OrderId { get; private set; }

    /// <summary>1, 2, 3… within the order; the latest change has the highest value.</summary>
    public int Sequence { get; private set; }

    /// <summary>Null for the creation row.</summary>
    public OrderStatus? FromStatus { get; private set; }

    public OrderStatus ToStatus { get; private set; }

    public DateTime ChangedAt { get; private set; }

    public Guid OperationId { get; private set; }

    public bool IsUndo { get; private set; }

    public Guid? UndoOfLogId { get; private set; }

    public CancelReason? Reason { get; private set; }

    public string? Note { get; private set; }

    internal static OrderStatusLog Create(Order order, OrderStatus? from, OrderStatus to, Guid operationId, DateTime nowUtc, bool isUndo, Guid? undoOfLogId, CancelReason? reason, string? note)
        => new(NewId())
        {
            BusinessId = order.BusinessId,
            OrderId = order.Id,
            Sequence = order.StatusLogs.Count == 0 ? 1 : order.StatusLogs.Max(l => l.Sequence) + 1,
            FromStatus = from,
            ToStatus = to,
            ChangedAt = nowUtc,
            OperationId = operationId,
            IsUndo = isUndo,
            UndoOfLogId = undoOfLogId,
            Reason = reason,
            Note = note,
        };
}
