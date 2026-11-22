using Lamma.Application.Common;
using Lamma.Application.Subscriptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lamma.Api.Security;

/// <summary>The platform admin (D-175): the PlatformAdmin role, checked against Identity on every request.</summary>
public sealed class PlatformAdminRequirement : IAuthorizationRequirement;

public sealed class PlatformAdminRequirementHandler(ICurrentUser currentUser, IPlatformAdmins admins) : AuthorizationHandler<PlatformAdminRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PlatformAdminRequirement requirement)
    {
        if (currentUser.UserId is { } id && await admins.IsAdminAsync(id, CancellationToken.None))
        {
            context.Succeed(requirement);
        }
    }
}

/// <summary>Marks a business write that stays allowed in read-only mode (D-176), e.g. sending a payment request.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AllowWhenReadOnlyAttribute : Attribute;

/// <summary>
/// Read-only mode (D-162, D-176), enforced on the server: every unsafe request to a business endpoint is refused with
/// 403 <c>subscription.read_only</c> when the trial or the plan has ended or the account is suspended, unless the
/// action is marked <see cref="AllowWhenReadOnlyAttribute"/>. Reading is never blocked.
/// </summary>
public sealed class ReadOnlySubscriptionFilter(ISubscriptionReader subscriptions) : IAsyncActionFilter
{
    public const string Code = "subscription.read_only";

    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS" };

    public static bool AppliesTo(IList<object> endpointMetadata, string httpMethod)
        => !SafeMethods.Contains(httpMethod)
           && endpointMetadata.OfType<AuthorizeAttribute>().Any(a => a.Policy == Policies.RequireBusiness)
           && !endpointMetadata.OfType<AllowWhenReadOnlyAttribute>().Any();

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (AppliesTo(context.ActionDescriptor.EndpointMetadata, context.HttpContext.Request.Method))
        {
            var snapshot = await subscriptions.GetCurrentAsync(context.HttpContext.RequestAborted);
            if (snapshot is { ReadOnly: true })
            {
                throw new ForbiddenException(
                    Code,
                    snapshot.State == Domain.Subscriptions.SubscriptionState.Suspended
                        ? "حسابك موقوف حاليًا. تواصل معنا عشان نرجّعه."
                        : "حسابك صار للقراءة فقط. اشترك عشان ترجع تضيف وتعدّل، وكل بياناتك محفوظة.");
            }
        }

        await next();
    }
}
