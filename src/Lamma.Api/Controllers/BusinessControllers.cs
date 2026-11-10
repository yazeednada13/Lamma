using Lamma.Api.Security;
using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>3-step onboarding (authenticated users without a business).</summary>
[ApiController]
[Route("api/v1/onboarding")]
public sealed class OnboardingController(IOnboardingService onboarding) : ControllerBase
{
    [HttpGet("business-types")]
    public ActionResult<IReadOnlyList<BusinessTypeOption>> BusinessTypes() => Ok(onboarding.GetBusinessTypes());

    [HttpPost]
    public async Task<ActionResult<AccountDto>> Complete(OnboardingRequest request, CancellationToken cancellationToken)
        => Created("/api/v1/account", await onboarding.CompleteAsync(request, cancellationToken));
}

/// <summary>Business settings of the current business (resolved on the server; no business id in requests).</summary>
[ApiController]
[Route("api/v1/settings")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class SettingsController(IBusinessSettingsService settings) : ControllerBase
{
    [HttpGet("business")]
    public async Task<ActionResult<BusinessSettingsDto>> GetBusiness(CancellationToken cancellationToken)
        => Ok(await settings.GetProfileAsync(cancellationToken));

    [HttpPut("business")]
    public async Task<ActionResult<BusinessSettingsDto>> UpdateBusiness(UpdateBusinessSettingsRequest request, CancellationToken cancellationToken)
        => Ok(await settings.UpdateProfileAsync(request, cancellationToken));

    [HttpGet("sales-channels")]
    public async Task<ActionResult<SalesChannelSettings>> GetSalesChannels(CancellationToken cancellationToken)
        => Ok(await settings.GetSalesChannelsAsync(cancellationToken));

    [HttpPut("sales-channels")]
    public async Task<ActionResult<SalesChannelSettings>> UpdateSalesChannels(SalesChannelSettings request, CancellationToken cancellationToken)
        => Ok(await settings.UpdateSalesChannelsAsync(request, cancellationToken));

    [HttpGet("payment-methods")]
    public async Task<ActionResult<PaymentMethodSettings>> GetPaymentMethods(CancellationToken cancellationToken)
        => Ok(await settings.GetPaymentMethodsAsync(cancellationToken));

    [HttpPut("payment-methods")]
    public async Task<ActionResult<PaymentMethodSettings>> UpdatePaymentMethods(PaymentMethodSettings request, CancellationToken cancellationToken)
        => Ok(await settings.UpdatePaymentMethodsAsync(request, cancellationToken));
}
