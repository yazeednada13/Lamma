using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lamma.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductTemplateCustomFields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateCode = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    Key = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    LabelAr = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    FieldType = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    OptionsJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductTemplateCustomFields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductTemplateCustomFields_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TemplateCode = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    SellingPrice = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    Cost = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    LowStockThreshold = table.Column<int>(type: "int", nullable: false),
                    AttributesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Option1Name = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Option2Name = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ImagePath = table.Column<string>(type: "varchar(400)", unicode: false, maxLength: 400, nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.CheckConstraint("CK_Products_Cost", "[Cost] >= 0");
                    table.CheckConstraint("CK_Products_LowStockThreshold", "[LowStockThreshold] >= 0 AND [LowStockThreshold] <= 1000");
                    table.CheckConstraint("CK_Products_SellingPrice", "[SellingPrice] > 0");
                    table.ForeignKey(
                        name: "FK_Products_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Option1Value = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Option2Value = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    OptionsKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PriceOverride = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: true),
                    CostOverride = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: true),
                    OnHand = table.Column<int>(type: "int", nullable: false),
                    Reserved = table.Column<int>(type: "int", nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.CheckConstraint("CK_ProductVariants_CostOverride", "[CostOverride] IS NULL OR [CostOverride] >= 0");
                    table.CheckConstraint("CK_ProductVariants_OnHand", "[OnHand] >= 0");
                    table.CheckConstraint("CK_ProductVariants_PriceOverride", "[PriceOverride] IS NULL OR [PriceOverride] > 0");
                    table.CheckConstraint("CK_ProductVariants_Reserved", "[Reserved] >= 0");
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    OnHandDelta = table.Column<int>(type: "int", nullable: false),
                    ReservedDelta = table.Column<int>(type: "int", nullable: false),
                    ReferenceKind = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: true),
                    ReferenceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReferenceLabel = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    UnitCost = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsAutomatic = table.Column<bool>(type: "bit", nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockMovements_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockMovements_ProductVariants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockMovements_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Categories_BusinessId_Name_Active",
                table: "Categories",
                columns: new[] { "BusinessId", "Name" },
                unique: true,
                filter: "[IsArchived] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Products_BusinessId_CategoryId",
                table: "Products",
                columns: new[] { "BusinessId", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_BusinessId_Name",
                table: "Products",
                columns: new[] { "BusinessId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductTemplateCustomFields_BusinessId_TemplateCode_Key",
                table: "ProductTemplateCustomFields",
                columns: new[] { "BusinessId", "TemplateCode", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_BusinessId_ExpiryDate",
                table: "ProductVariants",
                columns: new[] { "BusinessId", "ExpiryDate" },
                filter: "[ExpiryDate] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_ProductVariants_ProductId_OptionsKey",
                table: "ProductVariants",
                columns: new[] { "ProductId", "OptionsKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_BusinessId_CreatedAt",
                table: "StockMovements",
                columns: new[] { "BusinessId", "CreatedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_ProductId_CreatedAt",
                table: "StockMovements",
                columns: new[] { "ProductId", "CreatedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_VariantId_CreatedAt",
                table: "StockMovements",
                columns: new[] { "VariantId", "CreatedAt" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductTemplateCustomFields");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.DropTable(
                name: "ProductVariants");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}
