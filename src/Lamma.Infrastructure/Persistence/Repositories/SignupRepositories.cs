using Lamma.Application.Signup;
using Lamma.Domain.Customers;
using Lamma.Domain.Signup;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lamma.Infrastructure.Persistence.Repositories;

/// <summary>Public sign-up leads (D-160). Platform-level: no BusinessId, so no tenant filter applies.</summary>
internal sealed class SignupLeadConfiguration : IEntityTypeConfiguration<SignupLead>
{
    public const string UniqueEmailIndex = "UX_SignupLeads_NormalizedEmail";

    public void Configure(EntityTypeBuilder<SignupLead> builder)
    {
        builder.ToTable("SignupLeads");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.FullName).HasMaxLength(SignupLead.FullNameMaxLength).IsRequired();
        builder.Property(l => l.Email).HasMaxLength(SignupLead.EmailMaxLength).IsRequired();
        builder.Property(l => l.NormalizedEmail).HasMaxLength(SignupLead.EmailMaxLength).IsRequired();
        builder.Property(l => l.PhoneE164).HasMaxLength(PhoneNumber.MaxLength).IsUnicode(false).IsRequired();
        builder.Property(l => l.StoreName).HasMaxLength(SignupLead.StoreNameMaxLength);
        builder.Property(l => l.UtmSource).HasMaxLength(SignupLead.UtmMaxLength);
        builder.Property(l => l.UtmMedium).HasMaxLength(SignupLead.UtmMaxLength);
        builder.Property(l => l.UtmCampaign).HasMaxLength(SignupLead.UtmMaxLength);
        builder.Property(l => l.InviteTokenHash).HasMaxLength(SignupLead.TokenHashLength).IsFixedLength().IsUnicode(false);

        builder.HasIndex(l => l.NormalizedEmail).IsUnique().HasDatabaseName(UniqueEmailIndex);
        builder.HasIndex(l => l.InviteTokenHash).HasFilter("[InviteTokenHash] IS NOT NULL");
        builder.HasIndex(l => new { l.Status, l.CreatedAt });
    }
}

internal sealed class SignupLeadRepository(LammaDbContext db) : ISignupLeadRepository
{
    public Task<SignupLead?> FindByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
        => db.SignupLeads.FirstOrDefaultAsync(l => l.NormalizedEmail == normalizedEmail, cancellationToken);

    public Task<SignupLead?> FindByTokenHashAsync(string tokenHash, CancellationToken cancellationToken)
        => db.SignupLeads.FirstOrDefaultAsync(l => l.InviteTokenHash == tokenHash, cancellationToken);

    public Task<SignupLead?> FindByIdAsync(Guid id, CancellationToken cancellationToken)
        => db.SignupLeads.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

    public Task<SignupLead?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken)
        => db.SignupLeads.AsNoTracking().FirstOrDefaultAsync(l => l.UserId == userId, cancellationToken);

    public void Add(SignupLead lead) => db.SignupLeads.Add(lead);
}
