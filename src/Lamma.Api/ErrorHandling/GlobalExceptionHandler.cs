using Lamma.Application.Common;
using Lamma.Domain.Common;
using Microsoft.AspNetCore.Diagnostics;

namespace Lamma.Api.ErrorHandling;

/// <summary>Maps exceptions to ProblemDetails centrally (P-014). Controllers never catch business errors.</summary>
public sealed partial class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, detail, errors) = exception switch
        {
            RequestValidationException v => (StatusCodes.Status422UnprocessableEntity, v.Code, v.Message, v.Errors),
            NotFoundException e => (StatusCodes.Status404NotFound, e.Code, e.Message, null),
            ConflictException e => (StatusCodes.Status409Conflict, e.Code, e.Message, null),
            ForbiddenException e => (StatusCodes.Status403Forbidden, e.Code, e.Message, null),
            UnauthorizedException e => (StatusCodes.Status401Unauthorized, e.Code, e.Message, null),
            LockedException e => (StatusCodes.Status423Locked, e.Code, e.Message, null),
            ServiceUnavailableException e => (StatusCodes.Status503ServiceUnavailable, e.Code, e.Message, null),
            DomainException e => (StatusCodes.Status422UnprocessableEntity, e.Code, e.Message, null),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "request.malformed", Problems.DefaultDetail(400), null),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested => (499, "request.cancelled", "انلغى الطلب.", null),
            _ => (StatusCodes.Status500InternalServerError, "server.error", Problems.DefaultDetail(500), (IReadOnlyDictionary<string, string[]>?)null),
        };

        if (status >= 500)
        {
            LogUnhandled(logger, exception, httpContext.Request.Method, httpContext.Request.Path);
        }

        await Problems.WriteAsync(httpContext, status, code, detail, errors);
        return true;
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception for {Method} {Path}")]
    private static partial void LogUnhandled(ILogger logger, Exception exception, string method, string path);
}
