using Lamma.Domain.Common;

namespace Lamma.Domain.Catalog;

/// <summary>A product category of one business. Never hard-deleted while products use it (D-095).</summary>
public sealed class Category : Entity, IBusinessOwned, IHasTimestamps
{
    public const int NameMaxLength = 60;

    private Category(Guid id, Guid businessId, string name)
        : base(id)
    {
        Guard.NotEmpty(businessId, nameof(businessId));
        BusinessId = businessId;
        Name = name;
    }

    private Category()
    {
    }

    public Guid BusinessId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public bool IsArchived { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public static Category Create(Guid businessId, string name) => new(NewId(), businessId, NormalizeName(name));

    public void Rename(string name) => Name = NormalizeName(name);

    /// <summary>Used when only archived products still reference the category (D-095).</summary>
    public void Archive() => IsArchived = true;

    public static string NormalizeName(string name)
    {
        var trimmed = Guard.NotBlank(name, nameof(name)).Trim();
        if (trimmed.Length > NameMaxLength)
        {
            throw new DomainException("category.name_too_long", $"اسم التصنيف لازم يكون {NameMaxLength} حرف أو أقل.");
        }

        return trimmed;
    }
}
