using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

public class AnalyticsServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    [Fact]
    public async Task Empty_database_returns_valid_zero_filled_summary()
    {
        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d"));
        Assert.NotNull(summary);
        Assert.Equal(0, summary.TotalCandidatesInPeriod);
        Assert.Equal(0, summary.ActiveCandidates);
        Assert.Equal(0, summary.TimeToHire.TotalHires);
        Assert.Equal(0, summary.TimeToHire.AverageDays);
        Assert.NotEmpty(summary.FunnelStages);
        Assert.Equal(5, summary.FunnelStages.Count);
        Assert.All(summary.FunnelStages, f => Assert.Equal(0, f.TotalEntered));
    }

    [Fact]
    public async Task Time_to_hire_and_funnel_computes_correctly()
    {
        var recruiter = Data.AddUser("Recruiter", name: "Sarah Connor");
        var role = Data.AddRole();
        var source = Db.CandidateSourceOptions.First(s => s.Name == "LinkedIn");

        // Candidate 1: Uploaded 20 days ago -> Hired 5 days ago (15 days to hire)
        var c1 = new Candidate
        {
            FullName = "Jane Doe",
            Email = "jane.doe@test.local",
            RelevantExperience = "5 years",
            OwnerUserId = recruiter.Id,
            RoleAppliedOptionId = role.Id,
            SourceOptionId = source.Id,
            CurrentStatus = "Hired",
            CreatedAt = DateTime.UtcNow.AddDays(-20),
            StatusHistories =
            [
                new StatusHistory { Status = "Uploaded", ChangedAt = DateTime.UtcNow.AddDays(-20), ChangedBy = "system" },
                new StatusHistory { Status = "Technical Assessment", ChangedAt = DateTime.UtcNow.AddDays(-16), ChangedBy = recruiter.Name },
                new StatusHistory { Status = "Interview Scheduled", ChangedAt = DateTime.UtcNow.AddDays(-10), ChangedBy = recruiter.Name },
                new StatusHistory { Status = "Offer Extended", ChangedAt = DateTime.UtcNow.AddDays(-7), ChangedBy = recruiter.Name },
                new StatusHistory { Status = "Hired", ChangedAt = DateTime.UtcNow.AddDays(-5), ChangedBy = recruiter.Name }
            ]
        };

        // Candidate 2: In process (Interview Scheduled)
        var c2 = new Candidate
        {
            FullName = "John Smith",
            Email = "john.smith@test.local",
            RelevantExperience = "3 years",
            OwnerUserId = recruiter.Id,
            RoleAppliedOptionId = role.Id,
            SourceOptionId = source.Id,
            CurrentStatus = "Interview Scheduled",
            CreatedAt = DateTime.UtcNow.AddDays(-8),
            StatusHistories =
            [
                new StatusHistory { Status = "Uploaded", ChangedAt = DateTime.UtcNow.AddDays(-8), ChangedBy = "system" },
                new StatusHistory { Status = "Interview Scheduled", ChangedAt = DateTime.UtcNow.AddDays(-4), ChangedBy = recruiter.Name }
            ]
        };

        // Candidate 3: Rejected at Assessment
        var c3 = new Candidate
        {
            FullName = "Alex Morgan",
            Email = "alex.morgan@test.local",
            RelevantExperience = "2 years",
            OwnerUserId = recruiter.Id,
            RoleAppliedOptionId = role.Id,
            SourceOptionId = source.Id,
            CurrentStatus = "Reject",
            CreatedAt = DateTime.UtcNow.AddDays(-12),
            StatusHistories =
            [
                new StatusHistory { Status = "Uploaded", ChangedAt = DateTime.UtcNow.AddDays(-12), ChangedBy = "system" },
                new StatusHistory { Status = "Technical Assessment", ChangedAt = DateTime.UtcNow.AddDays(-9), ChangedBy = recruiter.Name },
                new StatusHistory { Status = "Reject", ChangedAt = DateTime.UtcNow.AddDays(-6), ChangedBy = recruiter.Name }
            ]
        };

        Db.Candidates.AddRange(c1, c2, c3);
        await Db.SaveChangesAsync();

        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d"));
        Assert.NotNull(summary);
        Assert.Equal(3, summary.TotalCandidatesInPeriod);
        Assert.Equal(1, summary.ActiveCandidates); // c2 is active

        // Time to hire
        Assert.Equal(1, summary.TimeToHire.TotalHires);
        Assert.True(summary.TimeToHire.AverageDays >= 14 && summary.TimeToHire.AverageDays <= 16);

        // Funnel checks:
        // Applied: 3
        // Assessment: 2 (c1, c3)
        // Interview: 2 (c1, c2)
        // Offer: 1 (c1)
        // Hired: 1 (c1)
        var appliedStage = summary.FunnelStages.Single(f => f.StageKey == "Applied");
        Assert.Equal(3, appliedStage.TotalEntered);
        Assert.Equal(100.0, appliedStage.ConversionFromStartPercent);

        var hiredStage = summary.FunnelStages.Single(f => f.StageKey == "Hired");
        Assert.Equal(1, hiredStage.TotalEntered);
        Assert.Equal(33.3, hiredStage.ConversionFromStartPercent);

        // Sourcing performance check
        var linkedInSource = summary.SourcingChannels.Single(s => s.SourceName == "LinkedIn");
        Assert.Equal(3, linkedInSource.TotalApplicants);
        Assert.Equal(1, linkedInSource.HiredCount);
        Assert.Equal(33.3, linkedInSource.ConversionToHirePercent);

        // Recruiter workload check
        var recruiterWorkload = summary.RecruiterWorkloads.Single(r => r.RecruiterUserId == recruiter.Id);
        Assert.Equal(1, recruiterWorkload.ActiveCandidates);
        Assert.Equal(3, recruiterWorkload.TotalAssigned);
        Assert.Equal(1, recruiterWorkload.HiresMade);
        Assert.True(recruiterWorkload.TransitionsLogged >= 4);
    }

    [Fact]
    public async Task Role_filter_scopes_analytics_to_specific_job_opening()
    {
        var role1 = Data.AddRole();
        var role2 = Data.AddRole();

        var c1 = Data.AddCandidate(roleId: role1.Id, status: "Uploaded");
        var c2 = Data.AddCandidate(roleId: role2.Id, status: "Uploaded");

        var summaryRole1 = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d", RoleId: role1.Id));
        Assert.Equal(1, summaryRole1.TotalCandidatesInPeriod);

        var summaryRole2 = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d", RoleId: role2.Id));
        Assert.Equal(1, summaryRole2.TotalCandidatesInPeriod);
    }

    [Fact]
    public async Task Workload_counts_only_activity_on_the_scoped_recruiters_candidates()
    {
        var recruiter = Data.AddUser("Recruiter");
        var colleague = Data.AddUser("Recruiter");
        var ownRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var otherRole = Data.AddRole(recruiterUserIds: colleague.Id);

        var inScope = Data.AddCandidate(roleId: ownRole.Id);
        var outOfScope = Data.AddCandidate(roleId: otherRole.Id);
        Db.StatusHistories.AddRange(
            new StatusHistory { CandidateId = inScope.Id, Status = "Technical Assessment", ChangedBy = colleague.Name },
            new StatusHistory { CandidateId = outOfScope.Id, Status = "Technical Assessment", ChangedBy = colleague.Name });
        await Db.SaveChangesAsync();
        Data.AddInterview(inScope.Id, colleague.Id);
        Data.AddInterview(outOfScope.Id, colleague.Id);

        var scoped = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d"), recruiter.Id);
        var scopedRow = scoped.RecruiterWorkloads.Single(r => r.RecruiterUserId == colleague.Id);
        Assert.Equal(1, scopedRow.TransitionsLogged);
        Assert.Equal(1, scopedRow.InterviewsParticipated);

        var admin = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d"));
        var adminRow = admin.RecruiterWorkloads.Single(r => r.RecruiterUserId == colleague.Id);
        Assert.Equal(2, adminRow.TransitionsLogged);
        Assert.Equal(2, adminRow.InterviewsParticipated);
    }

    [Fact]
    public async Task Recruiter_with_no_candidates_sees_no_colleague_activity()
    {
        var recruiter = Data.AddUser("Recruiter");
        var colleague = Data.AddUser("Recruiter");
        var otherRole = Data.AddRole(recruiterUserIds: colleague.Id);
        var candidate = Data.AddCandidate(roleId: otherRole.Id);
        Db.StatusHistories.Add(new StatusHistory { CandidateId = candidate.Id, Status = "Technical Assessment", ChangedBy = colleague.Name });
        await Db.SaveChangesAsync();
        Data.AddInterview(candidate.Id, colleague.Id);

        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("all"), recruiter.Id);

        Assert.Equal(0, summary.TotalCandidatesInPeriod);
        Assert.All(summary.RecruiterWorkloads, r =>
        {
            Assert.Equal(0, r.TransitionsLogged);
            Assert.Equal(0, r.InterviewsParticipated);
        });
    }

    [Fact]
    public async Task Role_filter_narrows_a_recruiters_scope_instead_of_replacing_it()
    {
        var recruiter = Data.AddUser("Recruiter");
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var unassignedRole = Data.AddRole();

        Data.AddCandidate(roleId: assignedRole.Id);
        Data.AddCandidate(roleId: unassignedRole.Id);
        Data.AddCandidate(roleId: unassignedRole.Id);
        Data.AddCandidate(ownerUserId: recruiter.Id, roleId: unassignedRole.Id);

        var assigned = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d", RoleId: assignedRole.Id), recruiter.Id);
        Assert.Equal(1, assigned.TotalCandidatesInPeriod);

        // Only the candidate the recruiter owns; the other two in this role are out of scope.
        var unassigned = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d", RoleId: unassignedRole.Id), recruiter.Id);
        Assert.Equal(1, unassigned.TotalCandidatesInPeriod);

        var admin = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery("30d", RoleId: unassignedRole.Id));
        Assert.Equal(3, admin.TotalCandidatesInPeriod);
    }
}
