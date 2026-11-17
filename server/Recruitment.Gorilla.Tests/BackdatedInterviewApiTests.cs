using System.Net;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// #263 at the HTTP boundary: which roles may reschedule an interview into the past. The service tests cover what
/// happens once allowed; this covers who is allowed.
/// </summary>
[Collection(ApiCollection.Name)]
public class BackdatedInterviewApiTests(ApiFixture fx)
{
    private async Task<int> InterviewAsync()
    {
        // Owned by the recruiter so the recruiter's write scope covers it; at Interview Scheduled so it can move.
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId, fx.RoleId, status: "Interview Scheduled");
        await fx.AgeCandidateAsync(candidateId, DateTime.UtcNow.AddDays(-30));
        return await fx.NewInterviewAsync(candidateId, fx.InterviewerId);
    }

    private object Body(DateTime at, string? reason) => new
    {
        scheduledAt = at,
        durationMinutes = 45,
        interviewerUserIds = new[] { fx.InterviewerId },
        reason,
    };

    private async Task<HttpResponseMessage> PutAsync(string email, int interviewId, DateTime at, string? reason)
    {
        var token = await fx.LoginAsync(email);
        return await fx.SendAsync(HttpMethod.Put, $"/api/interviews/{interviewId}", token, Body(at, reason));
    }

    [Fact]
    public async Task A_recruiter_can_move_an_interview_into_the_past_with_a_reason()
    {
        var id = await InterviewAsync();
        var resp = await PutAsync(fx.RecruiterEmail, id, DateTime.UtcNow.AddDays(-3), "It took place on Monday");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task A_super_admin_can_move_an_interview_into_the_past_with_a_reason()
    {
        var id = await InterviewAsync();
        var resp = await PutAsync(fx.SuperAdminEmail, id, DateTime.UtcNow.AddDays(-3), "It took place on Monday");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task A_past_time_without_a_reason_is_a_400()
    {
        var id = await InterviewAsync();
        var resp = await PutAsync(fx.RecruiterEmail, id, DateTime.UtcNow.AddDays(-3), null);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("reason", await resp.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task An_admin_still_gets_a_400_for_a_past_time()
    {
        var id = await InterviewAsync();
        var resp = await PutAsync(fx.AdminEmail, id, DateTime.UtcNow.AddDays(-3), "It took place on Monday");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("future", await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_interviewer_cannot_reschedule_at_all()
    {
        var id = await InterviewAsync();
        var resp = await PutAsync(fx.InterviewerEmail, id, DateTime.UtcNow.AddDays(3), "moved");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task A_past_booking_through_add_status_follows_the_same_roles()
    {
        // Candidate at Call for Interview, added long ago.
        async Task<int> Candidate()
        {
            var cid = await fx.NewCandidateAsync(fx.RecruiterId, fx.RoleId, status: "Call for Interview");
            await fx.AgeCandidateAsync(cid, DateTime.UtcNow.AddDays(-30));
            return cid;
        }

        object Booking(string? comment) => new
        {
            status = "Interview Scheduled",
            comment,
            interviewAt = DateTime.UtcNow.AddDays(-3),
            interviewerUserIds = new[] { fx.InterviewerId },
        };

        var recruiter = await fx.LoginAsync(fx.RecruiterEmail);
        var admin = await fx.LoginAsync(fx.AdminEmail);

        var adminResp = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{await Candidate()}/status", admin, Booking("Held by phone"));
        Assert.Equal(HttpStatusCode.BadRequest, adminResp.StatusCode);

        var noReason = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{await Candidate()}/status", recruiter, Booking(null));
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);

        var ok = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{await Candidate()}/status", recruiter, Booking("Held by phone"));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
    }
}
