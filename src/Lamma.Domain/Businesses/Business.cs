using Lamma.Domain.Common;

namespace Lamma.Domain.Businesses;

/// <summary>The tenant root. Every business-owned record references a Business.</summary>
public sealed class Business : Entity, IHasTimestamps
{
    public const int NameMaxLength = 100;
    public const int DefaultLowStockThresholdValue = 5;
    public const int LowStockThresholdMax = 1000;
    public const int TrialLengthDays = 30;
    public const string JordanianDinar = "JOD";

    /// <summary>Enabled by default at onboarding (matches the approved prototype settings).</summary>
    public static readonly IReadOnlySet<PaymentMethod> DefaultEnabledPaymentMethods =
        new HashSet<PaymentMethod> { PaymentMethod.Cash, PaymentMethod.Cliq, PaymentMethod.BankTransfer, PaymentMethod.Cod };

    private readonly List<BusinessSalesChannel> _salesChannels = [];
    private readonly List<BusinessPaymentMethod> _paymentMethods = [];

    private Business(Guid id)
        : base(id)
    {
    }

    private Business()
    {
    }

    public string Name { get; private set; } = string.Empty;

    public BusinessType BusinessType { get; private set; }

    public string Currency { get; private set; } = JordanianDinar;

    public int DefaultLowStockThreshold { get; private set; } = DefaultLowStockThresholdValue;

    public string TimeZoneId { get; private set; } = BusinessTime.DefaultTimeZoneId;

    public DateTime TrialStartsAt { get; private set; }

    public DateTime TrialEndsAt { get; private set; }

    public SubscriptionPlan SubscriptionPlan { get; private set; } = SubscriptionPlan.Trial;

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<BusinessSalesChannel> SalesChannels => _salesChannels;

    public IReadOnlyCollection<BusinessPaymentMethod> PaymentMethods => _paymentMethods;

    /// <summary>Creates a business at onboarding: the trial starts now and lasts 30 days (D-010).</summary>
    public static Business Create(string name, BusinessType type, IEnumerable<SalesChannel> enabledChannels, DateTime nowUtc)
    {
        var business = new Business(NewId())
        {
            Name = NormalizeName(name),
            BusinessType = type,
            TrialStartsAt = nowUtc,
            TrialEndsAt = nowUtc.AddDays(TrialLengthDays),
        };

        var enabled = enabledChannels.ToHashSet();
        foreach (var channel in EnumCode.All<SalesChannel>())
        {
            business._salesChannels.Add(new BusinessSalesChannel(business.Id, channel, enabled.Contains(channel)));
        }

        foreach (var method in EnumCode.All<PaymentMethod>())
        {
            business._paymentMethods.Add(new BusinessPaymentMethod(business.Id, method, DefaultEnabledPaymentMethods.Contains(method)));
        }

        business.EnsureAnyChannelEnabled();
        return business;
    }

    public void UpdateProfile(string name, BusinessType type, int defaultLowStockThreshold)
    {
        if (defaultLowStockThreshold < 0 || defaultLowStockThreshold > LowStockThresholdMax)
        {
            throw new DomainException(
                "settings.invalid_low_stock_threshold",
                $"حد «قرب يخلص» لازم يكون بين 0 و {LowStockThresholdMax}.");
        }

        Name = NormalizeName(name);
        BusinessType = type;
        DefaultLowStockThreshold = defaultLowStockThreshold;
    }

    /// <summary>Applies enabled flags; channels not listed keep their state. At least one must stay enabled.</summary>
    public void SetSalesChannels(IReadOnlyDictionary<SalesChannel, bool> enabled)
    {
        // Validate the resulting state first, so a rejected change leaves the aggregate untouched.
        if (!_salesChannels.Any(row => enabled.TryGetValue(row.Channel, out var on) ? on : row.IsEnabled))
        {
            throw ChannelRequired();
        }

        foreach (var row in _salesChannels)
        {
            if (enabled.TryGetValue(row.Channel, out var on))
            {
                row.IsEnabled = on;
            }
        }
    }

    /// <summary>Applies enabled flags; methods not listed keep their state. At least one must stay enabled.</summary>
    public void SetPaymentMethods(IReadOnlyDictionary<PaymentMethod, bool> enabled)
    {
        if (!_paymentMethods.Any(row => enabled.TryGetValue(row.Method, out var on) ? on : row.IsEnabled))
        {
            throw new DomainException("settings.payment_method_required", "لازم تفعّل طريقة دفع وحدة على الأقل.");
        }

        foreach (var row in _paymentMethods)
        {
            if (enabled.TryGetValue(row.Method, out var on))
            {
                row.IsEnabled = on;
            }
        }
    }

    /// <summary>Whole calendar days left in the trial, in the business time zone; never negative.</summary>
    public int TrialDaysRemaining(DateTime nowUtc) => TrialDaysRemaining(TrialEndsAt, nowUtc, BusinessTime.FindZone(TimeZoneId));

    public static int TrialDaysRemaining(DateTime trialEndsAtUtc, DateTime nowUtc, TimeZoneInfo zone)
    {
        var today = BusinessTime.LocalDate(nowUtc, zone);
        var end = BusinessTime.LocalDate(trialEndsAtUtc, zone);
        return Math.Max(0, end.DayNumber - today.DayNumber);
    }

    private static string NormalizeName(string name)
    {
        var trimmed = Guard.NotBlank(name, nameof(name)).Trim();
        if (trimmed.Length > NameMaxLength)
        {
            throw new DomainException("business.name_too_long", $"اسم المشروع لازم يكون {NameMaxLength} حرف أو أقل.");
        }

        return trimmed;
    }

    private void EnsureAnyChannelEnabled()
    {
        if (!_salesChannels.Any(c => c.IsEnabled))
        {
            throw ChannelRequired();
        }
    }

    private static DomainException ChannelRequired()
        => new("settings.channel_required", "لازم تفعّل قناة بيع وحدة على الأقل.");
}
