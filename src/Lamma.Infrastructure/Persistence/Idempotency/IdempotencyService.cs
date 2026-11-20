using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Lamma.Application.Common;
using Lamma.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Idempotency;

/// <summary>Stored outcome of one idempotent request (D-112). Unique per (BusinessId, Key).</summary>
public sealed class IdempotencyRecord : IBusinessOwned
{
    private IdempotencyRecord()
    {
    }

    public Guid Id { get; private set; }

    public Guid BusinessId { get; private set; }

    public Guid Key { get; private set; }

    /// <summary>SHA-256 (hex) of the canonical request JSON.</summary>
    public string RequestHash { get; private set; } = string.Empty;

    public string ResponseJson { get; private set; } = string.Empty;

    public DateTime CreatedAt { get; private set; }

    // BusinessId is stamped by the tenancy interceptor from the current request.
    internal static IdempotencyRecord Create(Guid key, string requestHash, string responseJson, DateTime nowUtc)
        => new() { Id = Entity.NewId(), Key = key, RequestHash = requestHash, ResponseJson = responseJson, CreatedAt = nowUtc };
}

internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public const string UniqueKeyIndex = "UX_IdempotencyRecords_BusinessId_Key";

    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("IdempotencyRecords");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.RequestHash).HasMaxLength(64).IsFixedLength().IsUnicode(false).IsRequired();
        builder.Property(r => r.ResponseJson).IsRequired();
        builder.HasIndex(r => new { r.BusinessId, r.Key }).IsUnique().HasDatabaseName(UniqueKeyIndex);
        builder.HasOne<Lamma.Domain.Businesses.Business>().WithMany().HasForeignKey(r => r.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>
/// Runs the work and stores its response in one transaction. A replay with the same request returns the stored
/// response; a different request under the same key is rejected. A concurrent duplicate loses on the unique index,
/// its transaction (including its effects) rolls back, and it returns the winner's response.
/// </summary>
internal sealed class IdempotencyService(LammaDbContext db, IClock clock) : IIdempotencyService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<T> ExecuteAsync<T>(Guid key, object request, Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        var hash = Hash(request);
        var stored = await FindAsync(key, cancellationToken);
        if (stored is not null)
        {
            return Replay<T>(stored, hash);
        }

        var unitOfWork = (IUnitOfWork)db;
        T result = default!;
        try
        {
            await unitOfWork.ExecuteInTransactionAsync(
                async ct =>
                {
                    result = await work(ct);
                    db.IdempotencyRecords.Add(IdempotencyRecord.Create(key, hash, JsonSerializer.Serialize(result, Json), clock.UtcNow));
                    await unitOfWork.SaveChangesAsync(ct);
                },
                cancellationToken);
        }
        catch (Exception ex) when (ex is UniqueConstraintViolationException or ConflictException { Code: "concurrency.conflict" })
        {
            // A concurrent duplicate either lost on the unique key or on a row it also changed (rowversion).
            // Its transaction rolled back; when the winner's record exists, return the winner's response.
            db.ChangeTracker.Clear();
            var winner = await FindAsync(key, cancellationToken);
            if (winner is null)
            {
                throw; // a real conflict of the work itself, not a duplicate
            }

            return Replay<T>(winner, hash);
        }

        return result;
    }

    private Task<IdempotencyRecord?> FindAsync(Guid key, CancellationToken cancellationToken)
        => db.IdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(r => r.Key == key, cancellationToken);

    private static T Replay<T>(IdempotencyRecord record, string hash)
    {
        if (!string.Equals(record.RequestHash, hash, StringComparison.Ordinal))
        {
            throw new DomainException("idempotency.key_reused", "هاد الطلب انبعت قبل بمعلومات مختلفة. حدّث الصفحة وجرّب كمان مرة.");
        }

        return JsonSerializer.Deserialize<T>(record.ResponseJson, Json)!;
    }

    private static string Hash(object request)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request, request.GetType(), Json))));
}
