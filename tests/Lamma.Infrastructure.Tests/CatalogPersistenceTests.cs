using System.Data.Common;
using Lamma.Application.Catalog;
using Lamma.Application.Common;
using Lamma.Domain.Businesses;
using Lamma.Domain.Catalog;
using Lamma.Infrastructure.Persistence;
using Lamma.Infrastructure.Persistence.Interceptors;
using Lamma.Infrastructure.Persistence.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Lamma.Infrastructure.Tests;

public sealed class CatalogPersistenceTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private async Task<Guid> SeedBusinessAsync()
    {
        await using var db = database.CreateContext();
        var business = Business.Create("متجر", BusinessType.Clothing, [SalesChannel.Instagram], database.Clock.UtcNow);
        db.Businesses.Add(business);
        await db.SaveChangesAsync();
        return business.Id;
    }

    private static Product Dress(Guid businessId, string name = "فستان", Guid? categoryId = null)
        => Product.Create(businessId, name, categoryId, "clothing", 38m, 17m, 5, "{}", ["المقاس", "اللون"],
            [new VariantSpec(["S", "زيتي"]), new VariantSpec(["M", "زيتي"], priceOverride: 40m)]);

    private async Task<Product> SeedProductAsync(Guid businessId, string name = "فستان", Guid? categoryId = null, int openingS = 0)
    {
        await using var db = database.CreateContext(businessId);
        var product = Dress(businessId, name, categoryId);
        db.Products.Add(product);
        if (openingS > 0)
        {
            db.StockMovements.Add(product.RecordOpeningStock(product.Variants.First(), openingS, Guid.NewGuid(), database.Clock.UtcNow));
        }

        await db.SaveChangesAsync();
        return product;
    }

    [Fact]
    public async Task Product_variants_and_movements_round_trip_with_money_and_codes()
    {
        var businessId = await SeedBusinessAsync();
        var product = await SeedProductAsync(businessId, openingS: 4);

        await using var db = database.CreateContext(businessId);
        var loaded = await db.Products.Include(p => p.Variants).AsNoTracking().SingleAsync(p => p.Id == product.Id);
        Assert.Equal(2, loaded.Variants.Count);
        Assert.Equal(40m, loaded.Variants.Single(v => v.OptionsKey == "m|زيتي").PriceOverride);
        Assert.Equal(4, loaded.Variants.Single(v => v.OptionsKey == "s|زيتي").OnHand);
        Assert.NotEmpty(loaded.Variants.First().RowVersion);

        var type = await db.Database.SqlQuery<string>($"SELECT Type AS [Value] FROM StockMovements WHERE ProductId = {product.Id}").SingleAsync();
        var kind = await db.Database.SqlQuery<string>($"SELECT ReferenceKind AS [Value] FROM StockMovements WHERE ProductId = {product.Id}").SingleAsync();
        Assert.Equal(("receive", "opening"), (type, kind));

        var precision = await db.Database.SqlQuery<int>(
            $"SELECT CAST(NUMERIC_SCALE AS int) AS [Value] FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'SellingPrice'").SingleAsync();
        Assert.Equal(3, precision);
    }

    [Fact]
    public async Task Catalog_tables_are_isolated_per_business()
    {
        var a = await SeedBusinessAsync();
        var b = await SeedBusinessAsync();
        var productA = await SeedProductAsync(a, openingS: 2);
        await using (var seed = database.CreateContext(a))
        {
            seed.Categories.Add(Category.Create(a, "فساتين"));
            seed.ProductTemplateCustomFields.Add(ProductTemplateCustomField.Create(a, "clothing", "الموديل", TemplateFieldType.Text, [], false, 1));
            await seed.SaveChangesAsync();
        }

        await using var asB = database.CreateContext(b);
        Assert.Empty(await asB.Products.ToListAsync());
        Assert.Empty(await asB.ProductVariants.ToListAsync());
        Assert.Empty(await asB.StockMovements.ToListAsync());
        Assert.Empty(await asB.Categories.ToListAsync());
        Assert.Empty(await asB.ProductTemplateCustomFields.ToListAsync());
        Assert.Null(await new ProductQueries(asB).GetDetailsAsync(productA.Id, 10, default));
    }

    [Fact]
    public async Task Writing_another_business_product_is_rejected()
    {
        var a = await SeedBusinessAsync();
        var b = await SeedBusinessAsync();

        await using var asB = database.CreateContext(b);
        asB.Products.Add(Dress(a));
        await Assert.ThrowsAsync<CrossTenantWriteException>(() => asB.SaveChangesAsync());
    }

    [Fact]
    public async Task Archived_category_name_can_be_reused_but_active_names_are_unique()
    {
        var businessId = await SeedBusinessAsync();
        await using (var db = database.CreateContext(businessId))
        {
            var old = Category.Create(businessId, "عطور");
            old.Archive();
            db.Categories.Add(old);
            db.Categories.Add(Category.Create(businessId, "عطور"));
            await db.SaveChangesAsync();
        }

        await using var again = database.CreateContext(businessId);
        again.Categories.Add(Category.Create(businessId, "عطور"));
        await Assert.ThrowsAsync<UniqueConstraintViolationException>(() => ((IUnitOfWork)again).SaveChangesAsync(default));
    }

    [Fact]
    public async Task A_failed_save_writes_no_product_variant_or_movement()
    {
        var businessId = await SeedBusinessAsync();
        await using (var seed = database.CreateContext(businessId))
        {
            seed.Categories.Add(Category.Create(businessId, "مكرر"));
            await seed.SaveChangesAsync();
        }

        await using var db = database.CreateContext(businessId);
        var product = Dress(businessId, "لن يُحفظ");
        db.Products.Add(product);
        db.StockMovements.Add(product.RecordOpeningStock(product.Variants.First(), 5, Guid.NewGuid(), database.Clock.UtcNow));
        db.Categories.Add(Category.Create(businessId, "مكرر")); // forces a unique-index failure in the same SaveChanges

        await Assert.ThrowsAsync<UniqueConstraintViolationException>(() => ((IUnitOfWork)db).SaveChangesAsync(default));

        await using var check = database.CreateContext(businessId);
        Assert.False(await check.Products.AnyAsync(p => p.Id == product.Id));
        Assert.False(await check.ProductVariants.AnyAsync(v => v.ProductId == product.Id));
        Assert.False(await check.StockMovements.AnyAsync(m => m.ProductId == product.Id));
    }

    [Fact]
    public async Task Concurrent_variant_edits_surface_as_a_conflict()
    {
        var businessId = await SeedBusinessAsync();
        var product = await SeedProductAsync(businessId);
        var variantId = product.Variants.First().Id;

        await using var first = database.CreateContext(businessId);
        await using var second = database.CreateContext(businessId);
        var a = await new ProductRepository(first).GetForUpdateAsync(product.Id, default);
        var b = await new ProductRepository(second).GetForUpdateAsync(product.Id, default);

        a!.UpdateVariant(variantId, 30m, null, null);
        await ((IUnitOfWork)first).SaveChangesAsync(default);
        b!.UpdateVariant(variantId, 31m, null, null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => ((IUnitOfWork)second).SaveChangesAsync(default));
        Assert.Equal("concurrency.conflict", ex.Code);
    }

    [Fact]
    public async Task Check_constraints_block_negative_stock()
    {
        var businessId = await SeedBusinessAsync();
        var product = await SeedProductAsync(businessId);

        await using var db = database.CreateContext(businessId);
        var ex = await Assert.ThrowsAsync<SqlException>(() =>
            db.Database.ExecuteSqlAsync($"UPDATE ProductVariants SET OnHand = -1 WHERE ProductId = {product.Id}"));
        Assert.Contains("CK_ProductVariants_OnHand", ex.Message);
    }

    [Fact]
    public async Task Category_query_counts_only_active_products()
    {
        var businessId = await SeedBusinessAsync();
        var category = Category.Create(businessId, "فساتين");
        await using (var db = database.CreateContext(businessId))
        {
            db.Categories.Add(category);
            await db.SaveChangesAsync();
        }

        await SeedProductAsync(businessId, "أ", category.Id);
        var archived = await SeedProductAsync(businessId, "ب", category.Id);
        await using (var db = database.CreateContext(businessId))
        {
            var tracked = await db.Products.SingleAsync(p => p.Id == archived.Id);
            tracked.Archive();
            await db.SaveChangesAsync();
        }

        await using var read = database.CreateContext(businessId);
        var row = Assert.Single(await new CategoryQueries(read).ListAsync(default));
        Assert.Equal(1, row.ProductCount);
        Assert.Equal(1, await new CategoryRepository(read).CountProductsAsync(category.Id, archived: true, default));
    }

    [Fact]
    public async Task Product_list_aggregates_in_sql_with_two_commands_and_filters_by_status()
    {
        var businessId = await SeedBusinessAsync();
        await SeedProductAsync(businessId, "نفد");
        await SeedProductAsync(businessId, "قليل", openingS: 3);
        await SeedProductAsync(businessId, "متوفر", openingS: 9);

        var counter = new CommandCounter();
        await using var db = CreateCountingContext(businessId, counter);
        var queries = new ProductQueries(db);

        var all = await queries.ListAsync(new ProductListQuery { Sort = "name" }, default);
        Assert.Equal(2, counter.Count); // count + page, regardless of the number of products and variants
        Assert.Equal(3, all.TotalCount);
        var low = all.Items.Single(i => i.Name == "قليل");
        Assert.Equal(("low", 3, 38m, 40m, 2), (low.StockStatus, low.Available, low.MinPrice, low.MaxPrice, low.VariantCount));

        Assert.Equal(["نفد"], (await queries.ListAsync(new ProductListQuery { StockStatus = "out" }, default)).Items.Select(i => i.Name));
        Assert.Equal(["متوفر"], (await queries.ListAsync(new ProductListQuery { StockStatus = "in" }, default)).Items.Select(i => i.Name));
        Assert.Equal(["قليل"], (await queries.ListAsync(new ProductListQuery { Search = "قل" }, default)).Items.Select(i => i.Name));
        Assert.Equal(["متوفر", "قليل"], (await queries.ListAsync(new ProductListQuery { Sort = "-available", PageSize = 2 }, default)).Items.Select(i => i.Name));
    }

    private LammaDbContext CreateCountingContext(Guid businessId, CommandCounter counter)
    {
        var template = database.CreateContext(businessId);
        var connectionString = template.Database.GetConnectionString()!;
        template.Dispose();

        var tenant = new Lamma.Infrastructure.Tenancy.TenantContext();
        tenant.Set(businessId);
        var options = new DbContextOptionsBuilder<LammaDbContext>()
            .UseSqlServer(connectionString)
            .AddInterceptors(new TimestampsInterceptor(database.Clock), new TenancyInterceptor(tenant), counter)
            .Options;
        return new LammaDbContext(options, tenant);
    }

    private sealed class CommandCounter : DbCommandInterceptor
    {
        public int Count { get; private set; }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Count++;
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
