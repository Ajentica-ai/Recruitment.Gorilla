using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The evaluation report names the criteria its ratings were given on (#190), so a report on a custom rubric
/// shows those ratings and their averages instead of the 12 built-in criteria as empty. The criteria are the
/// candidate's current rubric, plus any rated key that rubric does not know under "Other criteria".
/// </summary>
public class ReportCriteriaTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<(Candidate Candidate, Interview Interview, User Interviewer, EvaluationRubricDto Rubric)> CustomSetup()
    {
        var admin = Data.AddUser(Roles.Admin);
        var (rubric, error, _) = await EvaluationRubrics().CreateAsync(new UpsertEvaluationRubricDto(
            "QA rubric", "custom", false, true,
            [
                new(null, "Testing", "AutomationSkills", "Test Automation", null, 1.0, 1),
                new(null, "Testing", "ManualStrategy", "Manual Test Strategy", null, 1.0, 2),
                new(null, "Process", "Collaboration", "Collaboration", null, 1.0, 3),
            ]), admin.Id);
        Assert.NotNull(rubric);
        Assert.Null(error);

        var role = Data.AddRole($"QA-{Guid.NewGuid():N}");
        role.EvaluationRubricId = rubric!.Id;
        Db.SaveChanges();
        var candidate = Data.AddCandidate(roleId: role.Id);
        // The rubric lookup still matches the legacy text on this branch; PR #215 moves it to the opening link.
        candidate.AppliedRole = role.Name;
        Db.SaveChanges();
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        return (candidate, interview, interviewer, rubric);
    }

    private void SubmittedOn(Interview interview, User interviewer, params (string Key, int? Rating, string? Comment)[] items)
    {
        Db.InterviewEvaluations.Add(new InterviewEvaluation
        {
            InterviewId = interview.Id, InterviewerUserId = interviewer.Id, IsSubmitted = true, SubmittedAt = DateTime.UtcNow,
            OverallRating = 4, Recommendation = "Recommended",
            Items = items.Select(i => new InterviewEvaluationItem { CriterionKey = i.Key, Rating = i.Rating, Comment = i.Comment }).ToList(),
        });
        Db.SaveChanges();
    }

    [Fact]
    public async Task A_custom_rubric_report_names_its_criteria_and_averages_every_rated_one()
    {
        var s = await CustomSetup();
        SubmittedOn(s.Interview, s.Interviewer, ("AutomationSkills", 5, "Strong"), ("ManualStrategy", 3, null), ("Collaboration", 4, null));

        var report = await Interviews().GetCandidateEvaluationReportAsync(s.Candidate.Id, null);

        Assert.Equal(
            ["AutomationSkills", "ManualStrategy", "Collaboration"],
            report!.Criteria!.Select(c => c.Key).ToList());
        var first = report.Criteria![0];
        Assert.Equal("Test Automation", first.Label);
        Assert.Equal("Testing", first.Section);
        Assert.Equal("Process", report.Criteria[2].Section);

        // Averages are no longer limited to the built-in keys, and follow the rubric's order.
        Assert.Equal(["AutomationSkills", "ManualStrategy", "Collaboration"], report.Summary.CriterionAverages.Select(a => a.CriterionKey).ToList());
        Assert.Equal(5, report.Summary.CriterionAverages[0].Average);
        Assert.Equal(3, report.Summary.CriterionAverages[1].Average);
    }

    [Fact]
    public async Task A_rated_key_the_rubric_does_not_know_is_listed_under_other_criteria_with_its_key_as_label()
    {
        var s = await CustomSetup();
        SubmittedOn(s.Interview, s.Interviewer, ("AutomationSkills", 4, null), ("RetiredCriterion", 2, "Was on an older rubric"));

        var report = await Interviews().GetCandidateEvaluationReportAsync(s.Candidate.Id, null);

        var other = Assert.Single(report!.Criteria!, c => c.Key == "RetiredCriterion");
        Assert.Equal("Other criteria", other.Section);
        Assert.Equal("RetiredCriterion", other.Label);
        Assert.Contains(report.Summary.CriterionAverages, a => a.CriterionKey == "RetiredCriterion" && a.Average == 2);
    }

    [Fact]
    public async Task A_report_on_the_default_rubric_keeps_its_built_in_criteria_and_order()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id, overallRating: 4);

        var report = await Interviews().GetCandidateEvaluationReportAsync(candidate.Id, null);

        // Every built-in key carries a label and none is mislabelled as "Other criteria".
        Assert.NotEmpty(report!.Criteria!);
        Assert.DoesNotContain(report.Criteria!, c => c.Section == "Other criteria");
        Assert.Equal(EvaluationCriteria.Keys.Count, report.Summary.CriterionAverages.Count);
        Assert.All(report.Summary.CriterionAverages, a => Assert.Equal(4, a.Average));
    }

    [Fact]
    public async Task The_filtered_report_used_by_the_shared_view_carries_the_criteria_too()
    {
        var s = await CustomSetup();
        SubmittedOn(s.Interview, s.Interviewer, ("AutomationSkills", 5, null));

        var report = await Interviews().GetCandidateEvaluationReportAsync(s.Candidate.Id, null, [s.Interview.Id]);

        Assert.Contains(report!.Criteria!, c => c.Key == "AutomationSkills" && c.Label == "Test Automation");
        Assert.Contains(report.Summary.CriterionAverages, a => a.CriterionKey == "AutomationSkills");
    }
}
