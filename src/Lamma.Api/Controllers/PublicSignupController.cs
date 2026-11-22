using Lamma.Api.Pipeline;
using Lamma.Application.Signup;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Lamma.Api.Controllers;

/// <summary>The public sign-up form and invitation links (Phase 11-I, D-160, D-161). Anonymous and rate-limited.</summary>
[ApiController]
[Route("api/v1/public")]
[AllowAnonymous]
public sealed class PublicSignupController(ISignupService signup) : ControllerBase
{
    /// <summary>Always 202, whatever the email (no enumeration).</summary>
    [HttpPost("signup")]
    [EnableRateLimiting(RateLimitingOptions.PublicSignupPolicy)]
    public async Task<IActionResult> SignUp(PublicSignupRequest request, CancellationToken cancellationToken)
    {
        await signup.SubmitAsync(request, cancellationToken);
        return Accepted();
    }

    [HttpGet("invitations/{token}")]
    [EnableRateLimiting(RateLimitingOptions.SensitivePolicy)]
    public async Task<ActionResult<InvitationDto>> Invitation(string token, CancellationToken cancellationToken)
        => Ok(await signup.GetInvitationAsync(token, cancellationToken));
}
