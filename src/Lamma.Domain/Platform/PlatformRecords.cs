using Lamma.Domain.Common;

namespace Lamma.Domain.Platform;

/// <summary>
/// One change made by the platform admin (D-164): who, what, on which business or lead, when. Written in the same
/// transaction as the change. Platform-level (no tenant filter).
/// </summary>
public sealed class AdminAuditLog : Entity
{
    public const int ActionMaxLength = 40;
    public const int DetailsMaxLength = 2000;

    private AdminAuditLog(Guid id)
        : base(id)
    {
    }

    private AdminAuditLog()
    {
    }

    public Guid AdminUserId { get; private set; }

    /// <summary>snake_case action code, e.g. extend_trial, activate_plan, approve_payment, note.</summary>
    public string Action { get; private set; } = string.Empty;

    public Guid? BusinessId { get; private set; }

    public Guid? LeadId { get; private set; }

    /// <summary>Short JSON (or the note text for «note»).</summary>
    public string? Details { get; private set; }

    /// <summary>
    /// The request's Idempotency-Key (unique): a repeated admin request finds it and is not applied twice. Admin actions
    /// cannot use the per-business idempotency store because the admin has no business.
    /// </summary>
    public Guid? RequestKey { get; private set; }

    public DateTime At { get; private set; }

    public static AdminAuditLog Record(Guid adminUserId, string action, Guid? businessId, Guid? leadId, string? details, DateTime nowUtc, Guid? requestKey = null)
    {
        Guard.NotEmpty(adminUserId, nameof(adminUserId));
        var a = Guard.NotBlank(action, nameof(action));
        return new AdminAuditLog(NewId())
        {
            AdminUserId = adminUserId,
            Action = a.Length > ActionMaxLength ? a[..ActionMaxLength] : a,
            BusinessId = businessId,
            LeadId = leadId,
            Details = details is null ? null : details.Length > DetailsMaxLength ? details[..DetailsMaxLength] : details,
            At = nowUtc,
            RequestKey = requestKey,
        };
    }
}

/// <summary>
/// One reminder sent (D-186): unique per business, kind and target date, so the daily job can run again safely.
/// Kinds: trial_7, trial_3, trial_1, plan_7, plan_3, plan_1, read_only.
/// </summary>
public sealed class ReminderLog : Entity
{
    public const int KindMaxLength = 20;

    private ReminderLog(Guid id)
        : base(id)
    {
    }

    private ReminderLog()
    {
    }

    public Guid BusinessId { get; private set; }

    public string Kind { get; private set; } = string.Empty;

    /// <summary>The end date the reminder is about (trial or plan end).</summary>
    public DateOnly TargetDate { get; private set; }

    public DateTime SentAt { get; private set; }

    public static ReminderLog Create(Guid businessId, string kind, DateOnly targetDate, DateTime nowUtc)
        => new(NewId()) { BusinessId = businessId, Kind = kind, TargetDate = targetDate, SentAt = nowUtc };
}
