using Lamma.Domain.Businesses;
using Lamma.Domain.Common;

namespace Lamma.Domain.Customers;

/// <summary>The 12 Jordanian governorates (D-117). Codes: amman, irbid, zarqa, balqa, mafraq, jerash, ajloun, madaba, karak, tafilah, maan, aqaba.</summary>
public enum JordanGovernorate
{
    Amman,
    Irbid,
    Zarqa,
    Balqa,
    Mafraq,
    Jerash,
    Ajloun,
    Madaba,
    Karak,
    Tafilah,
    Maan,
    Aqaba,
}

/// <summary>A customer of one business (D-118). Figures (orders, spent, balance) are derived from orders and payments, never stored.</summary>
public sealed class Customer : Entity, IBusinessOwned, IHasTimestamps
{
    public const int NameMaxLength = 100;
    public const int AreaMaxLength = 100;
    public const int NotesMaxLength = 500;

    private Customer(Guid id, Guid businessId)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
    }

    private Customer()
    {
    }

    public Guid BusinessId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>E.164 (e.g. +962791234567), or null (D-116).</summary>
    public string? PhoneE164 { get; private set; }

    public SalesChannel Channel { get; private set; }

    public JordanGovernorate? City { get; private set; }

    public string? Area { get; private set; }

    public string? Notes { get; private set; }

    public bool IsArchived { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public static Customer Create(Guid businessId, string name, string? phone, SalesChannel channel, JordanGovernorate? city, string? area, string? notes)
    {
        var customer = new Customer(NewId(), businessId);
        customer.Update(name, phone, channel, city, area, notes);
        return customer;
    }

    public void Update(string name, string? phone, SalesChannel channel, JordanGovernorate? city, string? area, string? notes)
    {
        var trimmed = Guard.NotBlank(name, nameof(name)).Trim();
        if (trimmed.Length > NameMaxLength)
        {
            throw new DomainException("customer.name_too_long", $"الاسم لازم يكون {NameMaxLength} حرف أو أقل.");
        }

        Name = trimmed;
        PhoneE164 = PhoneNumber.Normalize(phone);
        Channel = channel;
        City = city;
        Area = Optional(area, AreaMaxLength, "المنطقة");
        Notes = Optional(notes, NotesMaxLength, "الملاحظات");
    }

    public void Archive() => IsArchived = true;

    public void Restore() => IsArchived = false;

    private static string? Optional(string? value, int max, string label)
    {
        var trimmed = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (trimmed is { Length: var length } && length > max)
        {
            throw new DomainException("customer.text_too_long", $"{label} لازم تكون {max} حرف أو أقل.");
        }

        return trimmed;
    }
}
