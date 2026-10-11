using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.Tests.Infrastructure;

/// <summary>Builders that insert minimal, valid rows so tests read clearly. All persist immediately
/// (within the test's transaction) and return the created entity.</summary>
public sealed class TestData(AppDbContext db)
{
    public User AddUser(string role, bool active = true, string? name = null)
    {
        var user = new User
        {
            Name = name ?? $"User-{Guid.NewGuid():N}",
            Email = $"{Guid.NewGuid():N}@test.local",
            PasswordHash = "x",
            IsActive = active,
            Roles = [new UserRole { Role = role }],
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    public RoleAppliedOption AddRole(string? name = null, DateTime? endDate = null, params int[] recruiterUserIds)
    {
        var role = new RoleAppliedOption
        {
            Name = name ?? $"Role-{Guid.NewGuid():N}",
            SortOrder = 100,
            IsActive = true,
            EndDate = endDate ?? DateTime.UtcNow.AddDays(30),
            Recruiters = recruiterUserIds.Distinct()
                .Select(uid => new RoleRecruiter { UserId = uid }).ToList(),
        };
        db.RoleAppliedOptions.Add(role);
        db.SaveChanges();
        return role;
    }

    public SkillOption AddSkill(string? name = null)
    {
        var skill = new SkillOption { Name = name ?? $"Skill-{Guid.NewGuid():N}", SortOrder = 100, IsActive = true };
        db.SkillOptions.Add(skill);
        db.SaveChanges();
        return skill;
    }

    /// <summary>Creates a candidate at <paramref name="status"/>, plus a StatusHistory row for each of
    /// <paramref name="priorStatuses"/> and the current status (so HasStatus checks work).</summary>
    public Candidate AddCandidate(
        int? ownerUserId = null, int? roleId = null, string status = "Uploaded",
        string? phone = null, bool isReferred = false, List<int>? skillIds = null, string? email = null,
        params string[] priorStatuses)
    {
        var candidate = new Candidate
        {
            FullName = $"Cand-{Guid.NewGuid():N}",
            Email = email ?? $"{Guid.NewGuid():N}@test.local",
            RelevantExperience = "3 Years",
            OwnerUserId = ownerUserId,
            RoleAppliedOptionId = roleId,
            CurrentStatus = status,
            Phone = phone,
            IsReferred = isReferred,
            ReferenceName = isReferred ? "Ref Name" : null,
            ReferenceEmail = isReferred ? "ref@test.local" : null,
            CandidateSkills = (skillIds ?? [])
                .Select(sid => new CandidateSkill { SkillOptionId = sid }).ToList(),
        };
        foreach (var s in priorStatuses.Append(status))
            candidate.StatusHistories.Add(new StatusHistory { Status = s, ChangedBy = "test" });
        db.Candidates.Add(candidate);
        db.SaveChanges();
        return candidate;
    }

    public Interview AddInterview(int candidateId, params int[] interviewerUserIds)
    {
        var interview = new Interview
        {
            CandidateId = candidateId,
            ScheduledAt = DateTime.UtcNow.AddDays(1),
            Interviewers = interviewerUserIds.Distinct()
                .Select(uid => new InterviewInterviewer { UserId = uid }).ToList(),
        };
        db.Interviews.Add(interview);
        db.SaveChanges();
        return interview;
    }

    public InterviewEvaluation AddSubmittedEvaluation(
        int interviewId, int userId, int overallRating = 4, string recommendation = "Recommended")
    {
        var eval = new InterviewEvaluation
        {
            InterviewId = interviewId,
            InterviewerUserId = userId,
            OverallRating = overallRating,
            Recommendation = recommendation,
            IsSubmitted = true,
            SubmittedAt = DateTime.UtcNow,
            Items = EvaluationCriteria.Keys
                .Select(k => new InterviewEvaluationItem { CriterionKey = k, Rating = 4 }).ToList(),
        };
        db.InterviewEvaluations.Add(eval);
        db.SaveChanges();
        return eval;
    }
}
