using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCvFileHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileHash",
                table: "CVFiles",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FileHash",
                table: "CandidateDrafts",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CVFiles_FileHash",
                table: "CVFiles",
                column: "FileHash");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateDrafts_FileHash",
                table: "CandidateDrafts",
                column: "FileHash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CVFiles_FileHash",
                table: "CVFiles");

            migrationBuilder.DropIndex(
                name: "IX_CandidateDrafts_FileHash",
                table: "CandidateDrafts");

            migrationBuilder.DropColumn(
                name: "FileHash",
                table: "CVFiles");

            migrationBuilder.DropColumn(
                name: "FileHash",
                table: "CandidateDrafts");
        }
    }
}
