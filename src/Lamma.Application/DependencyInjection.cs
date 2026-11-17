using FluentValidation;
using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
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
}
