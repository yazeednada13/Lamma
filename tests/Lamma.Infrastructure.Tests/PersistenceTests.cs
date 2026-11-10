using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Infrastructure.Identity;
using Lamma.Infrastructure.Persistence;
using Lamma.Infrastructure.Persistence.Conventions;
using Lamma.Infrastructure.Persistence.Interceptors;
using Lamma.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Lamma.Infrastructure.Tests;

public sealed class PersistenceTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private static readonly SalesChannel[] Instagram = [SalesChannel.Instagram];

    private async Task<(Guid UserId, Business Business)> SeedOnboardedAsync(string name)
    {
        await using var db = database.CreateContext();
        var user = NewUser();
        db.Users.Add(user);
        var business = Business.Create(name, BusinessType.ShoesBags, Instagram, database.Clock.UtcNow);
        db.Businesses.Add(business);
        db.Memberships.Add(BusinessMembership.CreateOwner(user.Id, business.Id, database.Clock.UtcNow));
        await ((IUnitOfWork)db).SaveChangesAsync(default);
        return (user.Id, business);
    }

    private static ApplicationUser NewUser()
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        return new ApplicationUser { UserName = email, NormalizedUserName = email.ToUpperInvariant(), Email = email, NormalizedEmail = email.ToUpperInvariant(), FullName = "Test" };
    }

    [Fact]
    public async Task Schema_uses_the_documented_column_types()
    {
        await using var db = database.CreateContext();
        var columns = await db.Database.SqlQueryRaw<ColumnInfo>(
            """
            SELECT TABLE_NAME AS [Table], COLUMN_NAME AS [Column], DATA_TYPE AS [Type], CHARACTER_MAXIMUM_LENGTH AS [Length]
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME IN ('Businesses', 'BusinessSalesChannels', 'BusinessMemberships')
            """).ToListAsync();

        ColumnInfo Col(string table, string column) => columns.Single(c => c.Table == table && c.Column == column);
        Assert.Equal(("nvarchar", 100), (Col("Businesses", "Name").Type, Col("Businesses", "Name").Length));
        Assert.Equal(("varchar", 32), (Col("Businesses", "BusinessType").Type, Col("Businesses", "BusinessType").Length));
        Assert.Equal(("char", 3), (Col("Businesses", "Currency").Type, Col("Businesses", "Currency").Length));
        Assert.Equal("datetime2", Col("Businesses", "TrialEndsAt").Type);
        Assert.Equal(("varchar", 32), (Col("BusinessSalesChannels", "Channel").Type, Col("BusinessSalesChannels", "Channel").Length));
    }

    [Fact]
    public async Task Enums_are_stored_as_snake_case_codes_and_dates_come_back_as_utc()
    {
        var (_, business) = await SeedOnboardedAsync("enum test");

        await using var db = database.CreateContext(business.Id);
        var stored = await db.Database
            .SqlQuery<string>($"SELECT BusinessType AS [Value] FROM Businesses WHERE Id = {business.Id}")
            .SingleAsync();
        Assert.Equal("shoes_bags", stored);

        var reloaded = await db.Businesses.AsNoTracking().SingleAsync(b => b.Id == business.Id);
        Assert.Equal(DateTimeKind.Utc, reloaded.TrialEndsAt.Kind);
        Assert.Equal(BusinessType.ShoesBags, reloaded.BusinessType);
    }

    [Fact]
    public async Task Timestamps_come_from_the_clock()
    {
        var (_, business) = await SeedOnboardedAsync("timestamps");
        await using var db = database.CreateContext(business.Id);
        var reloaded = await db.Businesses.AsNoTracking().SingleAsync(b => b.Id == business.Id);
        Assert.Equal(database.Clock.UtcNow, reloaded.CreatedAt);
        Assert.Equal(database.Clock.UtcNow, reloaded.UpdatedAt);
    }

    [Fact]
    public async Task Query_filter_shows_only_the_current_business_rows()
    {
        var (_, a) = await SeedOnboardedAsync("A");
        var (_, b) = await SeedOnboardedAsync("B");

        await using var asA = database.CreateContext(a.Id);
        var visible = await asA.BusinessSalesChannels.AsNoTracking().ToListAsync();
        Assert.Equal(4, visible.Count);
        Assert.All(visible, row => Assert.Equal(a.Id, row.BusinessId));

        await using var anonymous = database.CreateContext(null);
        Assert.Empty(await anonymous.BusinessPaymentMethods.AsNoTracking().ToListAsync());

        Assert.NotEqual(a.Id, b.Id);
    }

    [Fact]
    public async Task Interceptor_rejects_modifying_another_business_rows()
    {
        var (_, a) = await SeedOnboardedAsync("A2");
        var (_, b) = await SeedOnboardedAsync("B2");

        await using var asA = database.CreateContext(a.Id);
        var victim = await asA.Businesses
            .IgnoreQueryFilters()
            .Include(x => x.SalesChannels)
            .SingleAsync(x => x.Id == b.Id);
        victim.SetSalesChannels(new Dictionary<SalesChannel, bool> { [SalesChannel.Facebook] = true });

        await Assert.ThrowsAsync<CrossTenantWriteException>(() => asA.SaveChangesAsync());
    }

    [Fact]
    public async Task Repository_loads_the_aggregate_and_saves_settings_changes()
    {
        var (_, business) = await SeedOnboardedAsync("repo");
        await using (var db = database.CreateContext(business.Id))
        {
            var loaded = await new BusinessRepository(db).GetForUpdateAsync(business.Id, default);
            Assert.NotNull(loaded);
            Assert.Equal(6, loaded.PaymentMethods.Count);
            loaded.SetPaymentMethods(new Dictionary<PaymentMethod, bool> { [PaymentMethod.OrangeMoney] = true });
            await ((IUnitOfWork)db).SaveChangesAsync(default);
        }

        await using var check = database.CreateContext(business.Id);
        var flags = await new BusinessSettingsQueries(check).GetPaymentMethodsAsync(business.Id, default);
        Assert.True(flags.Single(f => f.Value == PaymentMethod.OrangeMoney).IsEnabled);
    }

    [Fact]
    public async Task Second_membership_for_a_user_fails_atomically_and_leaves_no_orphan_business()
    {
        var (userId, _) = await SeedOnboardedAsync("first");

        await using var db = database.CreateContext();
        var second = Business.Create("second", BusinessType.Other, Instagram, database.Clock.UtcNow);
        db.Businesses.Add(second);
        db.Memberships.Add(BusinessMembership.CreateOwner(userId, second.Id, database.Clock.UtcNow));

        await Assert.ThrowsAsync<UniqueConstraintViolationException>(() => ((IUnitOfWork)db).SaveChangesAsync(default));

        await using var check = database.CreateContext();
        Assert.False(await check.Businesses.AnyAsync(b => b.Id == second.Id));
        Assert.Equal(1, await check.Memberships.CountAsync(m => m.UserId == userId));
    }

    [Fact]
    public async Task Account_query_projects_the_business_summary()
    {
        var (userId, business) = await SeedOnboardedAsync("summary");
        await using var db = database.CreateContext();
        var row = await new AccountQueries(db).GetBusinessSummaryForUserAsync(userId, default);

        Assert.NotNull(row);
        Assert.Equal(business.Id, row.Id);
        Assert.Equal("summary", row.Name);
        Assert.Equal(SubscriptionPlan.Trial, row.Plan);
        Assert.Null(await new AccountQueries(db).GetBusinessSummaryForUserAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Membership_lookup_for_the_tenant_resolver_finds_the_business()
    {
        var (userId, business) = await SeedOnboardedAsync("resolver");
        await using var db = database.CreateContext();
        Assert.True(await new MembershipRepository(db).ExistsForUserAsync(userId, default));
        Assert.False(await new MembershipRepository(db).ExistsForUserAsync(Guid.NewGuid(), default));
        Assert.NotEqual(Guid.Empty, business.Id);
    }

    private sealed record ColumnInfo(string Table, string Column, string Type, int? Length);
}

public sealed class ConventionTests
{
    private sealed class Priced
    {
        public int Id { get; set; }

        public decimal Amount { get; set; }

        public decimal? Optional { get; set; }

        public PaymentMethod Method { get; set; }
    }

    private sealed class ProbeContext : DbContext
    {
        public DbSet<Priced> Items => Set<Priced>();

        protected override void OnConfiguring(DbContextOptionsBuilder options) => options.UseSqlServer("Server=.;Database=probe");

        protected override void ConfigureConventions(ModelConfigurationBuilder builder) => LammaModelConventions.Apply(builder, typeof(Business).Assembly);
    }

    [Fact]
    public void Money_is_decimal_19_3_and_enums_are_codes()
    {
        using var db = new ProbeContext();
        var entity = db.Model.FindEntityType(typeof(Priced))!;

        Assert.Equal(19, entity.FindProperty(nameof(Priced.Amount))!.GetPrecision());
        Assert.Equal(3, entity.FindProperty(nameof(Priced.Amount))!.GetScale());
        Assert.Equal(3, entity.FindProperty(nameof(Priced.Optional))!.GetScale());

        var method = entity.FindProperty(nameof(Priced.Method))!;
        Assert.Equal(32, method.GetMaxLength());
        Assert.Equal("bank_transfer", method.GetValueConverter()!.ConvertToProvider(PaymentMethod.BankTransfer));
    }
}
