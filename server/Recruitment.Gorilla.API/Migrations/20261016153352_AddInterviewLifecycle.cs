using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddInterviewLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CalendarSequence",
                table: "Interviews",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Interviews",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Interviews",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Scheduled")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Interviews",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedByUserId",
                table: "Interviews",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InterviewEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    InterviewId = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PreviousScheduledAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    NewScheduledAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    ActorName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewEvents_Interviews_InterviewId",
                        column: x => x.InterviewId,
                        principalTable: "Interviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterviewEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.InsertData(
                table: "StatusTransitions",
                columns: new[] { "Id", "FromStatusOptionId", "IsActive", "SortOrder", "ToStatusOptionId" },
                values: new object[] { 50, 3, true, 4, 2 });

            migrationBuilder.CreateIndex(
                name: "IX_Interviews_UpdatedByUserId",
                table: "Interviews",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewEvents_ActorUserId",
                table: "InterviewEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewEvents_InterviewId_CreatedAt",
                table: "InterviewEvents",
                columns: new[] { "InterviewId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Interviews_Users_UpdatedByUserId",
                table: "Interviews",
                column: "UpdatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Interviews_Users_UpdatedByUserId",
                table: "Interviews");

            migrationBuilder.DropTable(
                name: "InterviewEvents");

            migrationBuilder.DropIndex(
                name: "IX_Interviews_UpdatedByUserId",
                table: "Interviews");

            migrationBuilder.DeleteData(
                table: "StatusTransitions",
                keyColumn: "Id",
                keyValue: 50);

            migrationBuilder.DropColumn(
                name: "CalendarSequence",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "UpdatedByUserId",
                table: "Interviews");
        }
    }
}
