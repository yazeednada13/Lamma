using Lamma.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lamma.Infrastructure.Services;

/// <summary>"Storage" configuration section (D-094).</summary>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>Root folder for uploaded files. Empty = %LOCALAPPDATA%/Lamma/uploads (outside the repository).</summary>
    public string RootPath { get; set; } = string.Empty;

    public string ResolveRoot()
        => Path.GetFullPath(string.IsNullOrWhiteSpace(RootPath)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lamma", "uploads")
            : RootPath);
}

/// <summary>
/// Local-disk file storage for Development (D-094). Paths come from the application (random names), and every
/// resolved path is checked to stay inside the root folder.
/// </summary>
internal sealed partial class LocalFileStorage(IOptions<StorageOptions> options, ILogger<LocalFileStorage> logger) : IFileStorage
{
    private readonly string _root = options.Value.ResolveRoot();

    public async Task SaveAsync(string path, Stream content, CancellationToken cancellationToken)
    {
        var full = Resolve(path);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await using var file = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, cancellationToken);
    }

    public Task<Stream?> OpenReadAsync(string path, CancellationToken cancellationToken)
    {
        var full = Resolve(path);
        Stream? stream = File.Exists(full) ? new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true) : null;
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string path, CancellationToken cancellationToken)
    {
        try
        {
            var full = Resolve(path);
            if (File.Exists(full))
            {
                File.Delete(full);
            }
        }
        catch (IOException ex)
        {
            LogDeleteFailed(logger, ex, path);
        }
        catch (UnauthorizedAccessException ex)
        {
            LogDeleteFailed(logger, ex, path);
        }

        return Task.CompletedTask;
    }

    private string Resolve(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || Path.IsPathRooted(path) || path.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Invalid storage path.");
        }

        var full = Path.GetFullPath(Path.Combine(_root, path));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Storage path escapes the root folder.");
        }

        return full;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not delete stored file {Path}; it is left as an orphan.")]
    private static partial void LogDeleteFailed(ILogger logger, Exception exception, string path);
}
