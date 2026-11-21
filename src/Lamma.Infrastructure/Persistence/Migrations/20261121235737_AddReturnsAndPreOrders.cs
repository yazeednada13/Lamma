using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lamma.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReturnsAndPreOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_PaymentAllocations_Amount",
                table: "PaymentAllocations");

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Payments",
                type: "varchar(32)",
                unicode: false,
                maxLength: 32,
                nullable: false,
                defaultValue: "payment");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExpectedDeliveryOn",
                table: "Orders",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "ExpectedDeliveryTime",
                table: "Orders",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReturnedAmount",
                table: "Orders",
                type: "decimal(19,3)",
                precision: 19,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "OrderReturns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReturnedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(19,3)", precision: 19, scale: 3, nullable: false),
                    RefundPaymentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderReturns", x => x.Id);
                    table.CheckConstraint("CK_OrderReturns_Amount", "[Amount] >= 0");
                    table.ForeignKey(
                        name: "FK_OrderReturns_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderReturns_Payments_RefundPaymentId",
                        column: x => x.RefundPaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrderReturnLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReturnId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Restocked = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderReturnLines", x => x.Id);
                    table.CheckConstraint("CK_OrderReturnLines_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_OrderReturnLines_OrderItems_OrderItemId",
                        column: x => x.OrderItemId,
                        principalTable: "OrderItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderReturnLines_OrderReturns_ReturnId",
                        column: x => x.ReturnId,
                        principalTable: "OrderReturns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_PaymentAllocations_Amount",
                table: "PaymentAllocations",
                sql: "[Amount] <> 0");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BusinessId_ExpectedDeliveryOn",
                table: "Orders",
                columns: new[] { "BusinessId", "ExpectedDeliveryOn" },
                filter: "[ExpectedDeliveryOn] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_ReturnedAmount",
                table: "Orders",
                sql: "[ReturnedAmount] >= 0 AND [ReturnedAmount] <= [Total]");

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturnLines_OrderItemId",
                table: "OrderReturnLines",
                column: "OrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturnLines_ReturnId",
                table: "OrderReturnLines",
                column: "ReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturns_BusinessId_OperationId",
                table: "OrderReturns",
                columns: new[] { "BusinessId", "OperationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturns_BusinessId_ReturnedOn",
                table: "OrderReturns",
                columns: new[] { "BusinessId", "ReturnedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturns_OrderId",
                table: "OrderReturns",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderReturns_RefundPaymentId",
                table: "OrderReturns",
                column: "RefundPaymentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderReturnLines");

            migrationBuilder.DropTable(
                name: "OrderReturns");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PaymentAllocations_Amount",
                table: "PaymentAllocations");

            migrationBuilder.DropIndex(
                name: "IX_Orders_BusinessId_ExpectedDeliveryOn",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_ReturnedAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ExpectedDeliveryOn",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExpectedDeliveryTime",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ReturnedAmount",
                table: "Orders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PaymentAllocations_Amount",
                table: "PaymentAllocations",
                sql: "[Amount] > 0");
        }
    }
}
