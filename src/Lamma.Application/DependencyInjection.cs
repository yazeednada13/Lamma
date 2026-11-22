using FluentValidation;
using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Lamma.Application.Catalog;
using Lamma.Application.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Lamma.Application;

/// <summary>Registers application services and validators (MASTER-ARCHITECTURE §4.2).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddIdentityModule();
        services.AddAccountsModule();
        services.AddBusinessesModule();
        services.AddCatalogModule();

        // Validators are stateless: transient.
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, ServiceLifetime.Transient);
        return services;
    }

    private static IServiceCollection AddIdentityModule(this IServiceCollection services)
        => services.AddScoped<IAuthService, AuthService>();

    private static IServiceCollection AddAccountsModule(this IServiceCollection services)
        => services.AddScoped<IAccountService, AccountService>();

    private static IServiceCollection AddBusinessesModule(this IServiceCollection services)
        => services
            .AddScoped<IOnboardingService, OnboardingService>()
            .AddScoped<IBusinessSettingsService, BusinessSettingsService>();

    private static IServiceCollection AddCatalogModule(this IServiceCollection services)
        => services
            .AddScoped<ICategoryService, CategoryService>()
            .AddScoped<IProductTemplateService, ProductTemplateService>()
            .AddScoped<IProductService, ProductService>()
            .AddScoped<IProductImageService, ProductImageService>()
            .AddScoped<Inventory.IInventoryService, Inventory.InventoryService>()
            .AddScoped<Customers.ICustomerService, Customers.CustomerService>()
            .AddScoped<Orders.IOrderService, Orders.OrderService>()
            .AddScoped<Payments.IPaymentService, Payments.PaymentService>()
            .AddScoped<Expenses.IExpenseService, Expenses.ExpenseService>()
            .AddScoped<Courier.ICourierService, Courier.CourierService>()
            .AddScoped<Finance.IFinanceService, Finance.FinanceService>()
            .AddScoped<Dashboard.IDashboardService, Dashboard.DashboardService>()
            .AddScoped<Reports.IReportService, Reports.ReportService>();
}
