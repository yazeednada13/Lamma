using Lamma.Application.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Lamma.Api.IntegrationTests.Infrastructure;

public sealed class MutableClock : IClock
{
    public DateTime UtcNow { get; set; } = DateTime.UtcNow;
}

/// <summary>Captures emails instead of sending them (tests read reset links from here).</summary>
public sealed class CapturingEmailSender : IEmailSender
{
    private readonly List<(string Email, string Link)> _sent = [];

    public bool IsConfigured => true;

    public IReadOnlyList<(string Email, string Link)> Sent
    {
        get
        {
            lock (_sent)
            {
                return _sent.ToList();
            }
        }
    }

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
    {
        lock (_sent)
        {
            _sent.Add((toEmail, resetLink));
        }

        return Task.CompletedTask;
    }
}

/// <summary>Test-only endpoint used to verify the 500 ProblemDetails shape.</summary>
[ApiController]
[Route("api/test")]
[AllowAnonymous]
public sealed class TestFailureController : ControllerBase
{
    [HttpGet("throw")]
    public IActionResult Throw() => throw new InvalidOperationException("secret internal detail");
}

/// <summary>
/// Real API host over a throwaway LocalDB database (D-083), environment "Testing".
/// The schema is created with EnsureCreated and dropped at the end.
/// </summary>
public class LammaApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _connectionString;

    public LammaApiFactory()
    {
        var server = Environment.GetEnvironmentVariable("LAMMA_TEST_SQL_SERVER") ?? @"(localdb)\MSSQLLocalDB";
        _connectionString = $"Server={server};Database=Lamma_ApiTest_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False";
    }

    public MutableClock Clock { get; } = new();

    public CapturingEmailSender Email { get; } = new();

    protected virtual int LoginPermitsPerMinute => 1000;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Lamma", _connectionString);
        builder.UseSetting("App:FrontendBaseUrl", "https://app.lamma.test");
        builder.UseSetting("App:AllowedOrigins:0", "https://app.lamma.test");
        builder.UseSetting("RateLimiting:LoginPermitsPerMinute", LoginPermitsPerMinute.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.UseSetting("RateLimiting:SensitivePermitsPerMinute", "1000");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Email);
            services.RemoveAll<IClock>();
            services.AddSingleton<IClock>(Clock);
            services.AddControllers().AddApplicationPart(typeof(TestFailureController).Assembly);
        });
    }

    public ApiSession NewSession() => new(CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        HandleCookies = true,
        AllowAutoRedirect = false,
    }));

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<Lamma.Infrastructure.Persistence.LammaDbContext>().Database.EnsureCreatedAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        using (var scope = Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<Lamma.Infrastructure.Persistence.LammaDbContext>().Database.EnsureDeletedAsync();
        }

        await DisposeAsync();
    }
}

/// <summary>Factory with a low login limit, for the rate-limit test only.</summary>
public sealed class LowRateLimitApiFactory : LammaApiFactory
{
    protected override int LoginPermitsPerMinute => 2;
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<LammaApiFactory>
{
    public const string Name = "api";
}
