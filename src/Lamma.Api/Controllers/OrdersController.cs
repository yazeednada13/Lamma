using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Orders core (Phase 5, D-121–D-130). Create, status change and undo are idempotent (D-112).</summary>
[ApiController]
[Route("api/v1/orders")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class OrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<OrderListItemDto>>> List([FromQuery] OrderListQuery query, CancellationToken cancellationToken)
        => Ok(await orders.ListAsync(query, cancellationToken));

    [HttpGet("status-counts")]
    public async Task<ActionResult<OrderStatusCountsDto>> StatusCounts([FromQuery] OrderListQuery query, CancellationToken cancellationToken)
        => Ok(await orders.StatusCountsAsync(query, cancellationToken));

    [HttpGet("preorders")]
    public async Task<ActionResult<IReadOnlyList<PreOrderDto>>> PreOrders([FromQuery] PreOrderQuery query, CancellationToken cancellationToken)
        => Ok(await orders.PreOrdersAsync(query, cancellationToken));

    [HttpPost("{id:guid}/returns")]
    public async Task<ActionResult<OrderDetailsDto>> Return(Guid id, ReturnOrderRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await orders.ReturnAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderDetailsDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await orders.GetAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<OrderDetailsDto>> Create(CreateOrderRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
    {
        var order = await orders.CreateAsync(IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken);
        return Created($"/api/v1/orders/{order.Id}", order);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrderDetailsDto>> Update(Guid id, UpdateOrderRequest request, CancellationToken cancellationToken)
        => Ok(await orders.UpdateAsync(id, request, cancellationToken));

    [HttpPut("{id:guid}/details")]
    public async Task<ActionResult<OrderDetailsDto>> UpdateDetails(Guid id, UpdateOrderDetailsRequest request, CancellationToken cancellationToken)
        => Ok(await orders.UpdateDetailsAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<OrderDetailsDto>> ChangeStatus(Guid id, ChangeOrderStatusRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await orders.ChangeStatusAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));

    [HttpPost("{id:guid}/status/undo")]
    public async Task<ActionResult<OrderDetailsDto>> Undo(Guid id, UndoOrderStatusRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await orders.UndoAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));
}
