using System.Threading.RateLimiting;
using Lamma.Api.ErrorHandling;
using Lamma.Api.Pipeline;
using Lamma.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Lamma.Api;

/// <summary>HTTP-layer registrations and the request pipeline (composition root).</summary>
public static class DependencyInjection
{
    public const string CorsPolicy = "lamma-frontend";

    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers(o =>
            {
                o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true; // FluentValidation owns validation
                o.Filters.Add<AntiforgeryAndOriginFilter>();
                o.Filters.Add<ValidationActionFilter>();
            })
            .ConfigureApiBehaviorOptions(o =>
                o.InvalidModelStateResponseFactory = ctx => Problems.Result(ctx.HttpContext, 400, "request.malformed", Problems.DefaultDetail(400)));

        services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
        {
            // Status-code-only responses (unknown route, 405, ...) get the same shape as our errors.
            var status = ctx.ProblemDetails.Status ?? ctx.HttpContext.Response.StatusCode;
            ctx.ProblemDetails.Extensions.TryAdd("code", $"http.{status}");
            ctx.ProblemDetails.Extensions.TryAdd("traceId", System.Diagnostics.Activity.Current?.Id ?? ctx.HttpContext.TraceIdentifier);
            ctx.ProblemDetails.Title = Problems.TitleFor(status);
            ctx.ProblemDetails.Detail ??= Problems.DefaultDetail(status);
        });
        services.AddExceptionHandler<GlobalExceptionHandler>();

        services.AddAuthSecurity(configuration);
        services.AddLammaRateLimiting(configuration);
        services.AddHealthChecks();
        services.AddOpenApi();
        return services;
    }

    public static WebApplication UseLammaPipeline(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseMiddleware<RequestLoggingMiddleware>();
        app.UseRouting();
        app.UseCors(CorsPolicy);
        app.UseAuthentication();
        app.UseMiddleware<CurrentBusinessMiddleware>();
        app.UseRateLimiter();
        app.UseAuthorization();

        app.MapControllers();
        app.MapHealthChecks("/health").AllowAnonymous();
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi().AllowAnonymous();
        }

        return app;
    }

    private static IServiceCollection AddAuthSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.ConfigureApplicationCookie(o =>
        {
            o.Cookie.Name = "lamma.auth";
            o.Cookie.HttpOnly = true;
            o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            o.Cookie.SameSite = SameSiteMode.Lax;
            o.ExpireTimeSpan = TimeSpan.FromDays(14);
            o.SlidingExpiration = true;
            o.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            o.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(Policies.RequireBusiness, p => p.RequireAuthenticatedUser().AddRequirements(new BusinessRequirement()));
        services.AddScoped<IAuthorizationHandler, BusinessRequirementHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ProblemAuthorizationResultHandler>();

        services.AddAntiforgery(o =>
        {
            o.HeaderName = "X-XSRF-TOKEN";
            o.Cookie.Name = "lamma.xsrf";
            o.Cookie.HttpOnly = true;
            o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            o.Cookie.SameSite = SameSiteMode.Strict;
        });

        services.AddOptions<OriginOptions>().Bind(configuration.GetSection("App"));
        services.AddCors();
        services.AddOptions<CorsOptions>().Configure<IOptions<OriginOptions>>((cors, origins) =>
            cors.AddPolicy(CorsPolicy, p => p
                .WithOrigins(origins.Value.AllowedOrigins)
                .AllowCredentials()
                .WithHeaders("Content-Type", "X-XSRF-TOKEN")
                .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));
        return services;
    }

    private static IServiceCollection AddLammaRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RateLimitingOptions>().Bind(configuration.GetSection(RateLimitingOptions.SectionName));
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = (ctx, _) => new ValueTask(Problems.WriteAsync(ctx.HttpContext, 429, "rate_limited", Problems.DefaultDetail(429)));
            o.AddPolicy(RateLimitingOptions.LoginPolicy, ctx => PerIp(ctx, opts => opts.LoginPermitsPerMinute));
            o.AddPolicy(RateLimitingOptions.SensitivePolicy, ctx => PerIp(ctx, opts => opts.SensitivePermitsPerMinute));
        });
        return services;
    }

    private static RateLimitPartition<string> PerIp(HttpContext context, Func<RateLimitingOptions, int> permits)
    {
        var options = context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;
        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = Math.Max(1, permits(options)),
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    }
}
