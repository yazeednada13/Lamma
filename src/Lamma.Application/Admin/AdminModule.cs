using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Common.Email;
using Lamma.Application.Common.Serialization;
using Lamma.Application.Signup;
using Lamma.Application.Subscriptions;
using Lamma.Domain.Common;
using Lamma.Domain.Platform;
using Lamma.Domain.Signup;
using Lamma.Domain.Subscriptions;

namespace Lamma.Application.Admin;

// ---------- Contracts (API-DESIGN §21, part 11-II) ----------

public sealed record WeekCountDto(DateOnly WeekStart, int Leads, int Accounts);

public sealed record AdminDashboardDto(
    int PendingLeads,
    int ActiveTrials,
    int TrialsEndingSoon,
    int Paying,
    int ReadOnly,
    int Suspended,
    int PendingPayments,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal MonthlyRevenue,
    decimal? ConversionRate,
    IReadOnlyList<WeekCountDto> Weeks);

public sealed record SubscriberRowDto(
    Guid BusinessId,
    string BusinessName,
    string OwnerName,
    string OwnerEmail,
    string? OwnerPhone,
    SubscriptionSummaryDto Subscription,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    bool HasPendingPayment);

public sealed class SubscribersQuery
{
    public string? Search { get; set; }

    /// <summary>A status code (trial, trial_grace, …) or «read_only».</summary>
    public string? Status { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}

public sealed record AuditEntryDto(Guid Id, string Action, string? Details, DateTime At);

public sealed record AdminPaymentDto(
    Guid Id,
    Guid BusinessId,
    string BusinessName,
    string OwnerName,
    string? ReferenceCode,
    string Plan,
    [property: JsonConverter(typeof(MoneyJsonConverter))] decimal Amount,
    string Status,
    string? RejectReason,
    DateTime SubmittedAt,
    DateTime? ReviewedAt,
    string ProofContentType);

/// <summary>Account and billing metadata only, plus counts (P-025): no customers, orders or finances.</summary>
public sealed record SubscriberDetailDto(
    SubscriberRowDto Row,
    string BusinessType,
    string? ReferenceCode,
    DateTime TrialStartsAt,
    DateTime TrialEndsAt,
    string? SuspendReason,
    int OrdersCount,
    int ProductsCount,
    IReadOnlyList<PeriodDto> Periods,
    IReadOnlyList<AdminPaymentDto> Payments,
    IReadOnlyList<AuditEntryDto> Notes,
    IReadOnlyList<AuditEntryDto> Audit);

public sealed record LeadDto(
    Guid Id,
    string FullName,
    string Email,
    string PhoneE164,
    string? StoreName,
    string Status,
    string? UtmSource,
    int SendCount,
    DateTime? LastSentAt,
    DateTime CreatedAt,
    DateTime? RegisteredAt);

public sealed class LeadsQuery
{
    public string? Search { get; set; }

