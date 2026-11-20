using System.Text;
using System.Text.RegularExpressions;
using Lamma.Domain.Common;

namespace Lamma.Domain.Customers;

/// <summary>
/// Mobile numbers stored as E.164 (D-116). Jordanian input (07…, 7…, 9627…, 009627…, +9627…) becomes +9627XXXXXXXX;
/// other international numbers are accepted when written with + or 00.
/// </summary>
public static partial class PhoneNumber
{
    public const int MaxLength = 16;

    /// <summary>Returns the E.164 form, null for empty input, or throws <see cref="DomainException"/> for an invalid number.</summary>
    public static string? Normalize(string? input)
    {
        var digits = Digits(input, out var hadPlus);
        if (digits.Length == 0)
        {
            return null;
        }

        if (!hadPlus && digits.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[2..];
            hadPlus = true;
        }

        string? e164 = hadPlus
            ? digits.StartsWith("962", StringComparison.Ordinal)
                ? JordanMobile(digits[3..])
                : (digits.Length is >= 8 and <= 15 && digits[0] != '0' ? "+" + digits : null)
            : digits.StartsWith("962", StringComparison.Ordinal) ? JordanMobile(digits[3..])
            : digits.StartsWith('0') ? JordanMobile(digits[1..])
            : JordanMobile(digits);

        return e164 ?? throw new DomainException("customer.invalid_phone", "رقم الهاتف غير صحيح. مثال: 0791234567");
    }

    /// <summary>Digits (Latin, from Arabic-Indic too) of a search text, without a leading 0 (to match stored +962 numbers).</summary>
    public static string SearchDigits(string text)
    {
        var digits = Digits(text, out _);
        return digits.StartsWith('0') ? digits.TrimStart('0') : digits;
    }

    private static string? JordanMobile(string national) => JordanMobileRegex().IsMatch(national) ? "+962" + national : null;

    private static string Digits(string? input, out bool hadPlus)
    {
        hadPlus = false;
        var sb = new StringBuilder();
        foreach (var c in (input ?? string.Empty).Trim())
        {
            if (c == '+' && sb.Length == 0)
            {
                hadPlus = true;
            }
            else if (char.IsDigit(c))
            {
                sb.Append((char)('0' + (int)char.GetNumericValue(c)));
            }
        }

        return sb.ToString();
    }

    [GeneratedRegex("^7[789][0-9]{7}$")]
    private static partial Regex JordanMobileRegex();
}
