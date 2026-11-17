using Lamma.Domain.Common;

namespace Lamma.Domain.Businesses;

/// <summary>Whether a sales channel is enabled for a business. Part of the Business aggregate.</summary>
public sealed class BusinessSalesChannel : IBusinessOwned
{
    internal BusinessSalesChannel(Guid businessId, SalesChannel channel, bool isEnabled)
    {
        BusinessId = businessId;
        Channel = channel;
        IsEnabled = isEnabled;
    }

    private BusinessSalesChannel()
    {
    }

    public Guid BusinessId { get; private set; }

    public SalesChannel Channel { get; private set; }

    public bool IsEnabled { get; internal set; }
}

/// <summary>Whether a payment method is enabled for a business. Part of the Business aggregate.</summary>
public sealed class BusinessPaymentMethod : IBusinessOwned
{
    internal BusinessPaymentMethod(Guid businessId, PaymentMethod method, bool isEnabled)
    {
        BusinessId = businessId;
        Method = method;
        IsEnabled = isEnabled;
    }

    private BusinessPaymentMethod()
    {
    }

    public Guid BusinessId { get; private set; }

    public PaymentMethod Method { get; private set; }

    public bool IsEnabled { get; internal set; }
}