    public string? Status { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}

public sealed record ExtendDaysRequest(int Days);

public sealed record ActivatePlanRequest(
    string Plan,
    DateOnly? StartsOn,
    [property: JsonConverter(typeof(NullableMoneyJsonConverter))] decimal? Amount,
    string? Reference,
    string? Note);

public sealed record ReasonRequest(string Reason);

public sealed record NoteRequest(string Text);

public sealed class ExtendDaysRequestValidator : AbstractValidator<ExtendDaysRequest>
{
    public ExtendDaysRequestValidator() => RuleFor(x => x.Days).InclusiveBetween(1, 366).WithMessage("عدد الأيام لازم يكون بين 1 و366.");
}

public sealed class ActivatePlanRequestValidator : AbstractValidator<ActivatePlanRequest>
{
    public ActivatePlanRequestValidator()
    {
        RuleFor(x => x.Plan).Must(p => EnumCode.TryParse<PaidPlan>(p, out _)).WithMessage("اختار الخطة: شهرية أو سنوية.");
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(0).When(x => x.Amount is not null).WithMessage("المبلغ لازم يكون صفر أو أكثر.");
        RuleFor(x => x.Reference).MaximumLength(SubscriptionPeriod.ReferenceMaxLength);
        RuleFor(x => x.Note).MaximumLength(SubscriptionPeriod.NoteMaxLength);
    }
}

public sealed class ReasonRequestValidator : AbstractValidator<ReasonRequest>
{
    public ReasonRequestValidator() => RuleFor(x => x.Reason).Must(r => !string.IsNullOrWhiteSpace(r)).WithMessage("اكتب السبب.").MaximumLength(300);
}

public sealed class NoteRequestValidator : AbstractValidator<NoteRequest>
{
    public NoteRequestValidator() => RuleFor(x => x.Text).Must(r => !string.IsNullOrWhiteSpace(r)).WithMessage("اكتب الملاحظة.").MaximumLength(1000);
}

// ---------- Ports ----------

/// <summary>One business as the admin sees it: billing inputs and the owner (P-025).</summary>
public sealed record AdminBusinessRow(
    Guid Id,
    string Name,
    string BusinessType,
    string TimeZoneId,
    DateTime TrialStartsAt,
    DateTime TrialEndsAt,
    DateTime? SuspendedAt,
    string? SuspendReason,
    string? ReferenceCode,
    DateTime CreatedAt,
    string OwnerName,
    string OwnerEmail,
    string? OwnerPhone,
    DateTime? LastLoginAt);

/// <summary>Read side of the admin area. Platform-level: it reads across businesses (never their customers or orders).</summary>
public interface IAdminQueries
{
    Task<IReadOnlyList<AdminBusinessRow>> BusinessesAsync(Guid? businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SubscriptionPeriod>> PeriodsAsync(Guid? businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PaymentRequest>> PaymentRequestsAsync(Guid? businessId, PaymentRequestStatus? status, CancellationToken cancellationToken);

    Task<(int Orders, int Products)> CountsAsync(Guid businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<AdminAuditLog>> AuditAsync(Guid businessId, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<SignupLead>> LeadsAsync(CancellationToken cancellationToken);
}

public interface IAdminRepository
{
    Task<Domain.Businesses.Business?> GetBusinessAsync(Guid businessId, CancellationToken cancellationToken);

    Task<SubscriptionPeriod?> GetCurrentPeriodAsync(Guid businessId, DateOnly today, CancellationToken cancellationToken);

    void Add(SubscriptionPeriod period);

    void Add(AdminAuditLog entry);

    /// <summary>True when an admin change with this Idempotency-Key was already saved.</summary>
    Task<bool> RequestKeyUsedAsync(Guid key, CancellationToken cancellationToken);

    /// <summary>Drops pending changes after a lost race, so the replay reads the winner's state.</summary>
    void Reset();
}

// ---------- Service ----------

public interface IAdminService
{
    Task<AdminDashboardDto> DashboardAsync(CancellationToken cancellationToken);

    Task<PagedResult<SubscriberRowDto>> SubscribersAsync(SubscribersQuery query, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> SubscriberAsync(Guid businessId, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> ExtendTrialAsync(Guid key, Guid businessId, ExtendDaysRequest request, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> ActivatePlanAsync(Guid key, Guid businessId, ActivatePlanRequest request, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> ExtendPlanAsync(Guid key, Guid businessId, ExtendDaysRequest request, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> EndPlanAsync(Guid key, Guid businessId, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> SuspendAsync(Guid key, Guid businessId, ReasonRequest request, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> ReactivateAsync(Guid key, Guid businessId, CancellationToken cancellationToken);

    Task<SubscriberDetailDto> AddNoteAsync(Guid key, Guid businessId, NoteRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<AdminPaymentDto>> PaymentsAsync(string? status, CancellationToken cancellationToken);

    Task<ProofFile> OpenProofAsync(Guid requestId, CancellationToken cancellationToken);

    Task<AdminPaymentDto> ApprovePaymentAsync(Guid key, Guid requestId, CancellationToken cancellationToken);

    Task<AdminPaymentDto> RejectPaymentAsync(Guid key, Guid requestId, ReasonRequest request, CancellationToken cancellationToken);

    Task<PagedResult<LeadDto>> LeadsAsync(LeadsQuery query, CancellationToken cancellationToken);

    Task<LeadDto> ResendInviteAsync(Guid key, Guid leadId, CancellationToken cancellationToken);
}

/// <summary>The platform admin area (D-164, D-175, P-025): status computed (D-167), every change audited.</summary>
internal sealed class AdminService(
    IAdminQueries queries,
    IAdminRepository repository,
    ISubscriptionRepository billing,
    ISignupService signup,
    IBusinessContacts contacts,
    ICurrentUser currentUser,
    IFileStorage storage,
    IEmailSender email,
    IAppLinks links,
    IUnitOfWork unitOfWork,
    IClock clock) : IAdminService
{
    public const int EndingSoonDays = 7;
    public const int Weeks = 8;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public async Task<AdminDashboardDto> DashboardAsync(CancellationToken cancellationToken)
    {
        var rows = await BuildRowsAsync(null, cancellationToken);
        var periods = await queries.PeriodsAsync(null, cancellationToken);
        var pending = await queries.PaymentRequestsAsync(null, PaymentRequestStatus.Pending, cancellationToken);
        var leads = await queries.LeadsAsync(cancellationToken);
        var now = clock.UtcNow;

        var states = rows.Select(r => r.Subscription).ToList();
        var paying = rows.Where(r => r.Subscription.Status is "active" or "active_grace").ToList();

        // Monthly revenue: the monthly value of each paid period running today.
        var revenue = 0m;
        foreach (var r in rows.Where(r => r.Subscription.Status == "active"))
        {
            var today = BusinessTime.LocalDate(now, BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId));
            var current = periods.Where(p => p.BusinessId == r.BusinessId && p.IsActive && p.StartsOn <= today && p.EndsOn >= today).OrderByDescending(p => p.StartsOn).FirstOrDefault();
            if (current is not null)
            {
                revenue += Plans.MonthlyValue(current.Plan);
            }
        }

        // Conversion: businesses that ever paid ÷ businesses past their trial or paying.
        var everPaid = periods.Where(p => p.IsActive).Select(p => p.BusinessId).ToHashSet();
        var decided = rows.Count(r => everPaid.Contains(r.BusinessId) || r.Subscription.Status is "trial_ended" or "trial_grace");

        var zone = BusinessTime.FindZone(BusinessTime.DefaultTimeZoneId);
        var thisWeek = StartOfWeek(BusinessTime.LocalDate(now, zone));
        var weeks = Enumerable.Range(0, Weeks).Select(i => thisWeek.AddDays(-7 * (Weeks - 1 - i))).ToList();
        int InWeek(DateTime at, DateOnly start)
        {
            var d = BusinessTime.LocalDate(at, zone);
            return d >= start && d < start.AddDays(7) ? 1 : 0;
        }

        return new AdminDashboardDto(
            leads.Count(l => l.Status == SignupLeadStatus.Pending),
            states.Count(s => s.Status is "trial" or "trial_grace"),
            states.Count(s => s.Status == "trial" && s.DaysLeft <= EndingSoonDays),
            paying.Count,
            states.Count(s => s.ReadOnly && s.Status != "suspended"),
            states.Count(s => s.Status == "suspended"),
            pending.Count,
            MoneyMath.Round(revenue),
            decided == 0 ? null : Math.Round(everPaid.Count(b => rows.Any(r => r.BusinessId == b)) * 100m / decided, 1, MidpointRounding.AwayFromZero),
            weeks.Select(w => new WeekCountDto(w, leads.Sum(l => InWeek(l.CreatedAt, w)), rows.Sum(r => InWeek(r.CreatedAt, w)))).ToList());
    }

    public async Task<PagedResult<SubscriberRowDto>> SubscribersAsync(SubscribersQuery query, CancellationToken cancellationToken)
    {
        IEnumerable<SubscriberRowDto> rows = await BuildRowsAsync(null, cancellationToken);
        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            var digits = new string(search.Where(char.IsDigit).ToArray());
            rows = rows.Where(r =>
                r.BusinessName.Contains(search, StringComparison.OrdinalIgnoreCase)
                || r.OwnerName.Contains(search, StringComparison.OrdinalIgnoreCase)
                || r.OwnerEmail.Contains(search, StringComparison.OrdinalIgnoreCase)
                || (digits.Length >= 3 && (r.OwnerPhone ?? string.Empty).Contains(digits.TrimStart('0'), StringComparison.Ordinal)));
        }

        if (!string.IsNullOrEmpty(query.Status))
        {
            rows = query.Status == "read_only" ? rows.Where(r => r.Subscription.ReadOnly) : rows.Where(r => r.Subscription.Status == query.Status);
        }

        var list = rows.OrderByDescending(r => r.HasPendingPayment).ThenByDescending(r => r.CreatedAt).ToList();
        var size = Math.Clamp(query.PageSize, 1, 100);
        var page = Math.Max(1, query.Page);
        return new PagedResult<SubscriberRowDto>(list.Skip((page - 1) * size).Take(size).ToList(), page, size, list.Count);
    }

    public async Task<SubscriberDetailDto> SubscriberAsync(Guid businessId, CancellationToken cancellationToken)
    {
        var rows = await queries.BusinessesAsync(businessId, cancellationToken);
        var row = rows.FirstOrDefault() ?? throw NotFound();
        var periods = await queries.PeriodsAsync(businessId, cancellationToken);
        var payments = await queries.PaymentRequestsAsync(businessId, null, cancellationToken);
        var (orders, products) = await queries.CountsAsync(businessId, cancellationToken);
        var audit = await queries.AuditAsync(businessId, 50, cancellationToken);
        var subscriber = ToRow(row, periods, payments);
        return new SubscriberDetailDto(
            subscriber,
            row.BusinessType,
            row.ReferenceCode,
            row.TrialStartsAt,
            row.TrialEndsAt,
            row.SuspendReason,
            orders,
            products,
            periods.OrderByDescending(p => p.StartsOn).Select(SubscriptionService.ToDto).ToList(),
            payments.OrderByDescending(p => p.SubmittedAt).Select(p => ToPayment(p, row)).ToList(),
            audit.Where(a => a.Action == "note").Select(ToAudit).ToList(),
            audit.Where(a => a.Action != "note").Select(ToAudit).ToList());
    }

    public Task<SubscriberDetailDto> ExtendTrialAsync(Guid key, Guid businessId, ExtendDaysRequest request, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, request, "extend_trial", (business, _, _) =>
        {
            business.ExtendTrial(request.Days, clock.UtcNow);
            return Task.FromResult<string?>(Details(new { days = request.Days, trialEndsAt = business.TrialEndsAt }));
        }, cancellationToken);

    public Task<SubscriberDetailDto> ActivatePlanAsync(Guid key, Guid businessId, ActivatePlanRequest request, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, request, "activate_plan", async (business, adminId, ct) =>
        {
            var plan = EnumCode.Parse<PaidPlan>(request.Plan);
            var periods = await billing.GetPeriodsAsync(business.Id, ct);
            var now = clock.UtcNow;
            var start = request.StartsOn ?? SubscriptionStatus.NextStart(business.TrialEndsAt, periods, now, BusinessTime.FindZone(business.TimeZoneId));
            var period = SubscriptionPeriod.Create(business.Id, plan, start, request.Amount ?? Plans.Price(plan), PeriodSource.Admin, null, adminId, request.Reference, request.Note, now);
            repository.Add(period);
            return Details(new { plan = plan.ToCode(), startsOn = period.StartsOn, endsOn = period.EndsOn, amount = period.Amount, reference = period.CliqReference });
        }, cancellationToken);

    public Task<SubscriberDetailDto> ExtendPlanAsync(Guid key, Guid businessId, ExtendDaysRequest request, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, request, "extend_plan", async (business, _, ct) =>
        {
            var period = await LatestRunningOrNextAsync(business, ct) ?? throw NoPlan();
            period.Extend(request.Days);
            return Details(new { days = request.Days, endsOn = period.EndsOn });
        }, cancellationToken);

    public Task<SubscriberDetailDto> EndPlanAsync(Guid key, Guid businessId, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, new { end = true }, "end_plan", async (business, adminId, ct) =>
        {
            var period = await LatestRunningOrNextAsync(business, ct) ?? throw NoPlan();
            period.Cancel(adminId, clock.UtcNow);
            return Details(new { periodId = period.Id, plan = period.Plan.ToCode() });
        }, cancellationToken);

    public Task<SubscriberDetailDto> SuspendAsync(Guid key, Guid businessId, ReasonRequest request, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, request, "suspend", (business, _, _) =>
        {
            business.Suspend(request.Reason, clock.UtcNow);
            return Task.FromResult<string?>(Details(new { reason = request.Reason.Trim() }));
        }, cancellationToken);

    public Task<SubscriberDetailDto> ReactivateAsync(Guid key, Guid businessId, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, new { reactivate = true }, "reactivate", (business, _, _) =>
        {
            business.Reactivate();
            return Task.FromResult<string?>(null);
        }, cancellationToken);

    public Task<SubscriberDetailDto> AddNoteAsync(Guid key, Guid businessId, NoteRequest request, CancellationToken cancellationToken)
        => ChangeAsync(key, businessId, request, "note", (_, _, _) => Task.FromResult<string?>(request.Text.Trim()), cancellationToken);

    public async Task<IReadOnlyList<AdminPaymentDto>> PaymentsAsync(string? status, CancellationToken cancellationToken)
    {
        PaymentRequestStatus? filter = string.IsNullOrEmpty(status) ? null
            : EnumCode.TryParse<PaymentRequestStatus>(status, out var s) ? s
            : throw RequestValidationException.ForField("status", "الحالة مش معروفة.", "admin.invalid_status");
        var requests = await queries.PaymentRequestsAsync(null, filter, cancellationToken);
        var rows = (await queries.BusinessesAsync(null, cancellationToken)).ToDictionary(r => r.Id);
        return requests
            .Where(r => rows.ContainsKey(r.BusinessId))
            .OrderBy(r => r.Status == PaymentRequestStatus.Pending ? 0 : 1)
            .ThenByDescending(r => r.SubmittedAt)
            .Select(r => ToPayment(r, rows[r.BusinessId]))
            .ToList();
    }

    public async Task<ProofFile> OpenProofAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var request = await billing.GetRequestAsync(requestId, cancellationToken) ?? throw PaymentNotFound();
        return await SubscriptionService.OpenAsync(storage, request, cancellationToken);
    }

    public async Task<AdminPaymentDto> ApprovePaymentAsync(Guid key, Guid requestId, CancellationToken cancellationToken)
    {
        (string Email, string FullName)? notify = null;
        PaymentRequest? approved = null;
        SubscriptionPeriod? opened = null;
        await RunOnceAsync(key, async ct =>
        {
            var adminId = currentUser.RequiredUserId;
            var request = await billing.GetRequestAsync(requestId, ct) ?? throw PaymentNotFound();
            var business = await repository.GetBusinessAsync(request.BusinessId, ct) ?? throw NotFound();
            var periods = await billing.GetPeriodsAsync(business.Id, ct);
            var now = clock.UtcNow;
            var start = SubscriptionStatus.NextStart(business.TrialEndsAt, periods, now, BusinessTime.FindZone(business.TimeZoneId)); // D-177
            var period = SubscriptionPeriod.Create(business.Id, request.Plan, start, request.Amount, PeriodSource.Payment, request.Id, adminId, business.ReferenceCode, null, now);
            repository.Add(period);
            request.Approve(period.Id, adminId, now);
            repository.Add(AdminAuditLog.Record(adminId, "approve_payment", business.Id, null, Details(new { requestId, plan = request.Plan.ToCode(), startsOn = period.StartsOn, endsOn = period.EndsOn }), now, key));
            await unitOfWork.SaveChangesAsync(ct);
            notify = await contacts.GetOwnerAsync(business.Id, ct);
            (approved, opened) = (request, period);
        }, cancellationToken);

        if (notify is { } o && approved is not null && opened is not null)
        {
            await email.SendAsync(EmailTemplates.PaymentApproved(o.Email, o.FullName, approved.Plan.ToCode(), opened.StartsOn, opened.EndsOn, links.Home()), cancellationToken);
        }

        return await PaymentDtoAsync(await billing.GetRequestAsync(requestId, cancellationToken) ?? throw PaymentNotFound(), cancellationToken);
    }

    public async Task<AdminPaymentDto> RejectPaymentAsync(Guid key, Guid requestId, ReasonRequest request, CancellationToken cancellationToken)
    {
        (string Email, string FullName)? notify = null;
        string? reason = null;
        await RunOnceAsync(key, async ct =>
        {
            var adminId = currentUser.RequiredUserId;
            var payment = await billing.GetRequestAsync(requestId, ct) ?? throw PaymentNotFound();
            var now = clock.UtcNow;
            payment.Reject(request.Reason, adminId, now);
            repository.Add(AdminAuditLog.Record(adminId, "reject_payment", payment.BusinessId, null, Details(new { requestId, reason = payment.RejectReason }), now, key));
            await unitOfWork.SaveChangesAsync(ct);
            notify = await contacts.GetOwnerAsync(payment.BusinessId, ct);
            reason = payment.RejectReason;
        }, cancellationToken);

        if (notify is { } o && reason is not null)
        {
            await email.SendAsync(EmailTemplates.PaymentRejected(o.Email, o.FullName, reason, links.Subscription()), cancellationToken);
        }

        return await PaymentDtoAsync(await billing.GetRequestAsync(requestId, cancellationToken) ?? throw PaymentNotFound(), cancellationToken);
    }

    public async Task<PagedResult<LeadDto>> LeadsAsync(LeadsQuery query, CancellationToken cancellationToken)
    {
        IEnumerable<SignupLead> leads = await queries.LeadsAsync(cancellationToken);
        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            leads = leads.Where(l => l.FullName.Contains(search, StringComparison.OrdinalIgnoreCase)
                                     || l.Email.Contains(search, StringComparison.OrdinalIgnoreCase)
                                     || l.PhoneE164.Contains(search.TrimStart('0'), StringComparison.Ordinal)
                                     || (l.StoreName ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrEmpty(query.Status) && EnumCode.TryParse<SignupLeadStatus>(query.Status, out var status))
        {
            leads = leads.Where(l => l.Status == status);
        }

        var list = leads.OrderByDescending(l => l.CreatedAt).ToList();
        var size = Math.Clamp(query.PageSize, 1, 100);
        var page = Math.Max(1, query.Page);
        return new PagedResult<LeadDto>(list.Skip((page - 1) * size).Take(size).Select(ToLead).ToList(), page, size, list.Count);
    }

    public async Task<LeadDto> ResendInviteAsync(Guid key, Guid leadId, CancellationToken cancellationToken)
    {
        await RunOnceAsync(key, async ct =>
        {
            await signup.ResendAsync(leadId, ct);
            repository.Add(AdminAuditLog.Record(currentUser.RequiredUserId, "resend_invite", null, leadId, null, clock.UtcNow, key));
            await unitOfWork.SaveChangesAsync(ct);
        }, cancellationToken);
        var lead = (await queries.LeadsAsync(cancellationToken)).FirstOrDefault(l => l.Id == leadId) ?? throw new NotFoundException("signup.lead_not_found", "الطلب مش موجود.");
        return ToLead(lead);
    }

    // ---------- helpers ----------

    /// <summary>
    /// Runs one admin change and its audit row in one save. The audit row keeps the Idempotency-Key (unique), so a
    /// repeated request is not applied twice: it returns the current detail instead.
    /// </summary>
    private async Task<SubscriberDetailDto> ChangeAsync(
        Guid key,
        Guid businessId,
        object request,
        string action,
        Func<Domain.Businesses.Business, Guid, CancellationToken, Task<string?>> change,
        CancellationToken cancellationToken)
    {
        _ = request;
        await RunOnceAsync(key, async ct =>
        {
            var adminId = currentUser.RequiredUserId;
            var business = await repository.GetBusinessAsync(businessId, ct) ?? throw NotFound();
            var details = await change(business, adminId, ct);
            repository.Add(AdminAuditLog.Record(adminId, action, businessId, null, details, clock.UtcNow, key));
            await unitOfWork.SaveChangesAsync(ct);
        }, cancellationToken);
        return await SubscriberAsync(businessId, cancellationToken);
    }

    /// <summary>Applies <paramref name="work"/> unless this key was used; a concurrent duplicate loses on the unique key.</summary>
    private async Task RunOnceAsync(Guid key, Func<CancellationToken, Task> work, CancellationToken cancellationToken)
    {
        if (await repository.RequestKeyUsedAsync(key, cancellationToken))
        {
            return;
        }

        try
        {
            await unitOfWork.ExecuteInTransactionAsync(work, cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            if (!await KeyUsedAfterResetAsync(key, cancellationToken))
            {
                throw; // a real conflict, not a duplicate of this request
            }

            // the same request won in parallel; its result is now the current state
        }
    }

    private async Task<bool> KeyUsedAfterResetAsync(Guid key, CancellationToken cancellationToken)
    {
        repository.Reset();
        return await repository.RequestKeyUsedAsync(key, cancellationToken);
    }

    /// <summary>The period running today, or else the latest one still ahead.</summary>
    private async Task<SubscriptionPeriod?> LatestRunningOrNextAsync(Domain.Businesses.Business business, CancellationToken cancellationToken)
    {
        var today = BusinessTime.LocalDate(clock.UtcNow, BusinessTime.FindZone(business.TimeZoneId));
        return await repository.GetCurrentPeriodAsync(business.Id, today, cancellationToken);
    }

    private async Task<List<SubscriberRowDto>> BuildRowsAsync(Guid? businessId, CancellationToken cancellationToken)
    {
        var rows = await queries.BusinessesAsync(businessId, cancellationToken);
        var periods = await queries.PeriodsAsync(businessId, cancellationToken);
        var payments = await queries.PaymentRequestsAsync(businessId, null, cancellationToken);
        return rows.Select(r => ToRow(r, periods, payments)).ToList();
    }

    private SubscriberRowDto ToRow(AdminBusinessRow r, IReadOnlyList<SubscriptionPeriod> periods, IReadOnlyList<PaymentRequest> payments)
    {
        var snapshot = SubscriptionStatus.Compute(r.TrialEndsAt, periods.Where(p => p.BusinessId == r.Id), r.SuspendedAt, clock.UtcNow, BusinessTime.FindZone(r.TimeZoneId));
        return new SubscriberRowDto(
            r.Id,
            r.Name,
            r.OwnerName,
            r.OwnerEmail,
            r.OwnerPhone,
            SubscriptionSummaryDto.From(snapshot),
            r.CreatedAt,
            r.LastLoginAt,
            payments.Any(p => p.BusinessId == r.Id && p.Status == PaymentRequestStatus.Pending));
    }

    private async Task<AdminPaymentDto> PaymentDtoAsync(PaymentRequest request, CancellationToken cancellationToken)
    {
        var row = (await queries.BusinessesAsync(request.BusinessId, cancellationToken)).FirstOrDefault() ?? throw NotFound();
        return ToPayment(request, row);
    }

    private static AdminPaymentDto ToPayment(PaymentRequest p, AdminBusinessRow row)
        => new(p.Id, p.BusinessId, row.Name, row.OwnerName, row.ReferenceCode, p.Plan.ToCode(), p.Amount, p.Status.ToCode(), p.RejectReason, p.SubmittedAt, p.ReviewedAt, p.ProofContentType);

    private static AuditEntryDto ToAudit(AdminAuditLog a) => new(a.Id, a.Action, a.Details, a.At);

    private static LeadDto ToLead(SignupLead l)
        => new(l.Id, l.FullName, l.Email, l.PhoneE164, l.StoreName, l.Status.ToCode(), l.UtmSource, l.SendCount, l.LastSentAt, l.CreatedAt, l.RegisteredAt);

    private static string Details(object value) => JsonSerializer.Serialize(value, Json);

    private static DateOnly StartOfWeek(DateOnly day) => day.AddDays(-(((int)day.DayOfWeek + 1) % 7)); // weeks start on Saturday (Jordan)

    private static NotFoundException NotFound() => new("admin.business_not_found", "المشترك مش موجود.");

    private static NotFoundException PaymentNotFound() => new("payment_request.not_found", "الدفعة مش موجودة.");

    private static ConflictException NoPlan() => new("subscription.no_plan", "ما في خطة شغالة أو قادمة لهالمشترك.");
}
