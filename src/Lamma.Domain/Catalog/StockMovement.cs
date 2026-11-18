using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>Approved movement types (D-028). Codes: reserve, release, sale, receive, adjustment, return.</summary>
public enum StockMovementType
{
    Reserve,
    Release,
    Sale,
    Receive,
    Adjustment,
    Return,
}

/// <summary>What caused a movement. <c>opening</c> marks the opening quantity of a new product (D-096).</summary>
public enum StockReferenceKind
{
    Opening,
    Order,
    Receipt,
    Adjustment,
    Return,
}

/// <summary>Append-only stock log entry (D-028). One row per event per variant; never updated or deleted.</summary>
public sealed class StockMovement : Entity, IBusinessOwned
{
    public const int ReferenceLabelMaxLength = 60;
    public const int ReasonMaxLength = 200;

    private StockMovement(Guid id)
        : base(id)
    {
    }

    private StockMovement()
    {
    }

    public Guid BusinessId { get; private set; }

    public Guid ProductId { get; private set; }

    public Guid VariantId { get; private set; }

    public StockMovementType Type { get; private set; }

    public int OnHandDelta { get; private set; }

    public int ReservedDelta { get; private set; }

    public StockReferenceKind? ReferenceKind { get; private set; }

    public Guid? ReferenceId { get; private set; }

    public string? ReferenceLabel { get; private set; }

    public decimal? UnitCost { get; private set; }

    public string? Reason { get; private set; }

    public bool IsAutomatic { get; private set; }

    /// <summary>Groups the movements of one business operation (idempotency and undo, later phases).</summary>
    public Guid OperationId { get; private set; }

    public DateTime CreatedAt { get; private set; }

    internal static StockMovement Opening(Guid businessId, Guid productId, Guid variantId, int quantity, decimal unitCost, Guid operationId, DateTime nowUtc)
        => new(NewId())
        {
            BusinessId = businessId,
            ProductId = productId,
            VariantId = variantId,
            Type = StockMovementType.Receive,
            OnHandDelta = quantity,
            ReservedDelta = 0,
            ReferenceKind = StockReferenceKind.Opening,
            ReferenceId = productId,
            ReferenceLabel = "كمية افتتاحية",
            UnitCost = unitCost,
            IsAutomatic = true,
            OperationId = operationId,
            CreatedAt = nowUtc,
        };
}
