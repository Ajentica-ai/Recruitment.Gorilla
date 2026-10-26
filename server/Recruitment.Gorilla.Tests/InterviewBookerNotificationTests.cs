using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The booker's "Interview moved" notification links to the candidate only while the booker can still open that
/// page (#198). Before, it always did, so a recruiter taken off the job opening got a link to a 404 page.
/// </summary>
public class InterviewBookerNotificationTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<Notification> MoveAndGetBookerNoticeAsync(User booker, Candidate candidate)
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var actor = Data.AddUser(Roles.Admin);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.CreatedByUserId = booker.Id;
        await Db.SaveChangesAsync();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id,
            new RescheduleInterviewDto(DateTime.UtcNow.AddDays(5), 45, null, [interviewer.Id], null, "moved"),
            null, actor.Id, actor.Name);
        Assert.Null(error);

        return await Db.Notifications.AsNoTracking().SingleAsync(n => n.UserId == booker.Id && n.Title == "Interview moved");
    }

    [Fact]
    public async Task A_booker_who_owns_the_candidate_gets_the_link()
    {
        var booker = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: booker.Id, status: "Interview Scheduled");

        var notice = await MoveAndGetBookerNoticeAsync(booker, candidate);

        Assert.Equal($"/candidates/{candidate.Id}", notice.LinkUrl);
    }

    [Fact]
    public async Task A_booker_assigned_to_the_job_opening_gets_the_link()
    {
        var booker = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(null, null, booker.Id);
        var candidate = Data.AddCandidate(roleId: role.Id, status: "Interview Scheduled");

        var notice = await MoveAndGetBookerNoticeAsync(booker, candidate);

        Assert.Equal($"/candidates/{candidate.Id}", notice.LinkUrl);
    }

    [Fact]
    public async Task An_admin_booker_gets_the_link_for_any_candidate()
    {
        var booker = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(status: "Interview Scheduled");

        var notice = await MoveAndGetBookerNoticeAsync(booker, candidate);

        Assert.Equal($"/candidates/{candidate.Id}", notice.LinkUrl);
    }

    [Fact]
    public async Task A_booker_who_can_no_longer_see_the_candidate_is_still_told_but_gets_no_link()
    {
        // Booked it, then lost access: not the owner, and no longer assigned to the job opening.
        var booker = Data.AddUser(Roles.Recruiter);
        var otherRecruiter = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(null, null, otherRecruiter.Id);
        var candidate = Data.AddCandidate(ownerUserId: otherRecruiter.Id, roleId: role.Id, status: "Interview Scheduled");

        var notice = await MoveAndGetBookerNoticeAsync(booker, candidate);

        Assert.Null(notice.LinkUrl);
    }

    [Fact]
    public async Task A_deactivated_booker_gets_no_link()
    {
        var booker = Data.AddUser(Roles.Admin, active: false);
        var candidate = Data.AddCandidate(status: "Interview Scheduled");

        var notice = await MoveAndGetBookerNoticeAsync(booker, candidate);

        Assert.Null(notice.LinkUrl);
    }
}
