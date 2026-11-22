using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Application.Identity;
using Lamma.Infrastructure.Identity;
using Lamma.Infrastructure.Persistence;
using Lamma.Infrastructure.Persistence.Interceptors;
using Lamma.Infrastructure.Persistence.Repositories;
using Lamma.Infrastructure.Services;
using Lamma.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Lamma.Infrastructure;

/// <summary>Registers persistence, Identity, tenancy and external integrations (MASTER-ARCHITECTURE §4.2).</summary>
public static class DependencyInjection
{
    public const string ConnectionStringName = "Lamma";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, bool isDevelopment)
    {
        services.AddOptions<AppOptions>()
            .Bind(configuration.GetSection(AppOptions.SectionName))
            .Validate(o => Uri.TryCreate(o.FrontendBaseUrl, UriKind.Absolute, out _), "App:FrontendBaseUrl must be an absolute URL.")
            .ValidateOnStart();

        services.AddSingleton<IClock, SystemClock>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();

        services.AddPersistence(configuration);
        services.AddTenancy();
        services.AddLammaIdentity();

        services.AddSingleton<IAppLinks, AppLinks>();
        services.AddOptions<StorageOptions>().Bind(configuration.GetSection(StorageOptions.SectionName));
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        if (isDevelopment)
        {
            services.AddSingleton<IEmailSender, LoggingEmailSender>();
        }
        else
        {
            services.AddSingleton<IEmailSender, NotConfiguredEmailSender>();
        }

        return services;
    }

    private static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<TimestampsInterceptor>();
        services.AddScoped<TenancyInterceptor>();

        services.AddDbContext<LammaDbContext>((sp, options) =>
        {
            var connectionString = configuration.GetConnectionString(ConnectionStringName);
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"Connection string '{ConnectionStringName}' is missing. Set it with dotnet user-secrets (see docs/project/LOCAL-DEVELOPMENT.md).");
            }

            options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(maxRetryCount: 3));
            options.AddInterceptors(sp.GetRequiredService<TimestampsInterceptor>(), sp.GetRequiredService<TenancyInterceptor>());
        });

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<LammaDbContext>());

        // Businesses module
        services.AddScoped<IBusinessRepository, BusinessRepository>();
        services.AddScoped<IMembershipRepository, MembershipRepository>();
        services.AddScoped<IBusinessSettingsQueries, BusinessSettingsQueries>();

        // Catalog module
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ICategoryQueries, CategoryQueries>();
        services.AddScoped<ITemplateFieldRepository, TemplateFieldRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IProductQueries, ProductQueries>();

        // Inventory module
        services.AddScoped<Lamma.Application.Inventory.IInventoryRepository, InventoryRepository>();
        services.AddScoped<Lamma.Application.Inventory.IInventoryQueries, InventoryQueries>();
        services.AddScoped<IIdempotencyService, Persistence.Idempotency.IdempotencyService>();

        // Customers module
        services.AddScoped<Lamma.Application.Customers.ICustomerRepository, CustomerRepository>();
        services.AddScoped<Lamma.Application.Customers.ICustomerQueries, CustomerQueries>();

        // Orders (Phase 5)
        services.AddScoped<Lamma.Application.Orders.IOrderRepository, OrderRepository>();
        services.AddScoped<Lamma.Application.Orders.IOrderQueries, OrderQueries>();

        // Payments (Phase 6)
        services.AddScoped<Lamma.Application.Payments.IPaymentRepository, PaymentRepository>();
        services.AddScoped<Lamma.Application.Payments.IPaymentQueries, PaymentQueries>();

        // Courier & expenses (Phase 7)
        services.AddScoped<Lamma.Application.Expenses.IExpenseCategoryRepository, ExpenseCategoryRepository>();
        services.AddScoped<Lamma.Application.Expenses.IExpenseRepository, ExpenseRepository>();
        services.AddScoped<Lamma.Application.Expenses.IExpenseQueries, ExpenseQueries>();
        services.AddScoped<Lamma.Application.Courier.ICourierRepository, CourierRepository>();
        services.AddScoped<Lamma.Application.Courier.ICourierQueries, CourierQueries>();
        services.AddScoped<Lamma.Application.Finance.IFinanceQueries, FinanceQueries>();

        // Dashboard (Phase 9)
        services.AddScoped<Lamma.Application.Dashboard.IDashboardQueries, DashboardQueries>();

        // Reports (Phase 10)
        services.AddScoped<Lamma.Application.Reports.IReportQueries, ReportQueries>();

        // Accounts module
        services.AddScoped<IAccountQueries, AccountQueries>();
        return services;
    }

    private static IServiceCollection AddTenancy(this IServiceCollection services)
    {
        services.AddScoped<TenantContext>();
        services.AddScoped<ICurrentBusiness>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<ICurrentBusinessResolver, CurrentBusinessResolver>();
        return services;
    }

    private static IServiceCollection AddLammaIdentity(this IServiceCollection services)
    {
        services
            .AddIdentityCore<ApplicationUser>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.SignIn.RequireConfirmedEmail = false; // D-084

                o.Password.RequiredLength = 8;
                o.Password.RequireDigit = true;
                o.Password.RequireLowercase = false;
                o.Password.RequireUppercase = false;
                o.Password.RequireNonAlphanumeric = false;
                o.Password.RequiredUniqueChars = 1;

                o.Lockout.AllowedForNewUsers = true;
                o.Lockout.MaxFailedAccessAttempts = 5;
                o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<LammaDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddPasswordValidator<RequireLetterPasswordValidator>();

        services.TryAddScoped<ISecurityStampValidator, SecurityStampValidator<ApplicationUser>>();

        // Validate the security stamp on every request so a password change/reset ends other sessions immediately.
        services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
        services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));

        services.AddScoped<IIdentityService, IdentityService>();
        return services;
    }
}
