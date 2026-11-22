using Lamma.Api.Security;
using Lamma.Application.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>«لمّة اليوم» and the sidebar counters (Phase 9, D-153–D-158).</summary>
[ApiController]
[Route("api/v1/dashboard")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class DashboardController(IDashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get(CancellationToken cancellationToken)
        => Ok(await dashboard.GetAsync(cancellationToken));

    [HttpGet("indicators")]
    public async Task<ActionResult<DashboardIndicatorsDto>> Indicators(CancellationToken cancellationToken)
        => Ok(await dashboard.IndicatorsAsync(cancellationToken));
}
