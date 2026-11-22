using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lamma.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSignupLeads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SignupLeads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PhoneE164 = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    StoreName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UtmSource = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UtmMedium = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UtmCampaign = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    InviteTokenHash = table.Column<string>(type: "char(64)", unicode: false, fixedLength: true, maxLength: 64, nullable: true),
                    InviteExpiresAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    SendCount = table.Column<int>(type: "int", nullable: false),
                    SendWindowStartedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    SendsInWindow = table.Column<int>(type: "int", nullable: false),
                    LastSentAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignupLeads", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SignupLeads_InviteTokenHash",
                table: "SignupLeads",
                column: "InviteTokenHash",
                filter: "[InviteTokenHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SignupLeads_Status_CreatedAt",
                table: "SignupLeads",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_SignupLeads_NormalizedEmail",
                table: "SignupLeads",
                column: "NormalizedEmail",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SignupLeads");
        }
    }
}
