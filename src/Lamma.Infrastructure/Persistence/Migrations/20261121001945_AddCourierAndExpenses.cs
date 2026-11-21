using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lamma.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCourierAndExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SettlementId",
                table: "Payments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CourierCompanyName",
                table: "Businesses",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CourierSettlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SettledOn = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    ReceivedAmount = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    Difference = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReversedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    ReversalReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourierSettlements", x => x.Id);
                    table.CheckConstraint("CK_CourierSettlements_Difference", "[Difference] = [ExpectedAmount] - [ReceivedAmount]");
                    table.CheckConstraint("CK_CourierSettlements_Expected", "[ExpectedAmount] > 0");
                    table.CheckConstraint("CK_CourierSettlements_Received", "[ReceivedAmount] >= 0 AND [ReceivedAmount] <= [ExpectedAmount]");
                    table.ForeignKey(
                        name: "FK_CourierSettlements_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseCategories_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CourierSettlementOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SettlementId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    IsReversed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourierSettlementOrders", x => x.Id);
                    table.CheckConstraint("CK_CourierSettlementOrders_Expected", "[ExpectedAmount] > 0");
                    table.ForeignKey(
                        name: "FK_CourierSettlementOrders_CourierSettlements_SettlementId",
                        column: x => x.SettlementId,
                        principalTable: "CourierSettlements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourierSettlementOrders_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    SpentOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Source = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    SettlementId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoidedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    VoidReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.CheckConstraint("CK_Expenses_Amount", "[Amount] > 0");
                    table.ForeignKey(
                        name: "FK_Expenses_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_CourierSettlements_SettlementId",
                        column: x => x.SettlementId,
                        principalTable: "CourierSettlements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_ExpenseCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ExpenseCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_SettlementId",
                table: "Payments",
                column: "SettlementId",
                filter: "[SettlementId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CourierSettlementOrders_OrderId",
                table: "CourierSettlementOrders",
                column: "OrderId",
                unique: true,
                filter: "[IsReversed] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_CourierSettlementOrders_SettlementId",
                table: "CourierSettlementOrders",
                column: "SettlementId");

            migrationBuilder.CreateIndex(
                name: "IX_CourierSettlements_BusinessId_OperationId",
                table: "CourierSettlements",
                columns: new[] { "BusinessId", "OperationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourierSettlements_BusinessId_SettledOn",
                table: "CourierSettlements",
                columns: new[] { "BusinessId", "SettledOn" });

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_BusinessId_Code",
                table: "ExpenseCategories",
                columns: new[] { "BusinessId", "Code" },
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_BusinessId_Name",
                table: "ExpenseCategories",
                columns: new[] { "BusinessId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BusinessId_OperationId",
                table: "Expenses",
                columns: new[] { "BusinessId", "OperationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BusinessId_SpentOn",
                table: "Expenses",
                columns: new[] { "BusinessId", "SpentOn" });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_CategoryId",
                table: "Expenses",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_SettlementId",
                table: "Expenses",
                column: "SettlementId",
                unique: true,
                filter: "[SettlementId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_CourierSettlements_SettlementId",
                table: "Payments",
                column: "SettlementId",
                principalTable: "CourierSettlements",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_CourierSettlements_SettlementId",
                table: "Payments");

            migrationBuilder.DropTable(
                name: "CourierSettlementOrders");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "CourierSettlements");

            migrationBuilder.DropTable(
                name: "ExpenseCategories");

            migrationBuilder.DropIndex(
                name: "IX_Payments_SettlementId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "SettlementId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "CourierCompanyName",
                table: "Businesses");
        }
    }
}
