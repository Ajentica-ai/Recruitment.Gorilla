using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recruitment.Gorilla.API.Migrations
{
    /// <inheritdoc />
    public partial class AddInterviewShareEarlierRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShareEarlierRoundsWithPanel",
                table: "Interviews",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Without the column nothing manages the automatic grants any more, so end them rather than
            // leave read access behind that no panel change or cancel can ever revoke.
            migrationBuilder.Sql(
                "UPDATE `EvaluationAccessGrants` SET `RevokedAt` = UTC_TIMESTAMP() " +
                "WHERE `Source` = 'PanelAutoShare' AND `RevokedAt` IS NULL;");

            migrationBuilder.DropColumn(
                name: "ShareEarlierRoundsWithPanel",
                table: "Interviews");
        }
    }
}
