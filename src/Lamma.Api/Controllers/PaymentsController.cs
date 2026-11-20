using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Payments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Payments and receivables (Phase 6, D-131–D-138). Every write is idempotent (D-112).</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class PaymentsController(IPaymentService payments) : ControllerBase
{
    [HttpPost("orders/{id:guid}/payments")]
    public async Task<ActionResult<PaymentResultDto>> RecordForOrder(Guid id, RecordPaymentRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await payments.RecordForOrderAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));

    [HttpPost("customers/{id:guid}/payments")]
    public async Task<ActionResult<PaymentResultDto>> RecordForCustomer(Guid id, RecordPaymentRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await payments.RecordForCustomerAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));

    [HttpPost("payments/{id:guid}/reverse")]
    public async Task<ActionResult<PaymentResultDto>> Reverse(Guid id, ReversePaymentRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await payments.ReverseAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));

    [HttpGet("payments")]
    public async Task<ActionResult<PagedResult<PaymentDto>>> List([FromQuery] PaymentListQuery query, CancellationToken cancellationToken)
        => Ok(await payments.ListAsync(query, cancellationToken));

    [HttpGet("payments/{id:guid}")]
    public async Task<ActionResult<PaymentDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await payments.GetAsync(id, cancellationToken));

    [HttpGet("finance/receivables")]
    public async Task<ActionResult<PagedResult<ReceivableDto>>> Receivables([FromQuery] ReceivableListQuery query, CancellationToken cancellationToken)
        => Ok(await payments.ReceivablesAsync(query, cancellationToken));

    [HttpGet("finance/receivables/aging")]
    public async Task<ActionResult<ReceivablesAgingDto>> Aging(CancellationToken cancellationToken)
        => Ok(await payments.AgingAsync(cancellationToken));
}
