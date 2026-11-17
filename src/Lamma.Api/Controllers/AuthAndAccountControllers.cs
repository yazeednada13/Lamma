using Lamma.Api.Pipeline;
using Lamma.Application.Accounts;
using Lamma.Application.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Lamma.Api.Controllers;

public sealed record AntiforgeryTokenResponse(string Token);

/// <summary>Sign-up, login, logout, password recovery. Thin: HTTP only, rules live in <see cref="IAuthService"/>.</summary>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    /// <summary>Issues the CSRF token the SPA sends as X-XSRF-TOKEN. Re-fetch after login/logout (tokens are bound to the user).</summary>
    [HttpGet("antiforgery")]
    [AllowAnonymous]
    public ActionResult<AntiforgeryTokenResponse> Antiforgery([FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new AntiforgeryTokenResponse(tokens.RequestToken!));
    }

    [HttpPost("signup")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingOptions.SensitivePolicy)]
    public async Task<ActionResult<AccountDto>> SignUp(SignUpRequest request, CancellationToken cancellationToken)
        => Created("/api/v1/account", await auth.SignUpAsync(request, cancellationToken));

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingOptions.LoginPolicy)]
    public async Task<ActionResult<AccountDto>> Login(LoginRequest request, CancellationToken cancellationToken)
        => Ok(await auth.LoginAsync(request, cancellationToken));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await auth.LogoutAsync();
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingOptions.SensitivePolicy)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await auth.ForgotPasswordAsync(request, cancellationToken);
        return Accepted();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingOptions.SensitivePolicy)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await auth.ResetPasswordAsync(request, cancellationToken);
        return NoContent();
    }
}

/// <summary>The signed-in owner's account.</summary>
[ApiController]
[Route("api/v1/account")]
public sealed class AccountController(IAccountService accounts) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AccountDto>> Get(CancellationToken cancellationToken)
        => Ok(await accounts.GetCurrentAsync(cancellationToken));

    [HttpPut]
    public async Task<ActionResult<AccountDto>> Update(UpdateAccountRequest request, CancellationToken cancellationToken)
        => Ok(await accounts.UpdateAsync(request, cancellationToken));

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        await accounts.ChangePasswordAsync(request, cancellationToken);
        return NoContent();
    }
}
