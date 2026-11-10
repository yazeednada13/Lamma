using Lamma.Application.Common;
using Lamma.Infrastructure.Persistence;
using Lamma.Infrastructure.Persistence.Interceptors;
using Lamma.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Tests;

internal sealed class TestClock : IClock
{
    public DateTime UtcNow { get; set; } = new(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);
}

/// <summary>
/// Throwaway database per test class on LocalDB (approved exception D-083): created with EnsureCreated,
/// dropped afterwards. Never touches Lamma_Dev. Override the server with LAMMA_TEST_SQL_SERVER.
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private readonly string _connectionString;

    public TestDatabase()
    {
        var server = Environment.GetEnvironmentVariable("LAMMA_TEST_SQL_SERVER") ?? @"(localdb)\MSSQLLocalDB";
        _connectionString = $"Server={server};Database=Lamma_Test_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False";
    }

    internal TestClock Clock { get; } = new();

    /// <summary>Creates a context whose tenant is <paramref name="businessId"/> (null = no business).</summary>
    internal LammaDbContext CreateContext(Guid? businessId = null)
    {
        var tenant = new TenantContext();
        tenant.Set(businessId);
        var options = new DbContextOptionsBuilder<LammaDbContext>()
            .UseSqlServer(_connectionString)
            .AddInterceptors(new TimestampsInterceptor(Clock), new TenancyInterceptor(tenant))
            .Options;
        return new LammaDbContext(options, tenant);
    }

    public async Task InitializeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
    }
}
