using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// #327 end to end through the services: with only the localhost default configured (as in production), the
/// "View interview" link and the calendar links in the interview emails follow the browser's origin.
/// </summary>
public class NotificationLinkOriginTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Origin = "https://recruitment.example.com";

    private async Task<(Candidate Candidate, User Interviewer)> ReadyToBookAsync()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(status: "Call for Interview");
        var tracked = await Db.Candidates.Include(c => c.StatusHistories).FirstAsync(c => c.Id == candidate.Id);
        tracked.CreatedAt = DateTime.UtcNow.AddDays(-30);
        tracked.StatusHistories.First().ChangedAt = DateTime.UtcNow.AddDays(-20);
        await Db.SaveChangesAsync();
        return (candidate, interviewer);
    }

    private async Task<string> EmailTo(User user) =>
        (await Db.OutboundEmails.AsNoTracking().Where(e => e.ToEmail == user.Email).OrderByDescending(e => e.Id).FirstAsync())
        .HtmlBody;

    [Fact]
    public async Task The_interview_assigned_email_links_to_the_browser_origin()
    {
        var (candidate, interviewer) = await ReadyToBookAsync();

        var request = PublicLinks.UseRequestOrigin(Origin);
        var entry = await Candidates().AddStatusAsync(candidate.Id,
            new StatusChangeDto("Interview Scheduled", null, null, null, DateTime.UtcNow.AddDays(3), [interviewer.Id], null),
            "Rhonda Recruiter", null);
        request.Dispose();

        var html = await EmailTo(interviewer);
        Assert.Contains($"{Origin}/interviews/{entry!.InterviewId}", html);
        Assert.DoesNotContain("localhost", html);
    }

    [Fact]
    public async Task The_rescheduled_email_links_to_the_browser_origin()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var actor = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(status: "Interview Scheduled", priorStatuses: "Call for Interview");
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        using (PublicLinks.UseRequestOrigin(Origin))
        {
            var (_, error, _, _) = await Interviews().RescheduleAsync(interview.Id,
                new RescheduleInterviewDto(DateTime.UtcNow.AddDays(5), 45, null, [interviewer.Id], null, null),
                null, actor.Id, actor.Name, canBackdate: false);
            Assert.Null(error);
        }

        var html = await EmailTo(interviewer);
        Assert.Contains($"{Origin}/interviews/{interview.Id}", html);
        Assert.DoesNotContain("localhost", html);
    }
}
