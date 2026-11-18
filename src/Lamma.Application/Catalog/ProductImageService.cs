using Lamma.Application.Common;

namespace Lamma.Application.Catalog;

/// <summary>Detects an image type from its first bytes (never from the file name or Content-Type, D-094).</summary>
public static class ImageSignature
{
    public const int HeaderLength = 12;

    /// <summary>Returns (extension, content type) for jpg/png/webp, or null for anything else.</summary>
    public static (string Extension, string ContentType)? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            return ("jpg", "image/jpeg");
        }

        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return ("png", "image/png");
        }

        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8))
        {
            return ("webp", "image/webp");
        }

        return null;
    }

    public static string ContentTypeForPath(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "image/jpeg",
    };
}

public interface IProductImageService
{
    /// <summary>Validates (type by content, ≤ 5 MB), stores and attaches the image; replaces any previous one.</summary>
    Task<ProductDetailsDto> UploadAsync(Guid productId, Stream content, long length, CancellationToken cancellationToken);

    Task RemoveAsync(Guid productId, CancellationToken cancellationToken);

    /// <summary>The image of a product of the current business, or 404.</summary>
    Task<ProductImageContent> GetAsync(Guid productId, CancellationToken cancellationToken);
}

internal sealed class ProductImageService(
    ICurrentBusiness currentBusiness,
    IProductRepository products,
    IProductService productService,
    IFileStorage storage,
    IUnitOfWork unitOfWork) : IProductImageService
{
    public const long MaxBytes = 5 * 1024 * 1024;

    public async Task<ProductDetailsDto> UploadAsync(Guid productId, Stream content, long length, CancellationToken cancellationToken)
    {
        var product = await products.GetForUpdateAsync(productId, cancellationToken) ?? throw CatalogErrors.ProductNotFound();
        if (length > MaxBytes)
        {
            throw TooLarge();
        }

        // Buffer (bounded) so the size and the signature are checked on the actual bytes.
        using var buffer = new MemoryStream();
        await CopyBoundedAsync(content, buffer, cancellationToken);
        if (buffer.Length == 0)
        {
            throw RequestValidationException.ForField("file", "اختار صورة.", "product.image_missing");
        }

        var type = ImageSignature.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, ImageSignature.HeaderLength)))
                   ?? throw RequestValidationException.ForField("file", "الصورة لازم تكون JPG أو PNG أو WEBP.", "product.image_invalid_type");

        var path = $"{currentBusiness.BusinessId:N}/{product.Id:N}/{Guid.NewGuid():N}.{type.Extension}";
        buffer.Position = 0;
        await storage.SaveAsync(path, buffer, cancellationToken);

        var previous = product.SetImage(path);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await storage.DeleteAsync(path, CancellationToken.None);
            throw;
        }

        if (previous is not null)
        {
            await storage.DeleteAsync(previous, CancellationToken.None); // after commit; failure leaves a harmless orphan
        }

        return await productService.GetAsync(product.Id, cancellationToken);
    }

    public async Task RemoveAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await products.GetForUpdateAsync(productId, cancellationToken) ?? throw CatalogErrors.ProductNotFound();
        var previous = product.RemoveImage();
        await unitOfWork.SaveChangesAsync(cancellationToken);
        if (previous is not null)
        {
            await storage.DeleteAsync(previous, CancellationToken.None);
        }
    }

    public async Task<ProductImageContent> GetAsync(Guid productId, CancellationToken cancellationToken)
    {
        // The tenant query filter makes another business's product invisible (404).
        var product = await products.GetForUpdateAsync(productId, cancellationToken) ?? throw CatalogErrors.ProductNotFound();
        if (product.ImagePath is null)
        {
            throw new NotFoundException("product.image_not_found", "ما في صورة لهذا المنتج.");
        }

        var stream = await storage.OpenReadAsync(product.ImagePath, cancellationToken)
                     ?? throw new NotFoundException("product.image_not_found", "ما في صورة لهذا المنتج.");
        return new ProductImageContent(stream, ImageSignature.ContentTypeForPath(product.ImagePath));
    }

    private static async Task CopyBoundedAsync(Stream source, MemoryStream target, CancellationToken cancellationToken)
    {
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (target.Length + read > MaxBytes)
            {
                throw TooLarge();
            }

            await target.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
        }
    }

    private static RequestValidationException TooLarge()
        => RequestValidationException.ForField("file", "حجم الصورة لازم يكون 5 ميجا أو أقل.", "product.image_too_large");
}
