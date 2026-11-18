using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>Pure inventory rules (D-108, D-109, D-110, D-111).</summary>
public static class StockRules
{
    /// <summary>Expiry warning window in days (D-111, fixed in V1).</summary>
    public const int ExpiryWarningDays = 60;

    /// <summary>Weighted-average unit cost after receiving <paramref name="quantity"/> at <paramref name="unitCost"/> (D-109).</summary>
    public static decimal WeightedCost(int onHand, decimal currentCost, int quantity, decimal unitCost)
        => onHand <= 0 ? unitCost : MoneyMath.Round(((onHand * currentCost) + (quantity * unitCost)) / (onHand + quantity));

    /// <summary>With no stock the new date applies; otherwise the earlier date is kept so the warning follows the oldest stock (D-108).</summary>
    public static DateOnly ExpiryAfterReceive(int onHandBefore, DateOnly? current, DateOnly received)
        => onHandBefore <= 0 || current is null ? received : (current.Value < received ? current.Value : received);

    public static bool IsReasonAllowed(AdjustmentReason reason, bool increase)
        => !increase || reason is AdjustmentReason.Count or AdjustmentReason.Correction;

    public static string ReasonLabel(AdjustmentReason reason) => reason switch
    {
        AdjustmentReason.Damage => "تلف",
        AdjustmentReason.Loss => "فقدان",
        AdjustmentReason.Count => "جرد",
        AdjustmentReason.Correction => "تصحيح",
        _ => "هدية للزبون",
    };

    /// <summary>expired (&lt; 0 days), soon (≤ 60), ok (D-111).</summary>
    public static string ExpiryStatus(int daysLeft) => daysLeft < 0 ? "expired" : daysLeft <= ExpiryWarningDays ? "soon" : "ok";
}
