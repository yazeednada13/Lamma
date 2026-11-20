using System.Text.Json.Serialization;
using Lamma.Application.Common.Serialization;

namespace Lamma.Application.Catalog;

// ---------- Categories ----------

public sealed record CategoryDto(Guid Id, string Name, int ProductCount);

public sealed record CategoryRequest(string Name);

// ---------- Templates ----------

public sealed record TemplateAxisDto(string Name, IReadOnlyList<string> SuggestedValues);

public sealed record TemplateFieldDto(string Key, string LabelAr, string Type, IReadOnlyList<string> Options, bool IsRequired, bool IsCustom);

public sealed record ProductTemplateDto(
    string Code,
    string NameAr,
    bool SupportsExpiry,
    bool SupportsGiftBox,
    IReadOnlyList<TemplateAxisDto> DefaultAxes,
    IReadOnlyList<TemplateFieldDto> Fields);

/// <summary>Create or update a custom field. <c>Type</c>: text | number | select | date. Options for select only.</summary>
public sealed record TemplateFieldRequest(string LabelAr, string Type, IReadOnlyList<string>? Options, bool IsRequired);

// ---------- Products: requests ----------

public sealed record ProductOptionRequest(string Name, IReadOnlyList<string> Values);

public sealed record VariantRequest(
    IReadOnlyList<string> Values,
    int OpeningQuantity,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? PriceOverride,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? CostOverride);

/// <summary>
/// Creates a product with its variants and opening stock in one transaction (D-090, D-096).
/// No options → a simple product; <c>Variants</c> may then hold one entry (without values) for the opening quantity.
/// </summary>
public sealed record CreateProductRequest(
    string Name,
    Guid? CategoryId,
    string? TemplateCode,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal SellingPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cost,
    int? LowStockThreshold,
    IReadOnlyDictionary<string, string?>? Attributes,
    DateOnly? ExpiryDate,
    IReadOnlyList<ProductOptionRequest>? Options,
    IReadOnlyList<VariantRequest>? Variants);

/// <summary>Updates details. <c>OptionNames</c> renames the existing axes (their count cannot change).</summary>
public sealed record UpdateProductRequest(
    string Name,
    Guid? CategoryId,
    string TemplateCode,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal SellingPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cost,
    int LowStockThreshold,
    IReadOnlyDictionary<string, string?>? Attributes,
    IReadOnlyList<string>? OptionNames);

/// <summary>Adds a variant. For a simple product, <c>OptionNames</c> converts it to a product with options.</summary>
public sealed record AddVariantRequest(
    IReadOnlyList<string> Values,
    int OpeningQuantity,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? PriceOverride,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? CostOverride,
    DateOnly? ExpiryDate,
    IReadOnlyList<string>? OptionNames);

public sealed record UpdateVariantRequest(
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? PriceOverride,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? CostOverride,
    DateOnly? ExpiryDate);

/// <summary>Query string of <c>GET products</c> (API-DESIGN §4, D-105).</summary>
public sealed class ProductListQuery
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public string? Search { get; set; }

    public Guid? CategoryId { get; set; }

    /// <summary>Only products without a category.</summary>
    public bool Uncategorized { get; set; }

    /// <summary>in | low | out.</summary>
    public string? StockStatus { get; set; }

    public bool Archived { get; set; }

    /// <summary>-createdAt (default) | createdAt | name | -name | available | -available.</summary>
    public string? Sort { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = DefaultPageSize;
}

// ---------- Products: responses ----------

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public sealed record ProductListItemDto(
    Guid Id,
    string Name,
    Guid? CategoryId,
    string? CategoryName,
    string TemplateCode,
    string? ImageUrl,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MinPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MaxPrice,
    int OnHand,
    int Reserved,
    int Available,
    int LowStockThreshold,
    string StockStatus,
    int VariantCount,
    bool IsArchived,
    DateTime CreatedAt);

public sealed record ProductOptionDto(string Name, IReadOnlyList<string> Values);

public sealed record VariantDto(
    Guid Id,
    IReadOnlyList<string> Values,
    string Label,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Price,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cost,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? PriceOverride,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? CostOverride,
    int OnHand,
    int Reserved,
    int Available,
    string StockStatus,
    DateOnly? ExpiryDate,
    bool IsArchived,
    bool IsDefault);

public sealed record StockMovementDto(
    Guid Id,
    Guid VariantId,
    string VariantLabel,
    string Type,
    string? ReferenceKind,
    string? Label,
    int OnHandDelta,
    int ReservedDelta,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? UnitCost,
    bool IsAutomatic,
    DateTime CreatedAt);

public sealed record ProductDetailsDto(
    Guid Id,
    string Name,
    Guid? CategoryId,
    string? CategoryName,
    string TemplateCode,
    string? ImageUrl,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal SellingPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Cost,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MarginPerUnit,
    decimal MarginPercent,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MinPrice,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MaxPrice,
    int LowStockThreshold,
    int OnHand,
    int Reserved,
    int Available,
    string StockStatus,
    int Sold,
    bool IsArchived,
    IReadOnlyDictionary<string, string> Attributes,
    IReadOnlyList<ProductOptionDto> Options,
    IReadOnlyList<VariantDto> Variants,
    IReadOnlyList<StockMovementDto> RecentMovements,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>An image read from storage for streaming.</summary>
public sealed record ProductImageContent(Stream Content, string ContentType);
