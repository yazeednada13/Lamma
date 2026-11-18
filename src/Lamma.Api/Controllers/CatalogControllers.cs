using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Product categories of the current business (D-095).</summary>
[ApiController]
[Route("api/v1/categories")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class CategoriesController(ICategoryService categories) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> List(CancellationToken cancellationToken)
        => Ok(await categories.ListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(CategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categories.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/categories/{category.Id}", category);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> Rename(Guid id, CategoryRequest request, CancellationToken cancellationToken)
        => Ok(await categories.RenameAsync(id, request, cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await categories.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

/// <summary>System product templates with the business's custom fields (D-091, D-092).</summary>
[ApiController]
[Route("api/v1/product-templates")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class ProductTemplatesController(IProductTemplateService templates) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductTemplateDto>>> List(CancellationToken cancellationToken)
        => Ok(await templates.ListAsync(cancellationToken));

    [HttpPost("{code}/fields")]
    public async Task<ActionResult<TemplateFieldDto>> AddField(string code, TemplateFieldRequest request, CancellationToken cancellationToken)
    {
        var field = await templates.AddFieldAsync(code, request, cancellationToken);
        return Created($"/api/v1/product-templates/{code}/fields/{field.Key}", field);
    }

    [HttpPut("{code}/fields/{key}")]
    public async Task<ActionResult<TemplateFieldDto>> UpdateField(string code, string key, TemplateFieldRequest request, CancellationToken cancellationToken)
        => Ok(await templates.UpdateFieldAsync(code, key, request, cancellationToken));

    [HttpDelete("{code}/fields/{key}")]
    public async Task<IActionResult> DeleteField(string code, string key, CancellationToken cancellationToken)
    {
        await templates.DeleteFieldAsync(code, key, cancellationToken);
        return NoContent();
    }
}

/// <summary>Products, variants and the product image (Phase 2 catalog).</summary>
[ApiController]
[Route("api/v1/products")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class ProductsController(IProductService products, IProductImageService images) : ControllerBase
{
    /// <summary>Multipart overhead on top of the 5 MB image limit; the service enforces the exact limit.</summary>
    private const long MaxUploadRequestBytes = 6 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductListItemDto>>> List([FromQuery] ProductListQuery query, CancellationToken cancellationToken)
        => Ok(await products.ListAsync(query, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDetailsDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await products.GetAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ProductDetailsDto>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await products.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/products/{product.Id}", product);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProductDetailsDto>> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
        => Ok(await products.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/archive")]
    public async Task<ActionResult<ProductDetailsDto>> Archive(Guid id, CancellationToken cancellationToken)
        => Ok(await products.SetArchivedAsync(id, archived: true, cancellationToken));

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult<ProductDetailsDto>> Restore(Guid id, CancellationToken cancellationToken)
        => Ok(await products.SetArchivedAsync(id, archived: false, cancellationToken));

    [HttpPost("{id:guid}/variants")]
    public async Task<ActionResult<ProductDetailsDto>> AddVariant(Guid id, AddVariantRequest request, CancellationToken cancellationToken)
        => Created($"/api/v1/products/{id}", await products.AddVariantAsync(id, request, cancellationToken));

    [HttpPut("{id:guid}/variants/{variantId:guid}")]
    public async Task<ActionResult<ProductDetailsDto>> UpdateVariant(Guid id, Guid variantId, UpdateVariantRequest request, CancellationToken cancellationToken)
        => Ok(await products.UpdateVariantAsync(id, variantId, request, cancellationToken));

    [HttpPost("{id:guid}/variants/{variantId:guid}/archive")]
    public async Task<ActionResult<ProductDetailsDto>> ArchiveVariant(Guid id, Guid variantId, CancellationToken cancellationToken)
        => Ok(await products.SetVariantArchivedAsync(id, variantId, archived: true, cancellationToken));

    [HttpPost("{id:guid}/variants/{variantId:guid}/restore")]
    public async Task<ActionResult<ProductDetailsDto>> RestoreVariant(Guid id, Guid variantId, CancellationToken cancellationToken)
        => Ok(await products.SetVariantArchivedAsync(id, variantId, archived: false, cancellationToken));

    [HttpPut("{id:guid}/image")]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequestBytes)]
    public async Task<ActionResult<ProductDetailsDto>> UploadImage(Guid id, IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null)
        {
            throw RequestValidationException.ForField("file", "اختار صورة.", "product.image_missing");
        }

        await using var stream = file.OpenReadStream();
        return Ok(await images.UploadAsync(id, stream, file.Length, cancellationToken));
    }

    [HttpDelete("{id:guid}/image")]
    public async Task<IActionResult> DeleteImage(Guid id, CancellationToken cancellationToken)
    {
        await images.RemoveAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/image")]
    public async Task<IActionResult> GetImage(Guid id, CancellationToken cancellationToken)
    {
        var image = await images.GetAsync(id, cancellationToken);

        // No cache header here: the auth cookie is renewed on every request (security stamp, interval 0), and the
        // cookie handler then marks the response no-cache/no-store, so images are never stored in shared caches.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(image.Content, image.ContentType);
    }
}
