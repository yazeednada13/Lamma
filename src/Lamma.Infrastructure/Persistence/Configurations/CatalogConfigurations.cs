using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public const string UniqueActiveNameIndex = "UX_Categories_BusinessId_Name_Active";

    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(Category.NameMaxLength).IsRequired();

        // Unique among non-archived rows, so an archived name can be reused (D-095).
        builder.HasIndex(c => new { c.BusinessId, c.Name }).IsUnique().HasFilter("[IsArchived] = 0").HasDatabaseName(UniqueActiveNameIndex);
        builder.HasOne<Business>().WithMany().HasForeignKey(c => c.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products", t =>
        {
            t.HasCheckConstraint("CK_Products_SellingPrice", "[SellingPrice] > 0");
            t.HasCheckConstraint("CK_Products_Cost", "[Cost] >= 0");
            t.HasCheckConstraint("CK_Products_LowStockThreshold", $"[LowStockThreshold] >= 0 AND [LowStockThreshold] <= {Product.LowStockThresholdMax}");
        });
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Name).HasMaxLength(Product.NameMaxLength).IsRequired();
        builder.Property(p => p.TemplateCode).HasMaxLength(32).IsUnicode(false).IsRequired();
        builder.Property(p => p.AttributesJson).IsRequired();
        builder.Property(p => p.Option1Name).HasMaxLength(Product.AxisNameMaxLength);
        builder.Property(p => p.Option2Name).HasMaxLength(Product.AxisNameMaxLength);
        builder.Property(p => p.ImagePath).HasMaxLength(Product.ImagePathMaxLength).IsUnicode(false);
        builder.Ignore(p => p.OptionNames);
        builder.Ignore(p => p.ActiveVariants);

        builder.HasIndex(p => new { p.BusinessId, p.CategoryId });
        builder.HasIndex(p => new { p.BusinessId, p.Name });

        builder.HasOne<Business>().WithMany().HasForeignKey(p => p.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.Variants).WithOne().HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Variants).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public const string UniqueOptionsIndex = "UX_ProductVariants_ProductId_OptionsKey";

    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.ToTable("ProductVariants", t =>
        {
            t.HasCheckConstraint("CK_ProductVariants_OnHand", "[OnHand] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_Reserved", "[Reserved] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_PriceOverride", "[PriceOverride] IS NULL OR [PriceOverride] > 0");
            t.HasCheckConstraint("CK_ProductVariants_CostOverride", "[CostOverride] IS NULL OR [CostOverride] >= 0");
        });
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.Option1Value).HasMaxLength(Product.OptionValueMaxLength);
        builder.Property(v => v.Option2Value).HasMaxLength(Product.OptionValueMaxLength);
        builder.Property(v => v.OptionsKey).HasMaxLength(100).IsRequired();
        builder.Property(v => v.RowVersion).IsRowVersion();
        builder.Ignore(v => v.Values);
        builder.Ignore(v => v.Available);
        builder.Ignore(v => v.IsDefault);

        builder.HasIndex(v => new { v.ProductId, v.OptionsKey }).IsUnique().HasDatabaseName(UniqueOptionsIndex);
        builder.HasIndex(v => new { v.BusinessId, v.ExpiryDate }).HasFilter("[ExpiryDate] IS NOT NULL");
    }
}

internal sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("StockMovements");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.ReferenceLabel).HasMaxLength(StockMovement.ReferenceLabelMaxLength);
        builder.Property(m => m.Reason).HasMaxLength(StockMovement.ReasonMaxLength);

        builder.HasIndex(m => new { m.VariantId, m.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(m => new { m.ProductId, m.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(m => new { m.BusinessId, m.CreatedAt }).IsDescending(false, true);

        builder.HasOne<Business>().WithMany().HasForeignKey(m => m.BusinessId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Product>().WithMany().HasForeignKey(m => m.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ProductVariant>().WithMany().HasForeignKey(m => m.VariantId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ProductTemplateCustomFieldConfiguration : IEntityTypeConfiguration<ProductTemplateCustomField>
{
    public void Configure(EntityTypeBuilder<ProductTemplateCustomField> builder)
    {
        builder.ToTable("ProductTemplateCustomFields");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).ValueGeneratedNever();
        builder.Property(f => f.TemplateCode).HasMaxLength(32).IsUnicode(false).IsRequired();
        builder.Property(f => f.Key).HasMaxLength(16).IsUnicode(false).IsRequired();
        builder.Property(f => f.LabelAr).HasMaxLength(ProductTemplateCustomField.LabelMaxLength).IsRequired();
        builder.Property(f => f.OptionsJson).HasMaxLength(2000).IsRequired();
        builder.Ignore(f => f.Options);

        builder.HasIndex(f => new { f.BusinessId, f.TemplateCode, f.Key }).IsUnique();
        builder.HasOne<Business>().WithMany().HasForeignKey(f => f.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}
