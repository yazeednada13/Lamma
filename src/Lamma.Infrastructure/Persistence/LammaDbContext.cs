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

    public DbSet<Lamma.Domain.Customers.Customer> Customers => Set<Lamma.Domain.Customers.Customer>();

    public DbSet<Lamma.Domain.Orders.Order> Orders => Set<Lamma.Domain.Orders.Order>();

    public DbSet<Lamma.Domain.Orders.OrderItem> OrderItems => Set<Lamma.Domain.Orders.OrderItem>();

    public DbSet<Lamma.Domain.Orders.OrderStatusLog> OrderStatusLogs => Set<Lamma.Domain.Orders.OrderStatusLog>();

    public DbSet<Lamma.Domain.Orders.OrderReturn> OrderReturns => Set<Lamma.Domain.Orders.OrderReturn>();

    public DbSet<Lamma.Domain.Orders.OrderReturnLine> OrderReturnLines => Set<Lamma.Domain.Orders.OrderReturnLine>();

    public DbSet<Lamma.Domain.Payments.Payment> Payments => Set<Lamma.Domain.Payments.Payment>();

    public DbSet<Lamma.Domain.Payments.PaymentAllocation> PaymentAllocations => Set<Lamma.Domain.Payments.PaymentAllocation>();

    public DbSet<Lamma.Domain.Expenses.ExpenseCategory> ExpenseCategories => Set<Lamma.Domain.Expenses.ExpenseCategory>();

    public DbSet<Lamma.Domain.Expenses.Expense> Expenses => Set<Lamma.Domain.Expenses.Expense>();

    public DbSet<Lamma.Domain.Courier.CourierSettlement> CourierSettlements => Set<Lamma.Domain.Courier.CourierSettlement>();

    public DbSet<Lamma.Domain.Courier.CourierSettlementOrder> CourierSettlementOrders => Set<Lamma.Domain.Courier.CourierSettlementOrder>();

    public DbSet<Lamma.Domain.Signup.SignupLead> SignupLeads => Set<Lamma.Domain.Signup.SignupLead>();

    public DbSet<Lamma.Domain.Subscriptions.SubscriptionPeriod> SubscriptionPeriods => Set<Lamma.Domain.Subscriptions.SubscriptionPeriod>();

    public DbSet<Lamma.Domain.Subscriptions.PaymentRequest> PaymentRequests => Set<Lamma.Domain.Subscriptions.PaymentRequest>();

    public DbSet<Lamma.Domain.Platform.AdminAuditLog> AdminAuditLogs => Set<Lamma.Domain.Platform.AdminAuditLog>();

    public DbSet<Lamma.Domain.Platform.ReminderLog> ReminderLogs => Set<Lamma.Domain.Platform.ReminderLog>();

    public DbSet<Repositories.BusinessCounter> BusinessCounters => Set<Repositories.BusinessCounter>();

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
