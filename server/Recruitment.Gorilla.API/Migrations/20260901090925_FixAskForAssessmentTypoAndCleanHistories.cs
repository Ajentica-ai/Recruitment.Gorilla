using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class FixAskForAssessmentTypoAndCleanHistories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "StatusOptions",
                keyColumn: "Id",
                keyValue: 14,
                column: "Name",
                value: "Ask for Assessment");

            migrationBuilder.Sql("UPDATE Candidates SET CurrentStatus = 'Ask for Assessment' WHERE CurrentStatus = 'Ask for Assesment';");
            migrationBuilder.Sql("UPDATE StatusHistories SET Status = 'Ask for Assessment' WHERE Status = 'Ask for Assesment';");

            // Clean up any test status history rows logged after candidate #1 reached Hired status
            migrationBuilder.Sql(@"
                DELETE FROM StatusHistories 
                WHERE CandidateId = 1 
                  AND ChangedAt > (
                      SELECT min_hired FROM (
                          SELECT MIN(ChangedAt) as min_hired 
                          FROM StatusHistories 
                          WHERE CandidateId = 1 AND Status = 'Hired'
                      ) as temp
                  );
            ");

            // Ensure Candidate #1 CurrentStatus is set to Hired
            migrationBuilder.Sql(@"
                UPDATE Candidates 
                SET CurrentStatus = 'Hired' 
                WHERE Id = 1 AND EXISTS (
                    SELECT 1 FROM StatusHistories WHERE CandidateId = 1 AND Status = 'Hired'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "StatusOptions",
                keyColumn: "Id",
                keyValue: 14,
                column: "Name",
                value: "Ask for Assesment");

            migrationBuilder.Sql("UPDATE Candidates SET CurrentStatus = 'Ask for Assesment' WHERE CurrentStatus = 'Ask for Assessment';");
            migrationBuilder.Sql("UPDATE StatusHistories SET Status = 'Ask for Assesment' WHERE Status = 'Ask for Assessment';");
        }
    }
}
