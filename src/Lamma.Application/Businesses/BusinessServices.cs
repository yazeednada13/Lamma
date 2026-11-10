using Lamma.Application.Accounts;
using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Application.Businesses;

// ---------- Ports (implemented in Infrastructure) ----------

/// <summary>Write-side repository for the Business aggregate (focused, no generic repository).</summary>
public interface IBusinessRepository
{
    /// <summary>Loads the business with its channel and payment-method rows, tracked for update.</summary>
    Task<Business?> GetForUpdateAsync(Guid businessId, CancellationToken cancellationToken);

    void Add(Business business);
}

public interface IMembershipRepository
{
    Task<bool> ExistsForUserAsync(Guid userId, CancellationToken cancellationToken);

    void Add(BusinessMembership membership);
}

/// <summary>Read-side queries for the settings screens (projections, no tracking).</summary>
public interface IBusinessSettingsQueries
{
    Task<BusinessSettingsDto?> GetProfileAsync(Guid businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SettingFlagRow<SalesChannel>>> GetSalesChannelsAsync(Guid businessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SettingFlagRow<PaymentMethod>>> GetPaymentMethodsAsync(Guid businessId, CancellationToken cancellationToken);
}

// ---------- Onboarding ----------

public interface IOnboardingService
{
    IReadOnlyList<BusinessTypeOption> GetBusinessTypes();

    Task<AccountDto> CompleteAsync(OnboardingRequest request, CancellationToken cancellationToken);
}

/// <summary>Creates the business, the owner membership, default settings and the trial in one commit.</summary>
internal sealed class OnboardingService(
    ICurrentUser currentUser,
    IBusinessRepository businesses,
    IMembershipRepository memberships,
    IUnitOfWork unitOfWork,
    IAccountService accounts,
    IClock clock) : IOnboardingService
{
    public IReadOnlyList<BusinessTypeOption> GetBusinessTypes() => BusinessTypeCatalog.All;

    public async Task<AccountDto> CompleteAsync(OnboardingRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequiredUserId;
        if (await memberships.ExistsForUserAsync(userId, cancellationToken))
        {
            throw AlreadyCompleted();
        }

        var now = clock.UtcNow;
        var business = Business.Create(
            request.BusinessName,
            EnumCode.Parse<BusinessType>(request.BusinessType),
            request.SalesChannels.Select(EnumCode.Parse<SalesChannel>),
            now);

        businesses.Add(business);
        memberships.Add(BusinessMembership.CreateOwner(userId, business.Id, now));

        try
        {
            // Single SaveChanges = single transaction: business + settings rows + membership, or nothing.
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            // A concurrent request onboarded this user first (unique Membership.UserId).
            throw AlreadyCompleted();
        }

        return await accounts.GetByUserIdAsync(userId, cancellationToken);
    }

    private static ConflictException AlreadyCompleted()
        => new("onboarding.already_completed", "مشروعك جاهز من قبل، ما في داعي تعيد التهيئة.");
}

// ---------- Business settings ----------

public interface IBusinessSettingsService
{
    Task<BusinessSettingsDto> GetProfileAsync(CancellationToken cancellationToken);

    Task<BusinessSettingsDto> UpdateProfileAsync(UpdateBusinessSettingsRequest request, CancellationToken cancellationToken);

    Task<SalesChannelSettings> GetSalesChannelsAsync(CancellationToken cancellationToken);

    Task<SalesChannelSettings> UpdateSalesChannelsAsync(SalesChannelSettings request, CancellationToken cancellationToken);

    Task<PaymentMethodSettings> GetPaymentMethodsAsync(CancellationToken cancellationToken);

    Task<PaymentMethodSettings> UpdatePaymentMethodsAsync(PaymentMethodSettings request, CancellationToken cancellationToken);
}

/// <summary>Business profile, enabled channels, enabled payment methods and inventory defaults for the current business.</summary>
internal sealed class BusinessSettingsService(
    ICurrentBusiness currentBusiness,
    IBusinessRepository businesses,
    IBusinessSettingsQueries queries,
    IUnitOfWork unitOfWork) : IBusinessSettingsService
{
    public async Task<BusinessSettingsDto> GetProfileAsync(CancellationToken cancellationToken)
        => await queries.GetProfileAsync(currentBusiness.BusinessId, cancellationToken) ?? throw BusinessNotFound();

    public async Task<BusinessSettingsDto> UpdateProfileAsync(UpdateBusinessSettingsRequest request, CancellationToken cancellationToken)
    {
        var business = await LoadAsync(cancellationToken);
        business.UpdateProfile(request.Name, EnumCode.Parse<BusinessType>(request.BusinessType), request.DefaultLowStockThreshold);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<SalesChannelSettings> GetSalesChannelsAsync(CancellationToken cancellationToken)
    {
        var rows = await queries.GetSalesChannelsAsync(currentBusiness.BusinessId, cancellationToken);
        return new SalesChannelSettings(rows.OrderBy(r => r.Value).Select(r => new SalesChannelSetting(r.Value.ToCode(), r.IsEnabled)).ToList());
    }

    public async Task<SalesChannelSettings> UpdateSalesChannelsAsync(SalesChannelSettings request, CancellationToken cancellationToken)
    {
        var business = await LoadAsync(cancellationToken);
        business.SetSalesChannels(request.Channels.ToDictionary(c => EnumCode.Parse<SalesChannel>(c.Channel), c => c.IsEnabled));
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetSalesChannelsAsync(cancellationToken);
    }

    public async Task<PaymentMethodSettings> GetPaymentMethodsAsync(CancellationToken cancellationToken)
    {
        var rows = await queries.GetPaymentMethodsAsync(currentBusiness.BusinessId, cancellationToken);
        return new PaymentMethodSettings(rows.OrderBy(r => r.Value).Select(r => new PaymentMethodSetting(r.Value.ToCode(), r.IsEnabled)).ToList());
    }

    public async Task<PaymentMethodSettings> UpdatePaymentMethodsAsync(PaymentMethodSettings request, CancellationToken cancellationToken)
    {
        var business = await LoadAsync(cancellationToken);
        business.SetPaymentMethods(request.Methods.ToDictionary(m => EnumCode.Parse<PaymentMethod>(m.Method), m => m.IsEnabled));
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetPaymentMethodsAsync(cancellationToken);
    }

    private async Task<Business> LoadAsync(CancellationToken cancellationToken)
        => await businesses.GetForUpdateAsync(currentBusiness.BusinessId, cancellationToken) ?? throw BusinessNotFound();

    private static NotFoundException BusinessNotFound() => new("business.not_found", "ما لقينا المشروع.");
}
