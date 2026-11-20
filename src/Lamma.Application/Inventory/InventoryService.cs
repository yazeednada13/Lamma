using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;

namespace Lamma.Application.Inventory;

// ---------- Ports (Infrastructure) ----------

public interface IInventoryRepository
{
    /// <summary>The products (with all variants, tracked) that own the given variants of the current business.</summary>
    Task<IReadOnlyList<Product>> GetProductsForVariantsAsync(IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken);

    void AddReceipt(StockReceipt receipt);

    void AddMovements(IEnumerable<StockMovement> movements);
}

public interface IInventoryQueries
{
    Task<PagedResult<InventoryLevelDto>> LevelsAsync(InventoryLevelsQuery query, CancellationToken cancellationToken);

    Task<InventorySummaryDto> SummaryAsync(CancellationToken cancellationToken);

    Task<PagedResult<MovementLogItemDto>> MovementsAsync(MovementLogQuery query, CancellationToken cancellationToken);

    /// <summary>Active variants with an expiry date and stock, nearest first, with days left from <paramref name="today"/>.</summary>
    Task<IReadOnlyList<ExpiringItemDto>> ExpiringAsync(DateOnly today, CancellationToken cancellationToken);
}

// ---------- Service ----------

public interface IInventoryService
{
    Task<ReceiptDto> ReceiveAsync(Guid idempotencyKey, ReceiveStockRequest request, CancellationToken cancellationToken);

    Task<AdjustmentDto> AdjustAsync(Guid idempotencyKey, AdjustStockRequest request, CancellationToken cancellationToken);

    Task<PagedResult<InventoryLevelDto>> LevelsAsync(InventoryLevelsQuery query, CancellationToken cancellationToken);

    Task<InventorySummaryDto> SummaryAsync(CancellationToken cancellationToken);

    Task<PagedResult<MovementLogItemDto>> MovementsAsync(MovementLogQuery query, CancellationToken cancellationToken);

    Task<IReadOnlyList<ExpiringItemDto>> ExpiringAsync(CancellationToken cancellationToken);
}

/// <summary>Receive, adjust and inventory read models (Phase 3). Every stock change writes a movement in the same transaction.</summary>
internal sealed class InventoryService(
    ICurrentBusiness currentBusiness,
    IInventoryRepository inventory,
    IInventoryQueries queries,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : IInventoryService
{
    public Task<ReceiptDto> ReceiveAsync(Guid idempotencyKey, ReceiveStockRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, request, ct => ReceiveCoreAsync(request, ct), cancellationToken);

    public Task<AdjustmentDto> AdjustAsync(Guid idempotencyKey, AdjustStockRequest request, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, request, ct => AdjustCoreAsync(request, ct), cancellationToken);

    public Task<PagedResult<InventoryLevelDto>> LevelsAsync(InventoryLevelsQuery query, CancellationToken cancellationToken) => queries.LevelsAsync(query, cancellationToken);

    public Task<InventorySummaryDto> SummaryAsync(CancellationToken cancellationToken) => queries.SummaryAsync(cancellationToken);

    public Task<PagedResult<MovementLogItemDto>> MovementsAsync(MovementLogQuery query, CancellationToken cancellationToken) => queries.MovementsAsync(query, cancellationToken);

    public Task<IReadOnlyList<ExpiringItemDto>> ExpiringAsync(CancellationToken cancellationToken) => queries.ExpiringAsync(Today(), cancellationToken);

    private async Task<ReceiptDto> ReceiveCoreAsync(ReceiveStockRequest request, CancellationToken cancellationToken)
    {
        var today = Today();
        var receivedOn = request.ReceivedOn ?? today;
        if (receivedOn > today)
        {
            throw RequestValidationException.ForField("receivedOn", "تاريخ الاستلام ما بصير يكون بالمستقبل.");
        }

        var products = await inventory.GetProductsForVariantsAsync(request.Lines.Select(l => l.VariantId).ToList(), cancellationToken);
        var now = clock.UtcNow;
        var operationId = Entity.NewId();
        var receipt = StockReceipt.Create(currentBusiness.BusinessId, receivedOn, request.Supplier, request.Note, now);
        var label = receipt.Supplier ?? "استلام بضاعة";
        var movements = new List<StockMovement>();
        var lines = new List<ReceiptLineDto>();

        for (var i = 0; i < request.Lines.Count; i++)
        {
            var line = request.Lines[i];
            var (product, variant) = Find(products, line.VariantId);
            if (line.ExpiryDate is not null && !ProductTemplateCatalog.Find(product.TemplateCode)!.SupportsExpiry)
            {
                throw RequestValidationException.ForField($"lines[{i}].expiryDate", "هذا المنتج ما إله تاريخ انتهاء.");
            }

            movements.Add(product.ReceiveStock(variant, line.Quantity, line.UnitCost, line.ExpiryDate, receipt.Id, label, operationId, now));
            receipt.AddLine(line.Quantity, line.UnitCost);
            lines.Add(new ReceiptLineDto(
                product.Id,
                product.Name,
                variant.Id,
                CatalogMapping.VariantLabel(variant),
                line.Quantity,
                line.UnitCost,
                MoneyMath.Round(line.Quantity * line.UnitCost),
                variant.OnHand,
                product.EffectiveCost(variant)));
        }

        inventory.AddReceipt(receipt);
        inventory.AddMovements(movements);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new ReceiptDto(receipt.Id, receipt.ReceivedOn, receipt.Supplier, receipt.Note, receipt.Pieces, receipt.TotalCost, lines);
    }

    private async Task<AdjustmentDto> AdjustCoreAsync(AdjustStockRequest request, CancellationToken cancellationToken)
    {
        var products = await inventory.GetProductsForVariantsAsync([request.VariantId], cancellationToken);
        var (product, variant) = Find(products, request.VariantId);
        var movement = product.AdjustStock(variant, request.Delta, EnumCode.Parse<AdjustmentReason>(request.Reason), request.Note, Entity.NewId(), clock.UtcNow);
        inventory.AddMovements([movement]);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new AdjustmentDto(
            movement.Id,
            product.Id,
            product.Name,
            variant.Id,
            CatalogMapping.VariantLabel(variant),
            request.Delta,
            variant.OnHand,
            variant.Reserved,
            variant.Available,
            StockStatusRules.For(variant.Available, StockStatusRules.VariantLowThreshold).ToCode());
    }

    private DateOnly Today() => BusinessTime.LocalDate(clock.UtcNow, BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId));

    /// <summary>Another business's variant is invisible through the tenant filter, so it is "not found" (404).</summary>
    private static (Product Product, ProductVariant Variant) Find(IReadOnlyList<Product> products, Guid variantId)
    {
        foreach (var product in products)
        {
            var variant = product.Variants.FirstOrDefault(v => v.Id == variantId);
            if (variant is not null)
            {
                return (product, variant);
            }
        }

        throw new NotFoundException("inventory.variant_not_found", "ما لقينا المنتج أو النسخة.");
    }
}
