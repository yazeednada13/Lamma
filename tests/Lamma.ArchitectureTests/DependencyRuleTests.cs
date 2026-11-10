using System.Reflection;
using Lamma.Domain.Businesses;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.ArchitectureTests;

/// <summary>
/// Enforces the Backend Engineering Standards (MASTER-ARCHITECTURE §4) by reflection (P-020: no extra package).
/// The compiler drops unused references, so referenced assemblies reflect actual usage.
/// </summary>
public sealed class DependencyRuleTests
{
    private static readonly Assembly Domain = typeof(Business).Assembly;
    private static readonly Assembly Application = typeof(Lamma.Application.DependencyInjection).Assembly;
    private static readonly Assembly Infrastructure = typeof(Lamma.Infrastructure.DependencyInjection).Assembly;
    private static readonly Assembly Api = typeof(Lamma.Api.DependencyInjection).Assembly;

    private static readonly Assembly[] All = [Domain, Application, Infrastructure, Api];

    private static string[] ReferencedNames(Assembly assembly) => assembly.GetReferencedAssemblies().Select(a => a.Name!).ToArray();

    [Fact]
    public void Domain_depends_on_nothing_but_the_BCL()
    {
        var forbidden = ReferencedNames(Domain).Where(n => n.StartsWith("Lamma.", StringComparison.Ordinal) || n.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) || n.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal) || n.StartsWith("FluentValidation", StringComparison.Ordinal));
        Assert.Empty(forbidden);
    }

    [Fact]
    public void Application_does_not_depend_on_infrastructure_ef_or_aspnetcore()
    {
        var forbidden = ReferencedNames(Application).Where(n => n is "Lamma.Infrastructure" or "Lamma.Api" || n.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) || n.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal));
        Assert.Empty(forbidden);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_the_api()
        => Assert.DoesNotContain("Lamma.Api", ReferencedNames(Infrastructure));

    [Fact]
    public void Application_public_contracts_do_not_expose_IQueryable()
    {
        var offenders = Application.GetExportedTypes()
            .Where(t => t.IsInterface)
            .SelectMany(t => t.GetMethods())
            .Where(m => IsQueryable(m.ReturnType) || m.GetParameters().Any(p => IsQueryable(p.ParameterType)))
            .Select(m => $"{m.DeclaringType!.Name}.{m.Name}")
            .ToList();
        Assert.Empty(offenders);

        static bool IsQueryable(Type type)
            => typeof(IQueryable).IsAssignableFrom(type) || (type.IsGenericType && type.GetGenericArguments().Any(IsQueryable));
    }

    [Fact]
    public void Only_the_api_composition_root_touches_infrastructure()
    {
        // Program (top-level statements) and Lamma.Api.DependencyInjection may call AddInfrastructure. Nothing else may use Infrastructure types.
        var offenders = Api.GetTypes()
            .Where(t => t.Name != "Program" && !t.Name.StartsWith('<') && t != typeof(Lamma.Api.DependencyInjection))
            .Where(t => UsedTypes(t).Any(u => u.Assembly == Infrastructure))
            .Select(t => t.FullName)
            .ToList();
        Assert.Empty(offenders);
    }

    [Fact]
    public void Controllers_depend_only_on_application_service_interfaces()
    {
        var controllers = Api.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract).ToList();
        Assert.NotEmpty(controllers);

        foreach (var controller in controllers)
        {
            foreach (var parameter in controller.GetConstructors().SelectMany(c => c.GetParameters()))
            {
                Assert.True(
                    parameter.ParameterType.IsInterface && parameter.ParameterType.Assembly == Application,
                    $"{controller.Name} depends on {parameter.ParameterType.FullName}; controllers may only depend on Application service interfaces.");
            }
        }
    }

    [Fact]
    public void No_generic_repository_and_no_mediatr()
    {
        var genericRepositories = All.SelectMany(a => a.GetTypes())
            .SelectMany(t => t.GetInterfaces().Append(t))
            .Where(t => t.IsGenericType && t.Name.StartsWith("IRepository", StringComparison.Ordinal))
            .ToList();
        Assert.Empty(genericRepositories);

        Assert.All(All, a => Assert.DoesNotContain(ReferencedNames(a), n => n.StartsWith("MediatR", StringComparison.Ordinal)));
    }

    [Fact]
    public void Domain_entities_expose_no_public_setters()
    {
        var offenders = Domain.GetExportedTypes()
            .Where(t => t.IsClass && t.Namespace?.StartsWith("Lamma.Domain", StringComparison.Ordinal) == true)
            .SelectMany(t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            .Where(p => p.SetMethod?.IsPublic == true)
            .Select(p => $"{p.DeclaringType!.Name}.{p.Name}")
            .ToList();
        Assert.Empty(offenders);
    }

    private static IEnumerable<Type> UsedTypes(Type type)
    {
        const BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
        var types = new List<Type>();
        types.AddRange(type.GetFields(flags).Select(f => f.FieldType));
        types.AddRange(type.GetProperties(flags).Select(p => p.PropertyType));
        types.AddRange(type.GetConstructors(flags).SelectMany(c => c.GetParameters()).Select(p => p.ParameterType));
        types.AddRange(type.GetMethods(flags).SelectMany(m => m.GetParameters().Select(p => p.ParameterType).Append(m.ReturnType)));
        if (type.BaseType is not null)
        {
            types.Add(type.BaseType);
        }

        return types.SelectMany(Flatten);

        static IEnumerable<Type> Flatten(Type t)
        {
            yield return t;
            if (t.IsGenericType)
            {
                foreach (var arg in t.GetGenericArguments().SelectMany(Flatten))
                {
                    yield return arg;
                }
            }

            if (t.HasElementType)
            {
                foreach (var e in Flatten(t.GetElementType()!))
                {
                    yield return e;
                }
            }
        }
    }
}
