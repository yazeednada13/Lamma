using Lamma.Domain.Common;
using Lamma.Domain.Customers;

namespace Lamma.Domain.Signup;

public enum SignupLeadStatus
{
    Pending,
    Registered,
}

/// <summary>
/// A person who sent the public sign-up form (D-160, D-161). Platform-level: it belongs to no business. The invitation
/// link carries a random token; only its SHA-256 hash is stored, it is valid for 72 hours, works once, and a resend
/// replaces it. At most 3 invitations are sent per email in 24 hours.
/// </summary>
public sealed class SignupLead : Entity
{
    public const int FullNameMaxLength = 100;
    public const int EmailMaxLength = 256;
    public const int StoreNameMaxLength = 100;
    public const int UtmMaxLength = 100;
    public const int TokenHashLength = 64;
    public const int InviteValidHours = 72;
    public const int MaxSendsPerWindow = 3;
    public static readonly TimeSpan SendWindow = TimeSpan.FromHours(24);

    private SignupLead(Guid id)
        : base(id)
    {
    }

    private SignupLead()
    {
    }

    public string FullName { get; private set; } = string.Empty;

    public string Email { get; private set; } = string.Empty;

    /// <summary>Upper-invariant email, unique.</summary>
    public string NormalizedEmail { get; private set; } = string.Empty;

    /// <summary>Jordanian mobile, E.164 (+9627…).</summary>
    public string PhoneE164 { get; private set; } = string.Empty;

    public string? StoreName { get; private set; }

    public string? UtmSource { get; private set; }

    public string? UtmMedium { get; private set; }

    public string? UtmCampaign { get; private set; }

    public SignupLeadStatus Status { get; private set; }

    public string? InviteTokenHash { get; private set; }

    public DateTime? InviteExpiresAt { get; private set; }

    /// <summary>All invitations ever sent to this lead.</summary>
    public int SendCount { get; private set; }

    public DateTime? SendWindowStartedAt { get; private set; }

    public int SendsInWindow { get; private set; }

    public DateTime? LastSentAt { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public DateTime? RegisteredAt { get; private set; }

    public Guid? UserId { get; private set; }

    public static SignupLead Create(string fullName, string email, string phone, string? storeName, Utm utm, DateTime nowUtc)
    {
        var lead = new SignupLead(NewId()) { CreatedAt = nowUtc, Status = SignupLeadStatus.Pending };
        lead.SetEmail(email);
        lead.Update(fullName, phone, storeName, utm, nowUtc);
        return lead;
    }

    /// <summary>Normalizes a Jordanian mobile (07…, 9627…, +9627…) to E.164, or returns null when it is not one.</summary>
    public static string? JordanMobile(string? input)
    {
        try
        {
            var e164 = PhoneNumber.Normalize(input);
            return e164 is not null && e164.StartsWith("+9627", StringComparison.Ordinal) ? e164 : null;
        }
        catch (DomainException)
        {
            return null;
        }
    }

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();

    /// <summary>A pending lead who sends the form again keeps its row; its details follow the latest form.</summary>
    public void Update(string fullName, string phone, string? storeName, Utm utm, DateTime nowUtc)
    {
        EnsurePending();
        var name = fullName.Trim();
        if (name.Length == 0 || name.Length > FullNameMaxLength)
        {
            throw new DomainException("signup.invalid_name", "الاسم مطلوب.");
        }

        FullName = name;
        PhoneE164 = JordanMobile(phone) ?? throw new DomainException("signup.invalid_phone", "اكتب رقم موبايل أردني، مثلًا 0791234567.");
        StoreName = Clip(storeName, StoreNameMaxLength);
        UtmSource = Clip(utm.Source, UtmMaxLength) ?? UtmSource;
        UtmMedium = Clip(utm.Medium, UtmMaxLength) ?? UtmMedium;
        UtmCampaign = Clip(utm.Campaign, UtmMaxLength) ?? UtmCampaign;
        UpdatedAt = nowUtc;
    }

    /// <summary>True when another invitation may be sent now (at most 3 in 24 hours).</summary>
    public bool CanSend(DateTime nowUtc)
        => Status == SignupLeadStatus.Pending
           && (SendWindowStartedAt is null || nowUtc - SendWindowStartedAt.Value >= SendWindow || SendsInWindow < MaxSendsPerWindow);

    /// <summary>Stores the hash of a new invitation token; any earlier link stops working.</summary>
    public void IssueInvite(string tokenHash, DateTime nowUtc)
    {
        EnsurePending();
        if (tokenHash.Length != TokenHashLength)
        {
            throw new ArgumentException("A SHA-256 hex hash is expected.", nameof(tokenHash));
        }

        if (!CanSend(nowUtc))
        {
            throw new DomainException("signup.too_many_sends", "وصلك أكثر من رابط اليوم. جرّب بكرة.");
        }

        if (SendWindowStartedAt is null || nowUtc - SendWindowStartedAt.Value >= SendWindow)
        {
            SendWindowStartedAt = nowUtc;
            SendsInWindow = 0;
        }

        SendsInWindow++;
        SendCount++;
        InviteTokenHash = tokenHash;
        InviteExpiresAt = nowUtc.AddHours(InviteValidHours);
        LastSentAt = nowUtc;
        UpdatedAt = nowUtc;
    }

    public bool InviteIsValid(DateTime nowUtc)
        => Status == SignupLeadStatus.Pending && InviteTokenHash is not null && InviteExpiresAt > nowUtc;

    /// <summary>The account was created from the invitation: the link is spent.</summary>
    public void MarkRegistered(Guid userId, DateTime nowUtc)
    {
        EnsurePending();
        Guard.NotEmpty(userId, nameof(userId));
        Status = SignupLeadStatus.Registered;
        UserId = userId;
        RegisteredAt = nowUtc;
        InviteTokenHash = null;
        InviteExpiresAt = null;
        UpdatedAt = nowUtc;
    }

    private void SetEmail(string email)
    {
        var trimmed = email.Trim();
        if (trimmed.Length == 0 || trimmed.Length > EmailMaxLength || !trimmed.Contains('@', StringComparison.Ordinal))
        {
            throw new DomainException("signup.invalid_email", "اكتب إيميل صحيح.");
        }

        Email = trimmed;
        NormalizedEmail = Normalize(trimmed);
    }

    private void EnsurePending()
    {
        if (Status != SignupLeadStatus.Pending)
        {
            throw new DomainException("signup.already_registered", "هاد الإيميل مسجّل من قبل.");
        }
    }

    private static string? Clip(string? value, int max)
    {
        var v = value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v.Length > max ? v[..max] : v;
    }
}

/// <summary>Where the visitor came from (the Instagram bio link carries utm_* parameters).</summary>
public sealed class Utm(string? source, string? medium, string? campaign)
{
    public static readonly Utm None = new(null, null, null);

    public string? Source { get; } = source;

    public string? Medium { get; } = medium;

    public string? Campaign { get; } = campaign;
}
