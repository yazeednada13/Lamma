using FluentValidation;
using Lamma.Domain.Common;

namespace Lamma.Application.Common.Validation;

/// <summary>Shared FluentValidation rules with Arabic messages.</summary>
public static class ValidationRules
{
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128;
    public const int EmailMaxLength = 256;
    public const int PersonNameMaxLength = 100;

    public static IRuleBuilderOptions<T, string> LammaPassword<T>(this IRuleBuilder<T, string> rule)
        => rule
            .NotEmpty().WithMessage("كلمة السر مطلوبة.")
            .MinimumLength(PasswordMinLength).WithMessage($"كلمة السر لازم تكون {PasswordMinLength} أحرف على الأقل.")
            .MaximumLength(PasswordMaxLength).WithMessage($"كلمة السر طويلة كثير (الحد {PasswordMaxLength}).")
            .Must(p => p is not null && p.Any(char.IsLetter)).WithMessage("كلمة السر لازم يكون فيها حرف واحد على الأقل.")
            .Must(p => p is not null && p.Any(char.IsDigit)).WithMessage("كلمة السر لازم يكون فيها رقم واحد على الأقل.");

    public static IRuleBuilderOptions<T, string> LammaEmail<T>(this IRuleBuilder<T, string> rule)
        => rule
            .NotEmpty().WithMessage("الإيميل مطلوب.")
            .MaximumLength(EmailMaxLength).WithMessage("الإيميل طويل كثير.")
            .EmailAddress().WithMessage("اكتب إيميل صحيح، مثلًا name@example.com.");

    public static IRuleBuilderOptions<T, string> LammaPersonName<T>(this IRuleBuilder<T, string> rule)
        => rule
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("الاسم مطلوب.")
            .MaximumLength(PersonNameMaxLength).WithMessage($"الاسم لازم يكون {PersonNameMaxLength} حرف أو أقل.");

    /// <summary>The value must be a known snake_case code of <typeparamref name="TEnum"/>.</summary>
    public static IRuleBuilderOptions<T, string> IsCodeOf<T, TEnum>(this IRuleBuilder<T, string> rule, string message)
        where TEnum : struct, Enum
        => rule.Must(code => EnumCode.TryParse<TEnum>(code, out _)).WithMessage(message);
}
