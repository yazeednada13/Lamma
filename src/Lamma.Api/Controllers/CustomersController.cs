using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Customers of the current business (Phase 4, D-114–D-118).</summary>
[ApiController]
[Route("api/v1/customers")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class CustomersController(ICustomerService customers) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CustomerListItemDto>>> List([FromQuery] CustomerListQuery query, CancellationToken cancellationToken)
        => Ok(await customers.ListAsync(query, cancellationToken));

    [HttpGet("summary")]
    public async Task<ActionResult<CustomersSummaryDto>> Summary(CancellationToken cancellationToken)
        => Ok(await customers.SummaryAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDetailsDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await customers.GetAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CustomerDetailsDto>> Create(CustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = await customers.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/customers/{customer.Id}", customer);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomerDetailsDto>> Update(Guid id, CustomerRequest request, CancellationToken cancellationToken)
        => Ok(await customers.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/archive")]
    public async Task<ActionResult<CustomerDetailsDto>> Archive(Guid id, CancellationToken cancellationToken)
        => Ok(await customers.SetArchivedAsync(id, archived: true, cancellationToken));

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult<CustomerDetailsDto>> Restore(Guid id, CancellationToken cancellationToken)
        => Ok(await customers.SetArchivedAsync(id, archived: false, cancellationToken));
}
