using FluentValidation;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Application.Businesses;

// ---------- Onboarding ----------

/// <summary>3-step onboarding in the spec order (D-081): name → one business type → sales channels.</summary>
public sealed record OnboardingRequest(string BusinessName, string BusinessType, IReadOnlyList<string> SalesChannels);

public sealed record BusinessTypeOption(string Code, string LabelAr);

// ---------- Settings ----------

public sealed record BusinessSettingsDto(string Name, string BusinessType, int DefaultLowStockThreshold, string Currency);

public sealed record UpdateBusinessSettingsRequest(string Name, string BusinessType, int DefaultLowStockThreshold);

public sealed record SalesChannelSetting(string Channel, bool IsEnabled);

/// <summary>Request and response: always the full list of the 4 channels.</summary>
public sealed record SalesChannelSettings(IReadOnlyList<SalesChannelSetting> Channels);

public sealed record PaymentMethodSetting(string Method, bool IsEnabled);

/// <summary>Request and response: always the full list of the 6 methods.</summary>
public sealed record PaymentMethodSettings(IReadOnlyList<PaymentMethodSetting> Methods);

/// <summary>Read-model row for a setting flag.</summary>
public sealed record SettingFlagRow<TEnum>(TEnum Value, bool IsEnabled)
    where TEnum : struct, Enum;

/// <summary>Arabic labels for the 13 approved business types (D-009), in display order.</summary>
public static class BusinessTypeCatalog
{
    public static readonly IReadOnlyList<BusinessTypeOption> All =
    [
        new(BusinessType.Clothing.ToCode(), "ملابس وأزياء"),
        new(BusinessType.ShoesBags.ToCode(), "أحذية وشنط"),
        new(BusinessType.Perfume.ToCode(), "عطور"),
        new(BusinessType.Beauty.ToCode(), "تجميل وعناية"),
        new(BusinessType.Accessories.ToCode(), "إكسسوارات ومجوهرات"),
        new(BusinessType.Gifts.ToCode(), "هدايا وبوكسات"),
        new(BusinessType.HomeFood.ToCode(), "أكل وحلويات بيتية"),
        new(BusinessType.Handmade.ToCode(), "شغل يدوي"),
        new(BusinessType.Electronics.ToCode(), "إلكترونيات"),
        new(BusinessType.Kids.ToCode(), "أطفال وألعاب"),
        new(BusinessType.HomeDecor.ToCode(), "ديكور ومنزل"),
        new(BusinessType.Books.ToCode(), "كتب وقرطاسية"),
        new(BusinessType.Other.ToCode(), "أخرى"),
    ];
}

internal static class BusinessRuleMessages
{
    public const string BusinessNameRequired = "اسم المشروع مطلوب.";
    public const string BusinessNameTooLong = "اسم المشروع لازم يكون 100 حرف أو أقل.";
    public const string BusinessTypeInvalid = "اختار نوع المشروع من القائمة.";
}

public sealed class OnboardingRequestValidator : AbstractValidator<OnboardingRequest>
{
    public OnboardingRequestValidator()
    {
        RuleFor(x => x.BusinessName)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(BusinessRuleMessages.BusinessNameRequired)
            .MaximumLength(Business.NameMaxLength).WithMessage(BusinessRuleMessages.BusinessNameTooLong);
        RuleFor(x => x.BusinessType).IsCodeOf<OnboardingRequest, BusinessType>(BusinessRuleMessages.BusinessTypeInvalid);
        RuleFor(x => x.SalesChannels)
            .NotNull().WithMessage("اختار قناة بيع وحدة على الأقل.")
            .Must(list => list is { Count: > 0 }).WithMessage("اختار قناة بيع وحدة على الأقل.")
            .Must(list => list is null || list.Distinct().Count() == list.Count).WithMessage("في قناة مكررة.");
        RuleForEach(x => x.SalesChannels).IsCodeOf<OnboardingRequest, SalesChannel>("قناة البيع غير معروفة.");
    }
}

public sealed class UpdateBusinessSettingsRequestValidator : AbstractValidator<UpdateBusinessSettingsRequest>
{
    public UpdateBusinessSettingsRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(BusinessRuleMessages.BusinessNameRequired)
            .MaximumLength(Business.NameMaxLength).WithMessage(BusinessRuleMessages.BusinessNameTooLong);
        RuleFor(x => x.BusinessType).IsCodeOf<UpdateBusinessSettingsRequest, BusinessType>(BusinessRuleMessages.BusinessTypeInvalid);
        RuleFor(x => x.DefaultLowStockThreshold)
            .InclusiveBetween(0, Business.LowStockThresholdMax)
            .WithMessage($"حد «قرب يخلص» لازم يكون بين 0 و {Business.LowStockThresholdMax}.");
    }
}

public sealed class SalesChannelSettingsValidator : AbstractValidator<SalesChannelSettings>
{
    public SalesChannelSettingsValidator()
    {
        var expected = EnumCode.All<SalesChannel>().Count;
        RuleFor(x => x.Channels)
            .NotNull().WithMessage("قائمة القنوات مطلوبة.")
            .Must(list => list is not null && list.Select(c => c.Channel).Distinct().Count() == list.Count && list.Count == expected)
            .WithMessage($"لازم تبعت كل القنوات ({expected}) مرة وحدة لكل قناة.");
        RuleForEach(x => x.Channels).ChildRules(c =>
            c.RuleFor(s => s.Channel).IsCodeOf<SalesChannelSetting, SalesChannel>("قناة البيع غير معروفة."));
    }
}

public sealed class PaymentMethodSettingsValidator : AbstractValidator<PaymentMethodSettings>
{
    public PaymentMethodSettingsValidator()
    {
        var expected = EnumCode.All<PaymentMethod>().Count;
        RuleFor(x => x.Methods)
            .NotNull().WithMessage("قائمة طرق الدفع مطلوبة.")
            .Must(list => list is not null && list.Select(m => m.Method).Distinct().Count() == list.Count && list.Count == expected)
            .WithMessage($"لازم تبعت كل طرق الدفع ({expected}) مرة وحدة لكل طريقة.");
        RuleForEach(x => x.Methods).ChildRules(m =>
            m.RuleFor(s => s.Method).IsCodeOf<PaymentMethodSetting, PaymentMethod>("طريقة الدفع غير معروفة."));
    }
}
