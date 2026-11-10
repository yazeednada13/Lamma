using Lamma.Api.ErrorHandling;
using Lamma.Application.Common;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Lamma.Api.Security;

public static class Policies
{
    /// <summary>Authenticated AND onboarded (has a business). Applied to all business-data endpoints.</summary>
    public const string RequireBusiness = "RequireBusiness";
}

/// <summary>Satisfied only when the current user has a business (resolved on the server).</summary>
public sealed class BusinessRequirement : IAuthorizationRequirement;

public sealed class BusinessRequirementHandler(ICurrentBusiness currentBusiness) : AuthorizationHandler<BusinessRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, BusinessRequirement requirement)
    {
        if (currentBusiness.HasBusiness)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

/// <summary>Writes ProblemDetails for 401/403 instead of cookie redirects.</summary>
public sealed class ProblemAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _default = new();

    public Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            return Problems.WriteAsync(context, 401, "auth.unauthenticated", Problems.DefaultDetail(401));
        }

        if (authorizeResult.Forbidden)
        {
            var notOnboarded = authorizeResult.AuthorizationFailure?.FailedRequirements.OfType<BusinessRequirement>().Any() == true;
            return notOnboarded
                ? Problems.WriteAsync(context, 403, "business.not_onboarded", "لازم تكمّل تهيئة مشروعك أول.")
                : Problems.WriteAsync(context, 403, "auth.forbidden", Problems.DefaultDetail(403));
        }

        return _default.HandleAsync(next, context, policy, authorizeResult);
    }
}

/// <summary>"App" origins used for CORS and the Origin check.</summary>
public sealed class OriginOptions
{
    public string[] AllowedOrigins { get; set; } = [];
}

/// <summary>
/// CSRF protection for cookie auth (MASTER-ARCHITECTURE §7.2): every unsafe request (POST/PUT/PATCH/DELETE),
/// including login and sign-up, must carry a valid X-XSRF-TOKEN and, when the browser sends one, an allowed Origin.
/// </summary>
public sealed class AntiforgeryAndOriginFilter(IAntiforgery antiforgery, IOptions<OriginOptions> origins) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        if (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method) || HttpMethods.IsOptions(http.Request.Method))
        {
            return;
        }

        if (!IsOriginAllowed(http))
        {
            context.Result = Problems.Result(http, 400, "security.origin_rejected", "الطلب جاي من مصدر غير مسموح.");
            return;
        }

        try
        {
            await antiforgery.ValidateRequestAsync(http);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = Problems.Result(http, 400, "security.csrf", "انتهت صلاحية الجلسة الأمنية للصفحة. حدّث الصفحة وجرّب كمان مرة.");
        }
    }

    private bool IsOriginAllowed(HttpContext http)
    {
        var origin = http.Request.Headers.Origin.ToString();
        if (string.IsNullOrEmpty(origin))
        {
            var referer = http.Request.Headers.Referer.ToString();
            if (string.IsNullOrEmpty(referer) || !Uri.TryCreate(referer, UriKind.Absolute, out var refererUri))
            {
                return true; // Non-browser client; the antiforgery token is still required.
            }

            origin = refererUri.GetLeftPart(UriPartial.Authority);
        }

        var self = $"{http.Request.Scheme}://{http.Request.Host}";
        return string.Equals(origin, self, StringComparison.OrdinalIgnoreCase)
            || origins.Value.AllowedOrigins.Any(o => string.Equals(o.TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase));
    }
}
