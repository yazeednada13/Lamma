using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>A goods receipt from a supplier. Its lines are the <c>receive</c> movements that reference it.</summary>
public sealed class StockReceipt : Entity, IBusinessOwned
{
    public const int SupplierMaxLength = 100;
    public const int NoteMaxLength = 200;
    public const int MaxLines = 50;

    private StockReceipt(Guid id)
        : base(id)
    {
    }

    private StockReceipt()
    {
    }

    public Guid BusinessId { get; private set; }

    public DateOnly ReceivedOn { get; private set; }

    public string? Supplier { get; private set; }

    public string? Note { get; private set; }

    public int Pieces { get; private set; }

    public decimal TotalCost { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public static StockReceipt Create(Guid businessId, DateOnly receivedOn, string? supplier, string? note, DateTime nowUtc)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        return new StockReceipt(NewId())
        {
            BusinessId = businessId,
            ReceivedOn = receivedOn,
            Supplier = Clean(supplier, SupplierMaxLength, "المورّد"),
            Note = Clean(note, NoteMaxLength, "الملاحظة"),
            CreatedAt = nowUtc,
        };
    }

    /// <summary>Adds a received line's pieces and cost to the receipt totals.</summary>
    public void AddLine(int quantity, decimal unitCost)
    {
        Pieces += quantity;
        TotalCost = MoneyMath.Round(TotalCost + (quantity * unitCost));
    }

    private static string? Clean(string? value, int max, string label)
    {
        var trimmed = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (trimmed is not null && trimmed.Length > max)
        {
            throw new DomainException("receipt.text_too_long", $"{label} لازم يكون {max} حرف أو أقل.");
        }

        return trimmed;
    }
}
