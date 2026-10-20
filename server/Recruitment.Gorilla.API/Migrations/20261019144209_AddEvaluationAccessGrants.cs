using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationAccessGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluationAccessGrants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    CandidateId = table.Column<int>(type: "int", nullable: false),
                    InterviewId = table.Column<int>(type: "int", nullable: true),
                    GranteeUserId = table.Column<int>(type: "int", nullable: false),
                    GrantedByUserId = table.Column<int>(type: "int", nullable: true),
                    Source = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedForInterviewId = table.Column<int>(type: "int", nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    RevokedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationAccessGrants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Interviews_CreatedForInterviewId",
                        column: x => x.CreatedForInterviewId,
                        principalTable: "Interviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Interviews_InterviewId",
                        column: x => x.InterviewId,
                        principalTable: "Interviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Users_GrantedByUserId",
                        column: x => x.GrantedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Users_GranteeUserId",
                        column: x => x.GranteeUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationAccessGrants_Users_RevokedByUserId",
                        column: x => x.RevokedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_CandidateId",
                table: "EvaluationAccessGrants",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_CreatedForInterviewId",
                table: "EvaluationAccessGrants",
                column: "CreatedForInterviewId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_GrantedByUserId",
                table: "EvaluationAccessGrants",
                column: "GrantedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_GranteeUserId_RevokedAt",
                table: "EvaluationAccessGrants",
                columns: new[] { "GranteeUserId", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_InterviewId",
                table: "EvaluationAccessGrants",
                column: "InterviewId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAccessGrants_RevokedByUserId",
                table: "EvaluationAccessGrants",
                column: "RevokedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationAccessGrants");
        }
    }
}
