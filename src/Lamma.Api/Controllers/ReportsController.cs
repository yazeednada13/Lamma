using Lamma.Api.Security;
using Lamma.Application.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Reports hub, profit and loss, and sales (Phase 10, D-168–D-172).</summary>
[ApiController]
[Route("api/v1/reports")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class ReportsController(IReportService reports) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<ReportsSummaryDto>> Summary(CancellationToken cancellationToken)
        => Ok(await reports.SummaryAsync(cancellationToken));

    [HttpGet("pnl")]
    public async Task<ActionResult<PnlReportDto>> Pnl([FromQuery] ReportPeriodQuery query, CancellationToken cancellationToken)
        => Ok(await reports.PnlAsync(query, cancellationToken));

    [HttpGet("sales")]
    public async Task<ActionResult<SalesReportDto>> Sales([FromQuery] ReportPeriodQuery query, CancellationToken cancellationToken)
        => Ok(await reports.SalesAsync(query, cancellationToken));
}
