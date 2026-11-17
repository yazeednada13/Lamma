namespace Lamma.Domain.Common;

/// <summary>
/// Single place for JOD money rules (DATABASE-DESIGN §3, approved P-005).
/// JOD has 3 minor-unit decimals (fils). Every stored computed amount is rounded here.
/// </summary>
public static class MoneyMath
{
    /// <summary>Number of decimals stored and transported for JOD.</summary>
    public const int Scale = 3;

    /// <summary>Rounds to 3 decimals, midpoint away from zero (0.0005 → 0.001).</summary>
    public static decimal Round(decimal amount) => Math.Round(amount, Scale, MidpointRounding.AwayFromZero);

    /// <summary>True when the value has no more than 3 significant decimals.</summary>
    public static bool HasValidScale(decimal amount) => Round(amount) == amount;
}
