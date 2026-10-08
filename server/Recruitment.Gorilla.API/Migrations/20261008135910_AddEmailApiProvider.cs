using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailApiProvider : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedRecipientDomains",
                table: "EmailSettings",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ApiBaseUrl",
                table: "EmailSettings",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ApiKeyEncrypted",
                table: "EmailSettings",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "EmailSettings",
                type: "varchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Smtp")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowedRecipientDomains",
                table: "EmailSettings");

            migrationBuilder.DropColumn(
                name: "ApiBaseUrl",
                table: "EmailSettings");

            migrationBuilder.DropColumn(
                name: "ApiKeyEncrypted",
                table: "EmailSettings");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "EmailSettings");
        }
    }
}
