using Lamma.Api.Security;
using Lamma.Application.Admin;
using Lamma.Application.Catalog;
using Lamma.Application.Subscriptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>The owner's subscription page and CliQ payment requests (Phase 11-II, D-163, D-178).</summary>
[ApiController]
[Route("api/v1/subscription")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class SubscriptionController(ISubscriptionService subscriptions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SubscriptionDto>> Get(CancellationToken cancellationToken)
        => Ok(await subscriptions.GetAsync(cancellationToken));

    /// <summary>Multipart: <c>plan</c> (monthly | yearly) and <c>file</c> (jpg/png/webp/pdf ≤ 5 MB). Allowed in read-only mode.</summary>
    [HttpPost("payment-requests")]
    [AllowWhenReadOnly]
    [RequestSizeLimit(ProofFiles.MaxBytes + 64 * 1024)]
    public async Task<ActionResult<SubscriptionDto>> Pay(
        [FromForm] string? plan,
        IFormFile? file,
        [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (file is null)
        {
            throw Application.Common.RequestValidationException.ForField("file", "ارفع صورة التحويل.", "payment_request.file_missing");
        }

        await using var stream = file.OpenReadStream();
        var result = await subscriptions.SubmitPaymentAsync(IdempotencyKeys.Parse(idempotencyKey), plan ?? string.Empty, stream, file.Length, cancellationToken);
        return Created("/api/v1/subscription", result);
    }

    [HttpGet("payment-requests/{id:guid}/proof")]
    public async Task<IActionResult> Proof(Guid id, CancellationToken cancellationToken)
    {
        var proof = await subscriptions.OpenProofAsync(id, cancellationToken);
        Response.Headers.CacheControl = "private, no-store";
        return File(proof.Content, proof.ContentType, proof.FileName);
    }
}

/// <summary>The platform admin area (Phase 11-II, D-164, D-175). Admin only; never business data beyond counts (P-025).</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = Policies.RequirePlatformAdmin)]
public sealed class AdminController(IAdminService admin) : ControllerBase
{
    private const string Key = InventoryController.IdempotencyHeader;

    [HttpGet("dashboard")]
    public async Task<ActionResult<AdminDashboardDto>> Dashboard(CancellationToken cancellationToken)
        => Ok(await admin.DashboardAsync(cancellationToken));

    [HttpGet("subscribers")]
    public async Task<ActionResult<PagedResult<SubscriberRowDto>>> Subscribers([FromQuery] SubscribersQuery query, CancellationToken cancellationToken)
        => Ok(await admin.SubscribersAsync(query, cancellationToken));

    [HttpGet("subscribers/{businessId:guid}")]
    public async Task<ActionResult<SubscriberDetailDto>> Subscriber(Guid businessId, CancellationToken cancellationToken)
        => Ok(await admin.SubscriberAsync(businessId, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/extend-trial")]
    public async Task<ActionResult<SubscriberDetailDto>> ExtendTrial(Guid businessId, ExtendDaysRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ExtendTrialAsync(IdempotencyKeys.Parse(key), businessId, request, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/activate")]
    public async Task<ActionResult<SubscriberDetailDto>> Activate(Guid businessId, ActivatePlanRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ActivatePlanAsync(IdempotencyKeys.Parse(key), businessId, request, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/extend")]
    public async Task<ActionResult<SubscriberDetailDto>> Extend(Guid businessId, ExtendDaysRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ExtendPlanAsync(IdempotencyKeys.Parse(key), businessId, request, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/end-plan")]
    public async Task<ActionResult<SubscriberDetailDto>> EndPlan(Guid businessId, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.EndPlanAsync(IdempotencyKeys.Parse(key), businessId, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/suspend")]
    public async Task<ActionResult<SubscriberDetailDto>> Suspend(Guid businessId, ReasonRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.SuspendAsync(IdempotencyKeys.Parse(key), businessId, request, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/reactivate")]
    public async Task<ActionResult<SubscriberDetailDto>> Reactivate(Guid businessId, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ReactivateAsync(IdempotencyKeys.Parse(key), businessId, cancellationToken));

    [HttpPost("subscribers/{businessId:guid}/notes")]
    public async Task<ActionResult<SubscriberDetailDto>> Note(Guid businessId, NoteRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.AddNoteAsync(IdempotencyKeys.Parse(key), businessId, request, cancellationToken));

    [HttpGet("payment-requests")]
    public async Task<ActionResult<IReadOnlyList<AdminPaymentDto>>> Payments([FromQuery] string? status, CancellationToken cancellationToken)
        => Ok(await admin.PaymentsAsync(status, cancellationToken));

    [HttpGet("payment-requests/{id:guid}/proof")]
    public async Task<IActionResult> Proof(Guid id, CancellationToken cancellationToken)
    {
        var proof = await admin.OpenProofAsync(id, cancellationToken);
        Response.Headers.CacheControl = "private, no-store";
        return File(proof.Content, proof.ContentType, proof.FileName);
    }

    [HttpPost("payment-requests/{id:guid}/approve")]
    public async Task<ActionResult<AdminPaymentDto>> Approve(Guid id, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ApprovePaymentAsync(IdempotencyKeys.Parse(key), id, cancellationToken));

    [HttpPost("payment-requests/{id:guid}/reject")]
    public async Task<ActionResult<AdminPaymentDto>> Reject(Guid id, ReasonRequest request, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.RejectPaymentAsync(IdempotencyKeys.Parse(key), id, request, cancellationToken));

    [HttpGet("leads")]
    public async Task<ActionResult<PagedResult<LeadDto>>> Leads([FromQuery] LeadsQuery query, CancellationToken cancellationToken)
        => Ok(await admin.LeadsAsync(query, cancellationToken));

    [HttpPost("leads/{id:guid}/resend")]
    public async Task<ActionResult<LeadDto>> Resend(Guid id, [FromHeader(Name = Key)] string? key, CancellationToken cancellationToken)
        => Ok(await admin.ResendInviteAsync(IdempotencyKeys.Parse(key), id, cancellationToken));
}
