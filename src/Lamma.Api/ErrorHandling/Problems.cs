using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.ErrorHandling;

/// <summary>
/// Builds RFC 9457 ProblemDetails in one consistent shape (API-DESIGN §5):
/// type, title, status, detail (Arabic, user-safe), code (stable), traceId, errors (field map, optional).
/// </summary>
public static class Problems
{
    public const string ContentType = "application/problem+json";
    private const string TypeBase = "https://lamma.app/errors/";

    public static ProblemDetails Create(HttpContext http, int status, string code, string detail, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        ProblemDetails problem = errors is { Count: > 0 }
            ? new ValidationProblemDetails(errors.ToDictionary(kv => kv.Key, kv => kv.Value))
            : new ProblemDetails();

        problem.Type = TypeBase + code;
        problem.Title = TitleFor(status);
        problem.Status = status;
        problem.Detail = detail;
        problem.Extensions["code"] = code;
        problem.Extensions["traceId"] = Activity.Current?.Id ?? http.TraceIdentifier;
        return problem;
    }

    public static ObjectResult Result(HttpContext http, int status, string code, string detail)
        => new(Create(http, status, code, detail)) { StatusCode = status, ContentTypes = { ContentType } };

    public static async Task WriteAsync(HttpContext http, int status, string code, string detail, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        http.Response.StatusCode = status;
        var problem = Create(http, status, code, detail, errors);

        // Serialize the runtime type so ValidationProblemDetails.Errors is included.
        await http.Response.WriteAsJsonAsync(problem, problem.GetType(), options: null, contentType: ContentType);
    }

    public static string TitleFor(int status) => status switch
    {
        400 => "طلب غير صالح",
        401 => "لازم تسجّل دخول",
        403 => "غير مسموح",
        404 => "مش موجود",
        405 => "العملية غير مدعومة",
        409 => "تعارض",
        422 => "معلومات غير صحيحة",
        423 => "الحساب مقفل مؤقتًا",
        429 => "طلبات كثيرة",
        503 => "الخدمة غير متاحة",
        _ => status >= 500 ? "خطأ في الخادم" : "خطأ",
    };

    public static string DefaultDetail(int status) => status switch
    {
        400 => "صيغة الطلب غير صحيحة.",
        401 => "لازم تسجّل دخول.",
        403 => "ما عندك صلاحية لهالعملية.",
        404 => "الصفحة أو العنصر اللي بتدوّر عليه مش موجود.",
        405 => "هالعملية مش مدعومة على هذا الرابط.",
        429 => "طلبات كثيرة بوقت قصير. استنى دقيقة وجرّب كمان مرة.",
        _ => status >= 500 ? "صار خطأ غير متوقع. جرّب كمان مرة بعد شوي." : "صار خطأ.",
    };
}
