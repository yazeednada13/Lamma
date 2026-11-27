using System.Text.Json.Serialization;
using Lamma.Application.Common;
using Lamma.Application.Common.Email;
using Lamma.Application.Common.Serialization;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Subscriptions;

namespace Lamma.Application.Subscriptions;

// ---------- Contracts (API-DESIGN §21, part 11-II) ----------

/// <summary>The status in one line: shared by the account (banners) and the subscription page (D-183).</summary>
public sealed record SubscriptionSummaryDto(
    string Status,
    bool ReadOnly,
    int DaysLeft,
    DateOnly? EndsOn,
    string Plan,
    DateOnly? PaidUntil)
{
    public static SubscriptionSummaryDto From(SubscriptionSnapshot s)
        => new(s.State.ToCode(), s.ReadOnly, s.DaysLeft, s.EndsOn, s.PlanCode, s.PaidUntil);
}

public sealed record PlanOptionDto(string Plan, [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Price, int Months);

public sealed record PeriodDto(
    Guid Id,
    string Plan,
    DateOnly StartsOn,
    DateOnly EndsOn,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Source,
    bool Cancelled,
    DateTime CreatedAt);

public sealed record PaymentRequestDto(
    Guid Id,
    string Plan,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Status,
    string? RejectReason,
    DateTime SubmittedAt,
    DateTime? ReviewedAt);

public sealed record SubscriptionDto(
    SubscriptionSummaryDto Summary,
    DateTime TrialStartsAt,
    DateTime TrialEndsAt,
    IReadOnlyList<PlanOptionDto> Plans,
    string CliqAlias,
    string CliqName,
    string ReferenceCode,
    PaymentRequestDto? Pending,
    PaymentRequestDto? LastReviewed,
    IReadOnlyList<PeriodDto> Periods);

/// <summary>A stored proof file (owner or admin download).</summary>
public sealed record ProofFile(Stream Content, string ContentType, string FileName);

// ---------- Ports ----------

/// <summary>The CliQ details shown to subscribers (D-179). Server settings, not secret.</summary>
public interface IBillingSettings
{
    string CliqAlias { get; }

    string CliqName { get; }
}

/// <summary>The platform admins (D-175, D-182): emails from a server setting, role checks against Identity.</summary>
public interface IPlatformAdmins
{
    IReadOnlyList<string> Emails { get; }

    Task<bool> IsAdminAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Gives the PlatformAdmin role to the user with this email when it is listed (idempotent).</summary>
    Task SyncAsync(string email, CancellationToken cancellationToken);
}

/// <summary>Who to email about a business: its owner.</summary>
public interface IBusinessContacts
{
    Task<(string Email, string FullName)?> GetOwnerAsync(Guid businessId, CancellationToken cancellationToken);
}

/// <summary>Billing data. Platform-level rows (not tenant-filtered): every method takes the business explicitly.</summary>
public interface ISubscriptionRepository
{
    Task<Business?> GetBusinessAsync(Guid businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SubscriptionPeriod>> GetPeriodsAsync(Guid businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PaymentRequest>> GetRequestsAsync(Guid businessId, CancellationToken cancellationToken);

    Task<PaymentRequest?> GetRequestAsync(Guid id, CancellationToken cancellationToken);

    Task<int> NextReferenceNumberAsync(CancellationToken cancellationToken);

    void Add(SubscriptionPeriod period);

    void Add(PaymentRequest request);
}

// ---------- Status reader (once per request) ----------

/// <summary>The current business's status; read by the read-only filter and the account (D-162, D-176).</summary>
public interface ISubscriptionReader
{
    /// <summary>Null when the current user has no business.</summary>
    Task<SubscriptionSnapshot?> GetCurrentAsync(CancellationToken cancellationToken);

    Task<SubscriptionSnapshot?> GetForBusinessAsync(Guid businessId, CancellationToken cancellationToken);
}

internal sealed class SubscriptionReader(ICurrentBusiness currentBusiness, ISubscriptionRepository repository, IClock clock) : ISubscriptionReader
{
    private readonly Dictionary<Guid, SubscriptionSnapshot?> _cache = [];

    public Task<SubscriptionSnapshot?> GetCurrentAsync(CancellationToken cancellationToken)
        => currentBusiness.HasBusiness ? GetForBusinessAsync(currentBusiness.BusinessId, cancellationToken) : Task.FromResult<SubscriptionSnapshot?>(null);

    public async Task<SubscriptionSnapshot?> GetForBusinessAsync(Guid businessId, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(businessId, out var cached))
        {
            return cached;
        }

        var business = await repository.GetBusinessAsync(businessId, cancellationToken);
        SubscriptionSnapshot? snapshot = null;
        if (business is not null)
        {
            var periods = await repository.GetPeriodsAsync(businessId, cancellationToken);
            snapshot = SubscriptionStatus.Compute(business.TrialEndsAt, periods, business.SuspendedAt, clock.UtcNow, BusinessTime.FindZone(business.TimeZoneId));
        }

        _cache[businessId] = snapshot;
        return snapshot;
    }
}

// ---------- Proof files (D-178) ----------

public static class ProofFiles
{
    public const long MaxBytes = 5 * 1024 * 1024;

    /// <summary>jpg/png/webp by their signature (shared with product images), or pdf (%PDF-).</summary>
    public static (string Extension, string ContentType)? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 5 && header[..5].SequenceEqual("%PDF-"u8))
        {
            return ("pdf", "application/pdf");
        }

        return Catalog.ImageSignature.Detect(header);
    }

    public static async Task<MemoryStream> ReadBoundedAsync(Stream source, CancellationToken cancellationToken)
    {
        var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + read > MaxBytes)
            {
                throw RequestValidationException.ForField("file", "حجم الملف لازم يكون 5 ميجا أو أقل.", "payment_request.file_too_large");
            }

            await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
        }

        return buffer;
    }
}

