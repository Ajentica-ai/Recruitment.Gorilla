using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class CandidateService(AppDbContext db, IWebHostEnvironment env, NotificationService notificationService, IConfiguration config)
{
    private static readonly Regex EmailRegex =
        new(@"^[\w.+-]+@[\w-]+\.[a-z]{2,}$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private const string Uploaded = "Uploaded";
    private const string TechnicalAssessment = "Technical Assessment";
    private const string SubmissionReceived = "Submission Received";
    private const string CodeReview = "Code Review";
    private const string InterviewScheduled = "Interview Scheduled";
    private const string InterviewCompleted = "Interview Completed";
    private const string Recommended = "Recommended";
    private const string OfferPreparation = "Offer Preparation";
    private const string OfferExtended = "Offer Extended";
    private const string OfferAccepted = "Offer Accepted";
    private const string OfferDeclined = "Offer Declined";
    private const string Hired = "Hired";
    private const string Reject = "Reject";
    private const string Discontinued = "Discontinued";

    /// <summary>
    /// Restricts a candidate query to those a non-admin caller may access: candidates they own,
    /// OR candidates whose applied-for role lists them as an assigned recruiter. A null
    /// <paramref name="accessUserId"/> means no restriction (Admin+).
    /// </summary>
    private static IQueryable<Candidate> ApplyAccess(IQueryable<Candidate> query, int? accessUserId) =>
        accessUserId is int uid
            ? query.Where(c => c.OwnerUserId == uid ||
                               (c.RoleAppliedOption != null &&
                                c.RoleAppliedOption.Recruiters.Any(rr => rr.UserId == uid)))
            : query;

    public async Task<PagedResult<CandidateListItemDto>> GetAllAsync(
        CandidateListQuery q, int? ownerUserId = null)
    {
        var query = ApplyAccess(db.Candidates.AsQueryable(), ownerUserId);

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(c =>
                c.FullName.Contains(q.Search) ||
                c.Email.Contains(q.Search) ||
                (c.Phone != null && c.Phone.Contains(q.Search)));

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(c => c.CurrentStatus == q.Status);

        if (q.RoleId is int rid)
            query = query.Where(c => c.RoleAppliedOptionId == rid);

        if (!string.IsNullOrWhiteSpace(q.Batch))
            query = query.Where(c => c.BatchName == q.Batch || c.BatchId == q.Batch);

        // ANY-of: candidates having at least one of the selected skills.
        if (q.SkillIds is { Count: > 0 })
            query = query.Where(c => c.CandidateSkills.Any(cs => q.SkillIds.Contains(cs.SkillOptionId)));

        if (q.ReferredOnly)
            query = query.Where(c => c.IsReferred);

        // Pipeline bucket — the same definitions the dashboard KPI tiles count,
        // so a tile and the list it links to always agree.
        query = q.Bucket switch
        {
            CandidateBuckets.Recommended =>
                query.Where(c => CandidateBuckets.PositiveTerminal.Contains(c.CurrentStatus)),
            CandidateBuckets.Rejected =>
                query.Where(c => CandidateBuckets.NegativeTerminal.Contains(c.CurrentStatus)),
            // Anything not yet terminal, either way.
            CandidateBuckets.InProcess =>
                query.Where(c => !CandidateBuckets.PositiveTerminal.Contains(c.CurrentStatus)
                              && !CandidateBuckets.NegativeTerminal.Contains(c.CurrentStatus)),
            CandidateBuckets.NewThisWeek =>
                query.Where(c => c.CreatedAt >= DateTime.UtcNow.AddDays(-CandidateBuckets.NewWindowDays)),
            _ => query,
        };

        // Whitelisted sort — unknown values fall back to newest-first.
        var desc = q.Dir != "asc";
        query = q.Sort switch
        {
            "name" => desc ? query.OrderByDescending(c => c.FullName) : query.OrderBy(c => c.FullName),
            "status" => desc ? query.OrderByDescending(c => c.CurrentStatus) : query.OrderBy(c => c.CurrentStatus),
            _ => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
        };

        var total = await query.CountAsync();
        var items = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(c => new CandidateListItemDto(
                c.Id, c.FullName, c.Email, c.Phone,
                c.CurrentTitle,
                c.RoleAppliedOption != null ? c.RoleAppliedOption.Name : c.AppliedRole,
                c.CurrentStatus, c.CreatedAt,
                c.SourceOption != null ? c.SourceOption.Name : null,
                c.UpdatedAt,
                c.BatchName))
            .ToListAsync();

        return new PagedResult<CandidateListItemDto>(items, total, q.Page, q.PageSize);
    }

    public async Task<List<string>> GetCandidateBatchesAsync(int? ownerUserId = null)
    {
        var query = ApplyAccess(db.Candidates.AsQueryable(), ownerUserId);
        return await query
            .Where(c => !string.IsNullOrEmpty(c.BatchName))
            .Select(c => c.BatchName!)
            .Distinct()
            .OrderBy(b => b)
            .ToListAsync();
    }

    public async Task<CandidateDetailDto?> GetByIdAsync(int id, int? ownerUserId = null)
    {
        var query = db.Candidates
            .Include(x => x.CVFiles)
            .Include(x => x.StatusHistories.OrderByDescending(s => s.ChangedAt))
            .Include(x => x.RoleAppliedOption)
            .Include(x => x.SourceOption)
            .Include(x => x.CandidateSkills).ThenInclude(cs => cs.SkillOption)
            .Include(x => x.Interviews).ThenInclude(i => i.Interviewers).ThenInclude(ii => ii.User)
            .Include(x => x.Interviews).ThenInclude(i => i.Tags).ThenInclude(t => t.InterviewTypeOption)
            .Include(x => x.Interviews).ThenInclude(i => i.Evaluations).ThenInclude(e => e.InterviewerUser)
            .Include(x => x.Educations)
            .Include(x => x.Experiences)
            .AsSplitQuery();

        var c = await ApplyAccess(query, ownerUserId).FirstOrDefaultAsync(x => x.Id == id);

        if (c is null) return null;

        return MapToDetail(c);
    }

    public async Task<CandidateListItemDto?> FindDuplicateAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;

        return await db.Candidates
            .Where(c => c.Email == email)
            .OrderBy(c => c.Id)
            .Select(c => new CandidateListItemDto(
                c.Id, c.FullName, c.Email, c.Phone,
                c.CurrentTitle,
                c.RoleAppliedOption != null ? c.RoleAppliedOption.Name : c.AppliedRole,
                c.CurrentStatus, c.CreatedAt,
                c.SourceOption != null ? c.SourceOption.Name : null,
                c.UpdatedAt))
            .FirstOrDefaultAsync();
    }

    /// <summary>Distinct non-empty applied roles, for the role suggestions dropdown.</summary>
    public async Task<List<string>> GetDistinctRolesAsync() =>
        await db.Candidates
            .Where(c => c.AppliedRole != null && c.AppliedRole != "")
            .Select(c => c.AppliedRole!)
            .Distinct()
            .OrderBy(r => r)
            .ToListAsync();

    /// <summary>
    /// When a candidate is marked as referred, a reference name and a valid reference
    /// email are required. Returns an error message or null. Used by create and update.
    /// </summary>
    public static string? ValidateReference(bool isReferred, string? referenceName, string? referenceEmail)
    {
        if (!isReferred) return null;

        if (string.IsNullOrWhiteSpace(referenceName) || string.IsNullOrWhiteSpace(referenceEmail))
            return "A referred candidate requires a reference name and a reference email.";

        if (!EmailRegex.IsMatch(referenceEmail))
            return "The reference email is not a valid email address.";

        return null;
    }

    /// <summary>
    /// Validates core candidate fields and that any selected role/skill options exist
    /// and are active. Returns an error message or null. Used by create and update.
    /// </summary>
    public async Task<string?> ValidateCandidateAsync(
        string fullName, string email, int? roleAppliedOptionId, List<int>? skillOptionIds,
        string? relevantExperience, int? sourceOptionId = null)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return "Full name is required.";

        if (string.IsNullOrWhiteSpace(email) || !EmailRegex.IsMatch(email.Trim()))
            return "A valid email address is required.";

        if (string.IsNullOrWhiteSpace(relevantExperience))
            return "Relevant experience is required.";

        if (roleAppliedOptionId is int roleId &&
            !await db.RoleAppliedOptions.AnyAsync(r => r.Id == roleId && r.IsActive))
            return "The selected role is not a valid active option.";

        if (sourceOptionId is int sourceId &&
            !await db.CandidateSourceOptions.AnyAsync(s => s.Id == sourceId && s.IsActive))
            return "The selected source is not a valid active option.";

        if (skillOptionIds is { Count: > 0 })
        {
            var ids = skillOptionIds.Distinct().ToList();
            var validCount = await db.SkillOptions.CountAsync(s => ids.Contains(s.Id) && s.IsActive);
            if (validCount != ids.Count)
                return "One or more selected skills are not valid active options.";
        }

        return null;
    }

    public async Task<bool> IsActiveStatusAsync(string status) =>
        await db.StatusOptions.AnyAsync(s => s.IsActive && s.Name == status);

    public async Task<string?> ValidateInitialStatusAsync(CreateCandidateDto dto)
    {
        var isAllowedInitial = await db.StatusOptions
            .AnyAsync(s => s.IsActive && s.IsInitial && s.Name == dto.InitialStatus);
        if (!isAllowedInitial)
            return "Initial status must be an active configured initial status option.";

        if (RequiresComment(dto.InitialStatus) && string.IsNullOrWhiteSpace(dto.InitialStatusComment))
            return $"{dto.InitialStatus} requires a comment.";

        return null;
    }

    /// <summary>
    /// Error string when a candidate's applied-for job opening has ended (its <c>EndDate</c>
    /// has passed) — profile edits and status changes are then locked for everyone until an
    /// Admin extends the End Date. Null when the role is open or the candidate has no role.
    /// </summary>
    private static string? RoleLockError(RoleAppliedOption? role) =>
        role is not null && role.EndDate < DateTime.UtcNow
            ? $"This job opening ('{role.Name}') ended on {role.EndDate:g}. Ask an Admin to extend the End Date before making changes."
            : null;

    /// <summary>Lock error for a candidate's current role (used before profile updates). Null if editable.</summary>
    public async Task<string?> GetRoleLockErrorAsync(int candidateId)
    {
        var candidate = await db.Candidates
            .Include(c => c.RoleAppliedOption)
            .FirstOrDefaultAsync(c => c.Id == candidateId);
        return candidate is null ? null : RoleLockError(candidate.RoleAppliedOption);
    }

    public async Task<string?> ValidateStatusChangeAsync(int candidateId, StatusChangeDto dto)
    {
        var candidate = await db.Candidates
            .Include(c => c.StatusHistories)
            .Include(c => c.RoleAppliedOption)
            .FirstOrDefaultAsync(c => c.Id == candidateId);

        if (candidate is null) return null;

        if (RoleLockError(candidate.RoleAppliedOption) is string lockError)
            return lockError;

        var transitionAllowed = await db.StatusTransitions.AnyAsync(t =>
            t.IsActive &&
            t.FromStatusOption.IsActive &&
            t.ToStatusOption.IsActive &&
            t.FromStatusOption.Name == candidate.CurrentStatus &&
            t.ToStatusOption.Name == dto.Status);

        if (!transitionAllowed)
            return $"Status cannot move from '{candidate.CurrentStatus}' to '{dto.Status}'.";

        if (RequiresComment(dto.Status) && string.IsNullOrWhiteSpace(dto.Comment))
            return $"{dto.Status} requires a comment.";

        if (dto.Status == TechnicalAssessment)
        {
            if (string.IsNullOrWhiteSpace(dto.Comment))
                return "Technical Assessment requires a comment.";
            if (string.IsNullOrWhiteSpace(dto.TaskDetails))
                return "Technical Assessment requires assigned task details.";
        }

        if (dto.Status == SubmissionReceived && string.IsNullOrWhiteSpace(dto.SubmissionUrl))
            return "Submission Received requires a submission link.";

        if (dto.Status == CodeReview && !HasStatus(candidate, SubmissionReceived))
            return "Code Review requires Submission Received to exist in the candidate history.";

        if (dto.Status == InterviewScheduled)
        {
            if (dto.InterviewAt is null)
                return "Interview Scheduled requires interview date/time.";

            if (dto.InterviewerUserIds is not { Count: > 0 })
                return "Interview Scheduled requires at least one interviewer.";

            var ids = dto.InterviewerUserIds.Distinct().ToList();
            var validCount = await db.Users.CountAsync(u => ids.Contains(u.Id) && u.IsActive);
            if (validCount != ids.Count)
                return "One or more selected interviewers are not valid active users.";

            if (dto.InterviewTypeOptionIds is { Count: > 0 })
            {
                var typeIds = dto.InterviewTypeOptionIds.Distinct().ToList();
                var validTypeCount = await db.InterviewTypeOptions.CountAsync(t => typeIds.Contains(t.Id) && t.IsActive);
                if (validTypeCount != typeIds.Count)
                    return "One or more selected interview types are not valid active options.";
            }
        }

        if (dto.Status == InterviewCompleted)
        {
            if (!HasStatus(candidate, InterviewScheduled))
                return "Interview Completed requires Interview Scheduled to exist in the candidate history.";
            if (string.IsNullOrWhiteSpace(dto.Comment))
                return "Interview Completed requires a comment.";

            var hasSubmittedEvaluation = await db.Interviews
                .Where(i => i.CandidateId == candidateId)
                .OrderByDescending(i => i.CreatedAt)
                .Take(1)
                .SelectMany(i => i.Evaluations)
                .AnyAsync(ev => ev.IsSubmitted);
            if (!hasSubmittedEvaluation)
                return "Interview Completed requires at least one submitted interviewer evaluation.";
        }

        if (dto.Status == Recommended && !HasAnyStatus(candidate, [CodeReview, InterviewCompleted]))
            return "Recommended requires Code Review or Interview Completed to exist in the candidate history.";

        if (dto.Status == Hired && !HasStatus(candidate, OfferAccepted))
            return "Hired requires Offer Accepted to exist in the candidate history.";

        return null;
    }

    /// <summary>
    /// Creates a candidate. If an existing candidate shares the same email and the
    /// caller has not set AllowDuplicate, the existing record is returned in
    /// <c>Duplicate</c> and nothing is saved (warn-but-allow).
    /// </summary>
    public async Task<(CandidateDetailDto? Created, CandidateListItemDto? Duplicate)> CreateAsync(
        CreateCandidateDto dto, int? ownerUserId, string? changedBy)
    {
        if (!dto.AllowDuplicate)
        {
            var existing = await FindDuplicateAsync(dto.Email);
            if (existing is not null)
                return (null, existing);
        }

        var candidate = new Candidate
        {
            FullName = dto.FullName,
            Email = dto.Email,
            Phone = dto.Phone,
            CurrentTitle = dto.CurrentTitle,
            RelevantExperience = dto.RelevantExperience.Trim(),
            Skills = dto.Skills,
            Summary = dto.Summary,
            LinkedInUrl = dto.LinkedInUrl,
            GithubUrl = dto.GithubUrl,
            PortfolioUrl = dto.PortfolioUrl,
            Location = dto.Location,
            LeetCodeUrl = dto.LeetCodeUrl,
            CodeforcesUrl = dto.CodeforcesUrl,
            HackerRankUrl = dto.HackerRankUrl,
            GitLabUrl = dto.GitLabUrl,
            AppliedRole = dto.AppliedRole,
            IsReferred = dto.IsReferred,
            ReferenceName = dto.IsReferred ? dto.ReferenceName : null,
            ReferenceEmail = dto.IsReferred ? dto.ReferenceEmail : null,
            ReferenceEmployeeId = dto.IsReferred ? dto.ReferenceEmployeeId : null,
            RoleAppliedOptionId = dto.RoleAppliedOptionId,
            SourceOptionId = dto.SourceOptionId,
            SourceDetail = CleanText(dto.SourceDetail),
            CurrentStatus = dto.InitialStatus,
            OwnerUserId = ownerUserId,
        };

        if (dto.Educations is { Count: > 0 })
        {
            foreach (var ed in dto.Educations)
            {
                candidate.Educations.Add(new CandidateEducation
                {
                    Degree = ed.Degree,
                    Institution = ed.Institution,
                    GraduationYear = ed.GraduationYear,
                    Cgpa = ed.Cgpa
                });
            }
        }

        if (dto.Experiences is { Count: > 0 })
        {
            foreach (var ex in dto.Experiences)
            {
                candidate.Experiences.Add(new CandidateExperience
                {
                    JobTitle = ex.JobTitle,
                    Company = ex.Company,
                    Duration = ex.Duration,
                    Description = ex.Description
                });
            }
        }

        foreach (var skillId in (dto.SkillOptionIds ?? []).Distinct())
            candidate.CandidateSkills.Add(new CandidateSkill { SkillOptionId = skillId });

        candidate.CVFiles.Add(new CVFile
        {
            OriginalFileName = dto.OriginalFileName,
            StoredFileName = dto.StoredFileName,
            FileType = dto.FileType,
            FileSizeBytes = dto.FileSizeBytes,
        });

        candidate.StatusHistories.Add(new StatusHistory
        {
            Status = dto.InitialStatus,
            Comment = dto.InitialStatusComment,
            ChangedBy = changedBy ?? dto.ChangedBy ?? "Unknown",
        });

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        // Reload with role/skill navigations for a complete detail response.
        return ((await GetByIdAsync(candidate.Id))!, null);
    }

    public async Task<CvFileResult?> GetCvFileAsync(int candidateId, int fileId)
    {
        var file = await db.CVFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.CandidateId == candidateId);

        if (file is null) return null;

        var path = Path.Combine(env.ContentRootPath, "Uploads", file.StoredFileName);
        if (!File.Exists(path)) return null;

        var contentType = file.FileType == "PDF"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        return new CvFileResult(path, file.OriginalFileName, contentType);
    }

    /// <summary>
    /// Deletes a candidate and its related rows (CVFiles and StatusHistories cascade),
    /// and removes the stored CV files from disk. Returns false if not found.
    /// </summary>
    public async Task<bool> DeleteAsync(int id, int? ownerUserId = null)
    {
        var candidate = await db.Candidates
            .Include(c => c.CVFiles)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (candidate is null) return false;
        if (ownerUserId is int owner && candidate.OwnerUserId != owner) return false;

        foreach (var file in candidate.CVFiles)
        {
            var path = Path.Combine(env.ContentRootPath, "Uploads", file.StoredFileName);
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch
            {
                // Best-effort file cleanup; proceed with the DB delete regardless.
            }
        }

        db.Candidates.Remove(candidate);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<CandidateDetailDto?> UpdateAsync(int id, UpdateCandidateDto dto, int? ownerUserId = null)
    {
        var candidate = await ApplyAccess(db.Candidates.Include(x => x.CandidateSkills), ownerUserId)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (candidate is null) return null;

        candidate.FullName = dto.FullName;
        candidate.Email = dto.Email;
        candidate.Phone = dto.Phone;
        candidate.CurrentTitle = dto.CurrentTitle;
        candidate.RelevantExperience = dto.RelevantExperience.Trim();
        candidate.Skills = dto.Skills;
        candidate.Summary = dto.Summary;
        candidate.LinkedInUrl = dto.LinkedInUrl;
        candidate.GithubUrl = dto.GithubUrl;
        candidate.PortfolioUrl = dto.PortfolioUrl;
        candidate.Location = dto.Location;
        candidate.LeetCodeUrl = dto.LeetCodeUrl;
        candidate.CodeforcesUrl = dto.CodeforcesUrl;
        candidate.HackerRankUrl = dto.HackerRankUrl;
        candidate.GitLabUrl = dto.GitLabUrl;
        candidate.AppliedRole = dto.AppliedRole;
        candidate.IsReferred = dto.IsReferred;
        candidate.ReferenceName = dto.IsReferred ? dto.ReferenceName : null;
        candidate.ReferenceEmail = dto.IsReferred ? dto.ReferenceEmail : null;
        candidate.ReferenceEmployeeId = dto.IsReferred ? dto.ReferenceEmployeeId : null;
        candidate.RoleAppliedOptionId = dto.RoleAppliedOptionId;
        candidate.SourceOptionId = dto.SourceOptionId;
        candidate.SourceDetail = CleanText(dto.SourceDetail);
        candidate.UpdatedAt = DateTime.UtcNow;

        if (dto.Educations != null)
        {
            await db.Entry(candidate).Collection(c => c.Educations).LoadAsync();
            candidate.Educations.Clear();
            foreach (var ed in dto.Educations)
            {
                candidate.Educations.Add(new CandidateEducation
                {
                    Degree = ed.Degree,
                    Institution = ed.Institution,
                    GraduationYear = ed.GraduationYear,
                    Cgpa = ed.Cgpa
                });
            }
        }

        if (dto.Experiences != null)
        {
            await db.Entry(candidate).Collection(c => c.Experiences).LoadAsync();
            candidate.Experiences.Clear();
            foreach (var ex in dto.Experiences)
            {
                candidate.Experiences.Add(new CandidateExperience
                {
                    JobTitle = ex.JobTitle,
                    Company = ex.Company,
                    Duration = ex.Duration,
                    Description = ex.Description
                });
            }
        }

        // Replace the candidate's skills with the new selection.
        var newSkillIds = (dto.SkillOptionIds ?? []).Distinct().ToHashSet();
        candidate.CandidateSkills.Clear();
        foreach (var skillId in newSkillIds)
            candidate.CandidateSkills.Add(new CandidateSkill { SkillOptionId = skillId });

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<StatusHistoryDto?> AddStatusAsync(
        int id, StatusChangeDto dto, string? changedBy = null, int? currentUserId = null)
    {
        var candidate = await db.Candidates.FindAsync(id);
        if (candidate is null) return null;

        var entry = new StatusHistory
        {
            CandidateId = id,
            Status = dto.Status,
            Comment = dto.Comment,
            TaskDetails = dto.TaskDetails,
            SubmissionUrl = dto.SubmissionUrl,
            InterviewAt = dto.InterviewAt,
            ChangedBy = changedBy ?? dto.ChangedBy ?? "Unknown",
        };

        // On completion, link the entry to the interview it concludes. The per-interviewer
        // evaluation summary is surfaced live (structured) via StatusHistoryDto.EvaluationSummaries,
        // rendered as cards on the timeline — not baked into the comment text.
        if (dto.Status == InterviewCompleted)
        {
            var completedInterviewId = await db.Interviews
                .Where(i => i.CandidateId == id)
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => (int?)i.Id)
                .FirstOrDefaultAsync();
            if (completedInterviewId is int cid)
                entry.InterviewId = cid;
        }

        db.StatusHistories.Add(entry);
        candidate.CurrentStatus = dto.Status;
        candidate.UpdatedAt = DateTime.UtcNow;

        // When scheduling an interview, create the Interview + assigned interviewers in the
        // same save (StatusHistory nav sets the FK). Notifications follow once we have the Id.
        Interview? interview = null;
        if (dto.Status == InterviewScheduled && dto.InterviewAt is not null &&
            dto.InterviewerUserIds is { Count: > 0 })
        {
            interview = new Interview
            {
                CandidateId = id,
                StatusHistory = entry,
                ScheduledAt = dto.InterviewAt.Value,
                DurationMinutes = NormalizeDuration(dto.InterviewDurationMinutes),
                CreatedByUserId = currentUserId,
                Interviewers = dto.InterviewerUserIds
                    .Distinct()
                    .Select(uid => new InterviewInterviewer { UserId = uid })
                    .ToList(),
                Tags = (dto.InterviewTypeOptionIds ?? [])
                    .Distinct()
                    .Select(tid => new InterviewTag { InterviewTypeOptionId = tid })
                    .ToList(),
            };
            db.Interviews.Add(interview);
        }

        await db.SaveChangesAsync();

        if (interview is not null)
        {
            var interviewUrl = $"{config["App:ClientBaseUrl"]?.TrimEnd('/')}/interviews/{interview.Id}";
            var invite = new InterviewInviteDetails(
                interview.Id, candidate.FullName, candidate.AppliedRole,
                interview.ScheduledAt, interview.DurationMinutes, interviewUrl);
            var calendar = CalendarInvite.Build(invite);

            foreach (var uid in dto.InterviewerUserIds!.Distinct())
            {
                var interviewer = await db.Users.FindAsync(uid);
                var (emailSubject, emailHtml) = EmailTemplates.InterviewAssigned(
                    interviewer?.Name ?? "there", candidate.FullName, candidate.AppliedRole,
                    interview.ScheduledAt, interviewUrl, invite);

                await notificationService.NotifyAsync(
                    uid, "Interview assigned", $"You have been assigned to interview {candidate.FullName}.",
                    $"/interviews/{interview.Id}", emailSubject, emailHtml, calendar);
            }
        }

        var interviewers = interview is null
            ? []
            : await db.Users
                .Where(u => dto.InterviewerUserIds!.Contains(u.Id))
                .OrderBy(u => u.Name)
                .Select(u => new InterviewInterviewerDto(u.Id, u.Name))
                .ToListAsync();

        var interviewTags = interview is null || dto.InterviewTypeOptionIds is not { Count: > 0 }
            ? []
            : await db.InterviewTypeOptions
                .Where(t => dto.InterviewTypeOptionIds.Contains(t.Id))
                .OrderBy(t => t.Name)
                .Select(t => t.Name)
                .ToListAsync();

        return new StatusHistoryDto(
            entry.Id,
            entry.Status,
            entry.Comment,
            entry.TaskDetails,
            entry.SubmissionUrl,
            entry.InterviewAt,
            entry.ChangedAt,
            entry.ChangedBy,
            interview?.Id,
            interviewers,
            interviewTags,
            []);
    }

    private static CandidateDetailDto MapToDetail(Candidate c) => new(
        c.Id, c.FullName, c.Email, c.Phone, c.CurrentTitle,
        c.RelevantExperience,
        c.Skills, c.Summary, c.LinkedInUrl,
        c.GithubUrl, c.PortfolioUrl, c.AppliedRole,
        c.IsReferred, c.ReferenceName, c.ReferenceEmail, c.ReferenceEmployeeId,
        c.RoleAppliedOptionId,
        c.RoleAppliedOption != null ? c.RoleAppliedOption.Name : null,
        c.CandidateSkills
            .Select(cs => new SkillOptionDto(cs.SkillOption.Id, cs.SkillOption.Name, cs.SkillOption.SortOrder, cs.SkillOption.IsActive))
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name).ToList(),
        c.CurrentStatus, c.CreatedAt, c.UpdatedAt,
        c.CVFiles.Select(f => new CVFileDto(f.Id, f.OriginalFileName, f.FileType, f.FileSizeBytes, f.UploadedAt)).ToList(),
        c.StatusHistories.Select(s => ToStatusHistoryDto(s, c.Interviews)).ToList(),
        c.RoleAppliedOption != null ? c.RoleAppliedOption.EndDate : null,
        c.RoleAppliedOption != null && c.RoleAppliedOption.EndDate < DateTime.UtcNow,
        c.SourceOptionId,
        c.SourceOption != null ? c.SourceOption.Name : null,
        c.SourceDetail,
        c.Location,
        c.LeetCodeUrl,
        c.CodeforcesUrl,
        c.HackerRankUrl,
        c.GitLabUrl,
        c.Educations.Select(ed => new CandidateEducationDto(ed.Id, ed.Degree, ed.Institution, ed.GraduationYear, ed.Cgpa)).ToList(),
        c.Experiences.Select(ex => new CandidateExperienceDto(ex.Id, ex.JobTitle, ex.Company, ex.Duration, ex.Description)).ToList()
    );

    /// <summary>
    /// Maps a status-history entry to its DTO, attaching the linked interview id and its
    /// interviewers when the entry created one (the "Interview Scheduled" entry).
    /// </summary>
    private static StatusHistoryDto ToStatusHistoryDto(StatusHistory s, IEnumerable<Interview> interviews)
    {
        // The scheduled entry carries the interview's interviewers + type tags (via StatusHistoryId).
        var scheduled = interviews.FirstOrDefault(i => i.StatusHistoryId == s.Id);
        var interviewers = scheduled?.Interviewers
            .OrderBy(ii => ii.User.Name)
            .Select(ii => new InterviewInterviewerDto(ii.UserId, ii.User.Name))
            .ToList() ?? [];
        var interviewTags = scheduled?.Tags
            .Select(t => t.InterviewTypeOption.Name)
            .OrderBy(n => n)
            .ToList() ?? [];

        // An "Interview Completed" entry links (InterviewId) to the interview it concludes; surface
        // a live, structured per-interviewer evaluation summary for card rendering on the timeline.
        var completed = s.InterviewId is int iid ? interviews.FirstOrDefault(i => i.Id == iid) : null;
        var evaluationSummaries = completed?.Evaluations
            .Where(e => e.IsSubmitted)
            .OrderBy(e => e.InterviewerUser != null ? e.InterviewerUser.Name : "")
            .Select(e => new EvaluationSummaryDto(
                e.InterviewerUser != null ? e.InterviewerUser.Name : "Unknown",
                e.OverallRating,
                e.Recommendation,
                e.RecommendationOther,
                e.SubmittedAt))
            .ToList() ?? [];

        return new StatusHistoryDto(
            s.Id,
            s.Status,
            s.Comment,
            s.TaskDetails,
            s.SubmissionUrl,
            s.InterviewAt,
            s.ChangedAt,
            s.ChangedBy,
            scheduled?.Id ?? s.InterviewId,
            interviewers,
            interviewTags,
            evaluationSummaries);
    }

    /// <summary>Trim to null so a blank source detail isn't persisted as an empty string.</summary>
    private static string? CleanText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Clamped so a bad or missing value can't produce a nonsensical calendar event (a zero-length
    /// or all-day block). Defaults to the standard hour.
    /// </summary>
    private static int NormalizeDuration(int? minutes) =>
        minutes is int m && m > 0 ? Math.Clamp(m, 5, 480) : 60;

    private static bool RequiresComment(string status) =>
        status is Reject or Discontinued or OfferDeclined;

    private static bool HasStatus(Candidate candidate, string status) =>
        candidate.CurrentStatus == status || candidate.StatusHistories.Any(h => h.Status == status);

    private static bool HasAnyStatus(Candidate candidate, string[] statuses) =>
        statuses.Contains(candidate.CurrentStatus) ||
        candidate.StatusHistories.Any(h => statuses.Contains(h.Status));
}
