using System.Net;
using System.Text;

namespace Lamma.Application.Common.Email;

/// <summary>A ready-to-send email. <c>Kind</c> names the template; <c>Link</c> is its main action (tests and the dev sender read it).</summary>
public sealed record EmailMessage(string To, string Subject, string Html, string Text, string Kind, string? Link = null);

/// <summary>
/// Lamma's branded emails (D-160): Arabic, right to left, inline styles only (email clients ignore stylesheets), the
/// wordmark as text (no remote images until a domain exists, OQ-092). Every user-supplied value is HTML-encoded.
/// </summary>
public static class EmailTemplates
{
    public const string InvitationKind = "invitation";
    public const string PasswordResetKind = "password_reset";

    private const string Olive = "#3F4F2A";
    private const string Brick = "#C8553D";
    private const string Apricot = "#F4A261";
    private const string Cream = "#F7F3EA";
    private const string Mist = "#EFF1EB";
    private const string Muted = "#6B6F5E";

    /// <summary>The welcome email with the one-time registration link (72 hours).</summary>
    public static EmailMessage Invitation(string toEmail, string fullName, string? storeName, string registerLink, int validHours)
    {
        var first = FirstName(fullName);
        var store = string.IsNullOrWhiteSpace(storeName) ? null : storeName.Trim();
        var body = new StringBuilder()
            .Append(Paragraph($"أهلًا {E(first)}، 👋", bold: true))
            .Append(Paragraph(store is null
                ? "مبروك، صرت من عيلة لمّة! من اليوم طلباتك ومخزونك وزباينك وأرباحك كلهم بمكان واحد."
                : $"مبروك، صرت أنت و<b>{E(store)}</b> من عيلة لمّة! من اليوم طلباتك ومخزونك وزباينك وأرباحك كلهم بمكان واحد."))
            .Append(Paragraph("ضلّت خطوة وحدة بسيطة: اختار كلمة السر، وبتبلّش تجربتك المجانية لمدة شهر كامل، بكل المزايا وبدون بطاقة."))
            .Append(Button("أكمل تسجيلك", registerLink))
            .Append(Steps())
            .Append(Note($"الرابط إلك لحالك، بيشتغل مرة وحدة، وصالح لمدة {validHours} ساعة. إذا ما طلبت التسجيل بلمّة، تجاهل هاد الإيميل."))
            .ToString();

        var text = $"أهلًا {first}،\n\nمبروك، صرت من عيلة لمّة! ضلّت خطوة وحدة: اختار كلمة السر من هالرابط وبتبلّش تجربتك المجانية لمدة شهر:\n{registerLink}\n\nالرابط بيشتغل مرة وحدة وصالح لمدة {validHours} ساعة.\n\nلمّة · كل شغلك بمكان واحد";
        return new EmailMessage(toEmail, "أهلًا فيك بعيلة لمّة 🎉 ضلّت خطوة وحدة", Layout("أهلًا فيك بعيلة لمّة", body), text, InvitationKind, registerLink);
    }

    /// <summary>Password recovery link (D-078), in the same branded frame.</summary>
    public static EmailMessage PasswordReset(string toEmail, string fullName, string resetLink)
    {
        var body = new StringBuilder()
            .Append(Paragraph($"أهلًا {E(FirstName(fullName))}،", bold: true))
            .Append(Paragraph("وصلنا طلب لتغيير كلمة السر لحسابك بلمّة. اكبس الزر واختار كلمة سر جديدة."))
            .Append(Button("غيّر كلمة السر", resetLink))
            .Append(Note("إذا ما طلبت تغيير كلمة السر، تجاهل هاد الإيميل وحسابك بضل زي ما هو."))
            .ToString();
        var text = $"أهلًا {FirstName(fullName)}،\n\nلتغيير كلمة السر لحسابك بلمّة افتح هالرابط:\n{resetLink}\n\nإذا ما طلبت هاد التغيير تجاهل الإيميل.";
        return new EmailMessage(toEmail, "تغيير كلمة السر بلمّة", Layout("تغيير كلمة السر", body), text, PasswordResetKind, resetLink);
    }

    private static string FirstName(string fullName)
    {
        var name = fullName.Trim();
        var space = name.IndexOf(' ', StringComparison.Ordinal);
        return space > 0 ? name[..space] : name;
    }

    private static string E(string value) => WebUtility.HtmlEncode(value);

    private static string Paragraph(string html, bool bold = false)
        => $"<p style=\"margin:0 0 14px;font-size:{(bold ? 18 : 15)}px;line-height:1.8;color:{Olive};{(bold ? "font-weight:700;" : string.Empty)}\">{html}</p>";

    private static string Button(string label, string href)
        => $"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:22px 0;\"><tr><td style=\"background:{Brick};border-radius:12px;\">"
           + $"<a href=\"{E(href)}\" style=\"display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;\">{label}</a>"
           + "</td></tr></table>";

    private static string Steps()
    {
        var rows = new[] { ("1", "اختار كلمة السر"), ("2", "عرّفنا على متجرك بدقيقة"), ("3", "سجّل أول طلب، ولمّة بتحسبلك الباقي") };
        var sb = new StringBuilder($"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background:{Mist};border-radius:14px;margin:6px 0 18px;\">");
        foreach (var (n, t) in rows)
        {
            sb.Append($"<tr><td style=\"padding:10px 16px;font-size:14px;color:{Olive};\"><span style=\"display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:{Apricot};color:{Olive};font-weight:700;margin-left:10px;\">{n}</span>{t}</td></tr>");
        }

        return sb.Append("</table>").ToString();
    }

    private static string Note(string text) => $"<p style=\"margin:0;font-size:12.5px;line-height:1.7;color:{Muted};\">{text}</p>";

    private static string Layout(string title, string body)
        => "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
           + $"<title>{E(title)}</title></head>"
           + $"<body style=\"margin:0;padding:0;background:{Cream};font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl;text-align:right;\">"
           + $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:{Cream};padding:28px 12px;\"><tr><td align=\"center\">"
           + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;\">"
           + $"<tr><td style=\"padding:0 8px 16px;text-align:right;\"><span style=\"font-size:30px;font-weight:800;color:{Olive};\">ل<span style=\"color:{Brick};\">مّ</span>ة</span>"
           + $"<span style=\"font-size:13px;color:{Muted};margin-right:10px;\">كل شغلك بمكان واحد</span></td></tr>"
           + $"<tr><td style=\"background:#ffffff;border-radius:20px;padding:30px 28px;border:1px solid #E4E2D3;border-top:6px solid {Apricot};\">{body}</td></tr>"
           + $"<tr><td style=\"padding:18px 8px 0;font-size:12px;color:{Muted};text-align:center;\">لمّة · إدارة الطلبات والمخزون والأرباح للبيّاعين على السوشال ميديا بالأردن</td></tr>"
           + "</table></td></tr></table></body></html>";
}