// ---------- Owner service ----------

public interface ISubscriptionService
{
    Task<SubscriptionDto> GetAsync(CancellationToken cancellationToken);

    Task<SubscriptionDto> SubmitPaymentAsync(Guid idempotencyKey, string plan, Stream proof, long length, CancellationToken cancellationToken);

    Task<ProofFile> OpenProofAsync(Guid requestId, CancellationToken cancellationToken);
}

/// <summary>The owner's subscription page and CliQ payment requests (D-163, D-165, D-178, D-179, D-184).</summary>
internal sealed class SubscriptionService(
    ICurrentBusiness currentBusiness,
    ICurrentUser currentUser,
    ISubscriptionRepository repository,
    IBillingSettings billing,
    IPlatformAdmins admins,
    IBusinessContacts contacts,
    IFileStorage storage,
    IEmailSender email,
    IAppLinks links,
    IIdempotencyService idempotency,
    IUnitOfWork unitOfWork,
    IClock clock) : ISubscriptionService
{
    public async Task<SubscriptionDto> GetAsync(CancellationToken cancellationToken)
    {
        var business = await EnsureReferenceAsync(cancellationToken);
        return await BuildAsync(business, cancellationToken);
    }

    public Task<SubscriptionDto> SubmitPaymentAsync(Guid idempotencyKey, string plan, Stream proof, long length, CancellationToken cancellationToken)
        => idempotency.ExecuteAsync(idempotencyKey, new { plan, length }, ct => SubmitAsync(plan, proof, length, ct), cancellationToken);

    public async Task<ProofFile> OpenProofAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var request = await repository.GetRequestAsync(requestId, cancellationToken);
        if (request is null || request.BusinessId != currentBusiness.BusinessId)
        {
            throw new NotFoundException("payment_request.not_found", "الدفعة مش موجودة.");
        }

        return await OpenAsync(storage, request, cancellationToken);
    }

    internal static async Task<ProofFile> OpenAsync(IFileStorage storage, PaymentRequest request, CancellationToken cancellationToken)
    {
        var stream = await storage.OpenReadAsync(request.ProofPath, cancellationToken)
            ?? throw new NotFoundException("payment_request.proof_missing", "ملف الإثبات مش موجود.");
        return new ProofFile(stream, request.ProofContentType, $"proof-{request.Id:N}{Path.GetExtension(request.ProofPath)}");
    }

    private async Task<SubscriptionDto> SubmitAsync(string planCode, Stream proof, long length, CancellationToken cancellationToken)
    {
        if (!EnumCode.TryParse<PaidPlan>(planCode, out var plan))
        {
            throw RequestValidationException.ForField("plan", "اختار الخطة: شهرية أو سنوية.", "payment_request.invalid_plan");
        }

        if (length > ProofFiles.MaxBytes)
        {
            throw RequestValidationException.ForField("file", "حجم الملف لازم يكون 5 ميجا أو أقل.", "payment_request.file_too_large");
        }

        var business = await EnsureReferenceAsync(cancellationToken);
        var requests = await repository.GetRequestsAsync(business.Id, cancellationToken);
        if (requests.Any(r => r.Status == PaymentRequestStatus.Pending))
        {
            throw new ConflictException("payment_request.pending_exists", "عندك دفعة بانتظار المراجعة. استنى لحد ما نراجعها.");
        }

        using var buffer = await ProofFiles.ReadBoundedAsync(proof, cancellationToken);
        if (buffer.Length == 0)
        {
            throw RequestValidationException.ForField("file", "ارفع صورة التحويل.", "payment_request.file_missing");
        }

        var type = ProofFiles.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16)))
                   ?? throw RequestValidationException.ForField("file", "الملف لازم يكون صورة (JPG أو PNG أو WEBP) أو PDF.", "payment_request.invalid_type");

        var id = Entity.NewId();
        var path = $"proofs/{business.Id:N}/{id:N}.{type.Extension}";
        buffer.Position = 0;
        await storage.SaveAsync(path, buffer, cancellationToken);

        var request = PaymentRequest.Submit(id, business.Id, plan, path, type.ContentType, currentUser.RequiredUserId, clock.UtcNow);
        repository.Add(request);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await storage.DeleteAsync(path, CancellationToken.None);
            throw;
        }

        var amount = MoneyJsonConverter.Format(request.Amount);
        var owner = await contacts.GetOwnerAsync(business.Id, cancellationToken);
        if (owner is { } o)
        {
            await email.SendAsync(EmailTemplates.PaymentReceived(o.Email, o.FullName, plan.ToCode(), amount, business.ReferenceCode!, links.Subscription()), cancellationToken);
        }

        foreach (var adminEmail in admins.Emails)
        {
            await email.SendAsync(EmailTemplates.PaymentForReview(adminEmail, business.Name, plan.ToCode(), amount, business.ReferenceCode!, links.AdminPayments()), cancellationToken);
        }

        return await BuildAsync(business, cancellationToken);
    }

    /// <summary>Assigns the «LM-…» reference on first use (D-184); a concurrent clash retries with the next number.</summary>
    private async Task<Business> EnsureReferenceAsync(CancellationToken cancellationToken)
    {
        var business = await repository.GetBusinessAsync(currentBusiness.BusinessId, cancellationToken)
            ?? throw new ForbiddenException("business.not_onboarded", "لازم تكمّل تهيئة مشروعك أول.");
        for (var attempt = 0; business.ReferenceNumber is null && attempt < 3; attempt++)
        {
            business.AssignReference(await repository.NextReferenceNumberAsync(cancellationToken));
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (UniqueConstraintViolationException) when (attempt < 2)
            {
                business = await repository.GetBusinessAsync(currentBusiness.BusinessId, cancellationToken) ?? business;
            }
        }

        return business;
    }

    private async Task<SubscriptionDto> BuildAsync(Business business, CancellationToken cancellationToken)
    {
        var periods = await repository.GetPeriodsAsync(business.Id, cancellationToken);
        var requests = await repository.GetRequestsAsync(business.Id, cancellationToken);
        var snapshot = SubscriptionStatus.Compute(business.TrialEndsAt, periods, business.SuspendedAt, clock.UtcNow, BusinessTime.FindZone(business.TimeZoneId));
        var pending = requests.FirstOrDefault(r => r.Status == PaymentRequestStatus.Pending);
        var lastReviewed = requests.Where(r => r.Status != PaymentRequestStatus.Pending).OrderByDescending(r => r.ReviewedAt).ThenByDescending(r => r.SubmittedAt).FirstOrDefault();
        return new SubscriptionDto(
            SubscriptionSummaryDto.From(snapshot),
            business.TrialStartsAt,
            business.TrialEndsAt,
            [new PlanOptionDto("monthly", Plans.MonthlyPrice, 1), new PlanOptionDto("yearly", Plans.YearlyPrice, 12)],
            billing.CliqAlias,
            billing.CliqName,
            business.ReferenceCode ?? string.Empty,
            pending is null ? null : ToDto(pending),
            lastReviewed is null ? null : ToDto(lastReviewed),
            periods.OrderByDescending(p => p.StartsOn).Select(ToDto).ToList());
    }

    internal static PaymentRequestDto ToDto(PaymentRequest r)
        => new(r.Id, r.Plan.ToCode(), r.Amount, r.Status.ToCode(), r.RejectReason, r.SubmittedAt, r.ReviewedAt);

    internal static PeriodDto ToDto(SubscriptionPeriod p)
        => new(p.Id, p.Plan.ToCode(), p.StartsOn, p.EndsOn, p.Amount, p.Source.ToCode(), !p.IsActive, p.CreatedAt);
}
