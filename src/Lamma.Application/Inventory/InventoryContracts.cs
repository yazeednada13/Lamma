using System.Text.Json.Serialization;
using Lamma.Application.Catalog;
using Lamma.Application.Common.Serialization;

namespace Lamma.Application.Inventory;

// Inventory contracts (API-DESIGN §13). Money: 3-dp strings; input ≤ 2 dp (D-080).

public sealed record ReceiveLineRequest(
    Guid VariantId,
    int Quantity,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal UnitCost,
    DateOnly? ExpiryDate);

/// <summary>Goods received from a supplier (D-107: no purchases expense). Requires an Idempotency-Key (D-112).</summary>
public sealed record ReceiveStockRequest(DateOnly? ReceivedOn, string? Supplier, string? Note, IReadOnlyList<ReceiveLineRequest> Lines);

public sealed record ReceiptLineDto(
    Guid ProductId,
    string ProductName,
    Guid VariantId,
    string VariantLabel,
    int Quantity,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal UnitCost,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal LineTotal,
    int NewOnHand,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal NewCost);

public sealed record ReceiptDto(
    Guid Id,
    DateOnly ReceivedOn,
    string? Supplier,
    string? Note,
    int Pieces,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal TotalCost,
    IReadOnlyList<ReceiptLineDto> Lines);

/// <summary>Manual adjustment (D-110). <c>Reason</c>: damage | loss | count | correction | gift.</summary>
public sealed record AdjustStockRequest(Guid VariantId, int Delta, string Reason, string? Note);

public sealed record AdjustmentDto(
    Guid MovementId,
    Guid ProductId,
    string ProductName,
    Guid VariantId,
    string VariantLabel,
    int Delta,
    int OnHand,
    int Reserved,
    int Available,
    string StockStatus);

public sealed class InventoryLevelsQuery
{
    public string? Search { get; set; }

    public Guid? CategoryId { get; set; }

    /// <summary>low | out.</summary>
    public string? Status { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = ProductListQuery.DefaultPageSize;
}

public sealed record VariantLevelDto(
    Guid VariantId,
    string Label,
    int OnHand,
    int Reserved,
    int Available,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cost,
    DateOnly? ExpiryDate);

public sealed record InventoryLevelDto(
    Guid ProductId,
    string Name,
    string? CategoryName,
    string TemplateCode,
    string? ImageUrl,
    int OnHand,
    int Reserved,
    int Available,
    int LowStockThreshold,
    string StockStatus,
    IReadOnlyList<VariantLevelDto> Variants);

/// <summary>Server-computed stock summary (D-113). Active products and variants only.</summary>
public sealed record InventorySummaryDto(
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal StockValueAtCost,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal RetailValue,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal ExpectedProfit,
    int Pieces,
    int Reserved,
    int ProductCount,
    int LowCount,
    int OutCount,
    IReadOnlyList<string> LowNames,
    IReadOnlyList<string> OutNames);

public sealed class MovementLogQuery
{
    public const int DefaultPageSize = 50;

    /// <summary>in | out.</summary>
    public string? Direction { get; set; }

    /// <summary>auto | manual.</summary>
    public string? Origin { get; set; }

    public Guid? ProductId { get; set; }

    public Guid? VariantId { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = DefaultPageSize;
}

public sealed record MovementLogItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    Guid VariantId,
    string VariantLabel,
    string Type,
    string? ReferenceKind,
    string? Label,
    string? AdjustmentReason,
    string? Note,
    int OnHandDelta,
    int ReservedDelta,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? UnitCost,
    bool IsAutomatic,
    DateTime CreatedAt);

/// <summary>A variant with an expiry date and stock (D-108, D-111). Status: expired | soon | ok.</summary>
public sealed record ExpiringItemDto(
    Guid ProductId,
    string ProductName,
    string TemplateCode,
    string? ImageUrl,
    Guid VariantId,
    string VariantLabel,
    int OnHand,
    DateOnly ExpiryDate,
    int DaysLeft,
    string Status);
