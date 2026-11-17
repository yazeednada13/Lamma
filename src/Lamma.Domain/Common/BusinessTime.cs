namespace Lamma.Domain.Common;

/// <summary>Converts UTC instants to the business's local calendar (default Asia/Amman, P-018).</summary>
public static class BusinessTime
{
    public const string DefaultTimeZoneId = "Asia/Amman";

    public static TimeZoneInfo FindZone(string timeZoneId) => TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);

    public static DateOnly LocalDate(DateTime utc, TimeZoneInfo zone)
    {
        if (utc.Kind == DateTimeKind.Local)
        {
            throw new ArgumentException("Expected a UTC instant.", nameof(utc));
        }

        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);
        return DateOnly.FromDateTime(local);
    }
}
