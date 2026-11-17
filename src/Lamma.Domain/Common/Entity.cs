namespace Lamma.Domain.Common;

/// <summary>Base type for aggregate roots and entities with a Guid identity.</summary>
public abstract class Entity
{
    protected Entity(Guid id)
    {
        Guard.NotEmpty(id, nameof(id));
        Id = id;
    }

    /// <summary>For EF Core materialization only.</summary>
    protected Entity()
    {
    }

    public Guid Id { get; private set; }

    /// <summary>Time-ordered Guid (v7), so clustered indexes do not fragment.</summary>
    public static Guid NewId() => Guid.CreateVersion7();
}
