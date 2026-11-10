using Lamma.Api;
using Lamma.Application;
using Lamma.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Strict DI checks (scope validation + build-time validation) everywhere except Production.
builder.Host.UseDefaultServiceProvider((context, options) =>
{
    var strict = !context.HostingEnvironment.IsProduction();
    options.ValidateScopes = strict;
    options.ValidateOnBuild = strict;
});

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment.IsDevelopment())
    .AddApi(builder.Configuration);

var app = builder.Build();
app.UseLammaPipeline();
app.Run();

/// <summary>Entry point; partial so integration tests can use WebApplicationFactory&lt;Program&gt;.</summary>
public partial class Program;
