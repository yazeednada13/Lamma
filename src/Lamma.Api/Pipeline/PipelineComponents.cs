using System.Diagnostics;
using System.Text.Json;
using FluentValidation;
using Lamma.Application.Common;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lamma.Api.Pipeline;

/// <summary>
/// Runs the FluentValidation validator (if any) for every action argument and throws
/// <see cref="RequestValidationException"/> (→ 422) with camelCase field keys.
/// </summary>
public sealed class ValidationActionFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var errors = new Dictionary<string, List<string>>();
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null)
            {
                continue;
            }

            if (services.GetService(typeof(IValidator<>).MakeGenericType(argument.GetType())) is not IValidator validator)
            {
                continue;
            }

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var failure in result.Errors)
            {
                var key = ToCamelPath(failure.PropertyName);
                if (!errors.TryGetValue(key, out var list))
                {
                    errors[key] = list = [];
                }

                if (!list.Contains(failure.ErrorMessage))
                {
                    list.Add(failure.ErrorMessage);
                }
            }
        }

        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()));
        }

        await next();
    }

    internal static string ToCamelPath(string propertyPath)
        => string.Join('.', propertyPath.Split('.').Select(segment => JsonNamingPolicy.CamelCase.ConvertName(segment)));
}

/// <summary>Resolves the current business once per request, after authentication and before authorization.</summary>
public sealed class CurrentBusinessMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ICurrentBusinessResolver resolver)
    {
        await resolver.ResolveAsync(context.RequestAborted);
        await next(context);
    }
}

/// <summary>Minimal request log: method, path (no query string), status, duration. Never bodies, emails or tokens.</summary>
public sealed partial class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            LogRequest(logger, context.Request.Method, context.Request.Path, context.Response.StatusCode, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs:0.0} ms")]
    private static partial void LogRequest(ILogger logger, string method, string path, int statusCode, double elapsedMs);
}

/// <summary>"RateLimiting" configuration section (per client IP, per minute).</summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";
    public const string LoginPolicy = "auth-login";
    public const string SensitivePolicy = "auth-sensitive";

    public int LoginPermitsPerMinute { get; set; } = 10;

    public int SensitivePermitsPerMinute { get; set; } = 5;
}
