using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Stock levels, receive, adjust, movement log and expiry (Phase 3). Receive and adjust are idempotent (D-112).</summary>
[ApiController]
[Route("api/v1/inventory")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class InventoryController(IInventoryService inventory) : ControllerBase
{
    public const string IdempotencyHeader = "Idempotency-Key";

    [HttpGet("levels")]
    public async Task<ActionResult<PagedResult<InventoryLevelDto>>> Levels([FromQuery] InventoryLevelsQuery query, CancellationToken cancellationToken)
        => Ok(await inventory.LevelsAsync(query, cancellationToken));

    [HttpGet("summary")]
    public async Task<ActionResult<InventorySummaryDto>> Summary(CancellationToken cancellationToken)
        => Ok(await inventory.SummaryAsync(cancellationToken));

    [HttpGet("movements")]
    public async Task<ActionResult<PagedResult<MovementLogItemDto>>> Movements([FromQuery] MovementLogQuery query, CancellationToken cancellationToken)
        => Ok(await inventory.MovementsAsync(query, cancellationToken));

    [HttpGet("expiring")]
    public async Task<ActionResult<IReadOnlyList<ExpiringItemDto>>> Expiring(CancellationToken cancellationToken)
        => Ok(await inventory.ExpiringAsync(cancellationToken));

    [HttpPost("receipts")]
    public async Task<ActionResult<ReceiptDto>> Receive(ReceiveStockRequest request, [FromHeader(Name = IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
    {
        var receipt = await inventory.ReceiveAsync(ParseKey(idempotencyKey), request, cancellationToken);
        return Created($"/api/v1/inventory/receipts/{receipt.Id}", receipt);
    }

    [HttpPost("adjustments")]
    public async Task<ActionResult<AdjustmentDto>> Adjust(AdjustStockRequest request, [FromHeader(Name = IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await inventory.AdjustAsync(ParseKey(idempotencyKey), request, cancellationToken));

    private static Guid ParseKey(string? value)
        => Guid.TryParse(value, out var key) && key != Guid.Empty
            ? key
            : throw RequestValidationException.ForField(IdempotencyHeader, "الطلب ناقصه مفتاح الحماية من التكرار. حدّث الصفحة وجرّب كمان مرة.", "idempotency.key_required");
}
