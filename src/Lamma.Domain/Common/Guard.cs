namespace Lamma.Domain.Common;

/// <summary>Argument guards for programming errors (not user input; user input is validated before reaching the domain).</summary>
public static class Guard
{
    public static void NotEmpty(Guid value, string name)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Value must not be an empty Guid.", name);
        }
    }

    public static string NotBlank(string? value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value must not be blank.", name);
        }

        return value;
    }
}
