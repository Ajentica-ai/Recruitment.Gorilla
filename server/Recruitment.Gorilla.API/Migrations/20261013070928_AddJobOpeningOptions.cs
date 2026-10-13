using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobOpeningOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "JobOpeningOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Kind = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobOpeningOptions", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.InsertData(
                table: "JobOpeningOptions",
                columns: new[] { "Id", "CreatedAt", "IsActive", "Kind", "Name", "SortOrder", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Location", "Remote", 1, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Location", "Office", 2, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Location", "Hybrid", 3, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 4, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Location", "Contractual", 4, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 5, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Department", "Engineering", 1, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 6, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Department", "Admin", 2, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 7, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Department", "HR", 3, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 8, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Priority", "High", 1, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 9, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Priority", "Medium", 2, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 10, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc), true, "Priority", "Low", 3, new DateTime(2026, 10, 13, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_JobOpeningOptions_Kind_Name",
                table: "JobOpeningOptions",
                columns: new[] { "Kind", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "JobOpeningOptions");
        }
    }
}
