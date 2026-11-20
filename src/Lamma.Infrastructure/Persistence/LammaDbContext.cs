using System.Reflection;
using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Domain.Common;
using Lamma.Infrastructure.Identity;
using Lamma.Infrastructure.Persistence.Conventions;
using Lamma.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Persistence;

/// <summary>
/// The single EF Core context (Identity + business data). It is also the unit of work (P-013).
/// Every <see cref="IBusinessOwned"/> entity gets a global query filter bound to the request's business (P-003).
/// </summary>
public sealed class LammaDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IUnitOfWork
{
    private readonly TenantContext _tenant;

    public LammaDbContext(DbContextOptions<LammaDbContext> options, TenantContext tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public DbSet<Business> Businesses => Set<Business>();

    public DbSet<BusinessMembership> Memberships => Set<BusinessMembership>();

    public DbSet<BusinessSalesChannel> BusinessSalesChannels => Set<BusinessSalesChannel>();

    public DbSet<BusinessPaymentMethod> BusinessPaymentMethods => Set<BusinessPaymentMethod>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();

    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    public DbSet<ProductTemplateCustomField> ProductTemplateCustomFields => Set<ProductTemplateCustomField>();

    public DbSet<StockReceipt> StockReceipts => Set<StockReceipt>();

    public DbSet<Idempotency.IdempotencyRecord> IdempotencyRecords => Set<Idempotency.IdempotencyRecord>();

    /// <summary>Referenced by the query filters; EF Core re-evaluates it per query (parameterized).</summary>
    internal Guid? CurrentBusinessId => _tenant.ResolvedBusinessId;

    async Task<int> IUnitOfWork.SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // A rowversion-protected row (e.g. ProductVariant, DATABASE-DESIGN §9) changed since it was loaded.
            throw new ConflictException("concurrency.conflict", "البيانات تغيّرت من مكان ثاني. حدّث الصفحة وجرّب كمان مرة.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 } sql)
        {
            throw new UniqueConstraintViolationException(sql.Message, ex);
        }
    }

    public Task ExecuteInTransactionAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken)
    {
        var strategy = Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async ct =>
        {
            await using var transaction = await Database.BeginTransactionAsync(ct);
            await work(ct);
            await transaction.CommitAsync(ct);
        }, cancellationToken);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        LammaModelConventions.Apply(configurationBuilder, typeof(Business).Assembly);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(LammaDbContext).Assembly);

        var applyFilter = typeof(LammaDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;
        foreach (var entityType in builder.Model.GetEntityTypes().Where(t => typeof(IBusinessOwned).IsAssignableFrom(t.ClrType)).ToList())
        {
            applyFilter.MakeGenericMethod(entityType.ClrType).Invoke(this, [builder]);
        }
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder builder)
        where TEntity : class, IBusinessOwned
        => builder.Entity<TEntity>().HasQueryFilter(e => (Guid?)EF.Property<Guid>(e, nameof(IBusinessOwned.BusinessId)) == CurrentBusinessId);
}
