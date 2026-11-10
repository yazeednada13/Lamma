using Lamma.Domain.Businesses;
using Lamma.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Configurations;

internal sealed class BusinessConfiguration : IEntityTypeConfiguration<Business>
{
    public void Configure(EntityTypeBuilder<Business> builder)
    {
        builder.ToTable("Businesses");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();
        builder.Property(b => b.Name).HasMaxLength(Business.NameMaxLength).IsRequired();
        builder.Property(b => b.Currency).HasMaxLength(3).IsFixedLength().IsUnicode(false).IsRequired();
        builder.Property(b => b.TimeZoneId).HasMaxLength(64).IsUnicode(false).IsRequired();
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Businesses_DefaultLowStockThreshold",
            $"[DefaultLowStockThreshold] >= 0 AND [DefaultLowStockThreshold] <= {Business.LowStockThresholdMax}"));

        builder.HasMany(b => b.SalesChannels).WithOne().HasForeignKey(c => c.BusinessId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(b => b.PaymentMethods).WithOne().HasForeignKey(m => m.BusinessId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(b => b.SalesChannels).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(b => b.PaymentMethods).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class BusinessSalesChannelConfiguration : IEntityTypeConfiguration<BusinessSalesChannel>
{
    public void Configure(EntityTypeBuilder<BusinessSalesChannel> builder)
    {
        builder.ToTable("BusinessSalesChannels");
        builder.HasKey(c => new { c.BusinessId, c.Channel });
    }
}

internal sealed class BusinessPaymentMethodConfiguration : IEntityTypeConfiguration<BusinessPaymentMethod>
{
    public void Configure(EntityTypeBuilder<BusinessPaymentMethod> builder)
    {
        builder.ToTable("BusinessPaymentMethods");
        builder.HasKey(m => new { m.BusinessId, m.Method });
    }
}

internal sealed class BusinessMembershipConfiguration : IEntityTypeConfiguration<BusinessMembership>
{
    public const string UniqueUserIndex = "UX_BusinessMemberships_UserId";

    public void Configure(EntityTypeBuilder<BusinessMembership> builder)
    {
        builder.ToTable("BusinessMemberships");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        // V1: one business per user (D-079). Relaxing this index is the only schema change multi-user needs.
        builder.HasIndex(m => m.UserId).IsUnique().HasDatabaseName(UniqueUserIndex);
        builder.HasIndex(m => m.BusinessId);

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Business>().WithMany().HasForeignKey(m => m.BusinessId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.FullName).HasMaxLength(100).IsRequired();
    }
}
