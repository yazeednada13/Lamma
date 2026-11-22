using Lamma.Api.Pipeline;
using Lamma.Application.Accounts;
using Lamma.Application.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Lamma.Application.Signup;

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
    public async Task<ActionResult<AccountDto>> SignUp(SignUpRequest request, [FromServices] IOptions<RegistrationOptions> registration, CancellationToken cancellationToken)
    {
        if (registration.Value.InviteOnly)
        {
            return NotFound(); // closed: accounts come from invitations only (D-160)
        }

        return Created("/api/v1/account", await auth.SignUpAsync(request, cancellationToken));
    }

    /// <summary>Creates the account from an invitation (D-160) and signs in.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingOptions.SensitivePolicy)]
    public async Task<ActionResult<AccountDto>> Register(RegisterRequest request, [FromServices] ISignupService signup, CancellationToken cancellationToken)
        => Created("/api/v1/account", await signup.RegisterAsync(request, cancellationToken));

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
