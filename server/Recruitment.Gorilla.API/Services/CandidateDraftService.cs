using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class CandidateDraftService(
    AppDbContext db,
    AuditService audit,
    CurrentUser currentUser,
    IWebHostEnvironment env,
    ILogger<CandidateDraftService> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>SHA-256 of a file's content as uppercase hex (64 chars).</summary>
    public static string ComputeFileHash(Stream content) => Convert.ToHexString(SHA256.HashData(content));

    /// <summary>
    /// Returns why a CV with this content can't be uploaded again, or null when it is new. A CV counts as
    /// a duplicate while it sits in a Pending draft or is attached to a candidate; Discarded drafts and
    /// deleted candidates free it up. Rows stored before hashing existed have no hash, so same-size ones
    /// are hashed from disk here and the hash is saved for next time.
    /// </summary>
    public async Task<string?> FindDuplicateUploadAsync(string fileHash, long fileSizeBytes)
    {
        if (await db.CandidateDrafts.AnyAsync(d => d.Status == "Pending" && d.FileHash == fileHash))
            return PendingDuplicateMessage;
        if (await db.CVFiles.AnyAsync(f => f.FileHash == fileHash))
            return CandidateDuplicateMessage;

        var legacyDrafts = await db.CandidateDrafts
            .Where(d => d.Status == "Pending" && d.FileHash == null && d.FileSizeBytes == fileSizeBytes)
            .ToListAsync();
        var legacyFiles = await db.CVFiles
            .Where(f => f.FileHash == null && f.FileSizeBytes == fileSizeBytes)
            .ToListAsync();
        if (legacyDrafts.Count == 0 && legacyFiles.Count == 0) return null;

        foreach (var d in legacyDrafts) d.FileHash = HashStoredFile(d.StoredFileName);
        foreach (var f in legacyFiles) f.FileHash = HashStoredFile(f.StoredFileName);
        await db.SaveChangesAsync();

        if (legacyDrafts.Any(d => d.FileHash == fileHash)) return PendingDuplicateMessage;
        if (legacyFiles.Any(f => f.FileHash == fileHash)) return CandidateDuplicateMessage;
        return null;
    }

    private const string PendingDuplicateMessage =
        "This CV has already been uploaded and is waiting for review in Drafts.";
    private const string CandidateDuplicateMessage =
        "This CV has already been uploaded for an existing candidate.";

    private string? HashStoredFile(string storedFileName)
    {
        var path = UploadPaths.Resolve(env.ContentRootPath, storedFileName);
        if (path is null || !File.Exists(path)) return null;
        using var stream = File.OpenRead(path);
        return ComputeFileHash(stream);
    }

    /// <summary>
    /// Restricts a draft query to the drafts the caller may see or act on: every draft for Admin and
    /// Super Admin, otherwise only the ones the caller uploaded.
    ///
    /// Every read and write goes through this, not only the list. The list was scoped while the by-id
    /// read, update, approve, discard and their bulk forms loaded drafts by id alone, so a Recruiter who
    /// knew or guessed an id could read another user's parsed CV, or approve it and become the owner of
    /// the candidate it produced.
    ///
    /// It fails closed. The old list check applied its filter only when the caller had a user id, so a
    /// non-privileged caller without one fell through to every draft. Now that caller sees none.
    /// </summary>
    private IQueryable<CandidateDraft> ScopedDrafts()
    {
        if (currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin)) return db.CandidateDrafts;
        if (currentUser.UserId is not int uploaderId) return db.CandidateDrafts.Where(_ => false);
        return db.CandidateDrafts.Where(d => d.UploadedByUserId == uploaderId);
    }

    public async Task<PagedDraftsResultDto> GetDraftsAsync(DraftsFilterQuery query)
    {
        var baseQuery = ScopedDrafts();

        // Aggregate counts across statuses
        var totalPending = await baseQuery.CountAsync(d => d.Status == "Pending");
        var totalApproved = await baseQuery.CountAsync(d => d.Status == "Approved");
        var totalDiscarded = await baseQuery.CountAsync(d => d.Status == "Discarded");

        // Filter by Status
        if (!string.IsNullOrWhiteSpace(query.Status) && query.Status != "all")
        {
            baseQuery = baseQuery.Where(d => d.Status == query.Status);
        }

        // Filter by Batch
        if (!string.IsNullOrWhiteSpace(query.BatchId))
        {
            baseQuery = baseQuery.Where(d => d.BatchId == query.BatchId);
        }

        // Filter by Role
        if (query.RoleId.HasValue)
        {
            baseQuery = baseQuery.Where(d => d.RoleAppliedOptionId == query.RoleId.Value);
        }

        // Search text (Name, Email, Skills, Filename, Location)
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            baseQuery = baseQuery.Where(d =>
                (d.FullName != null && d.FullName.ToLower().Contains(search)) ||
                (d.Email != null && d.Email.ToLower().Contains(search)) ||
                (d.Skills != null && d.Skills.ToLower().Contains(search)) ||
                (d.Location != null && d.Location.ToLower().Contains(search)) ||
                d.OriginalFileName.ToLower().Contains(search));
        }

        var totalCount = await baseQuery.CountAsync();

        // Apply Cursor filter for pagination (assuming ordered by Id DESC)
        if (query.Cursor.HasValue)
        {
            baseQuery = baseQuery.Where(d => d.Id < query.Cursor.Value);
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var items = await baseQuery
            .OrderByDescending(d => d.Id)
            .Skip(query.Cursor.HasValue ? 0 : (page - 1) * pageSize)
            .Take(pageSize)
            .Include(d => d.RoleAppliedOption)
            .Select(d => new CandidateDraftListItemDto(
                d.Id,
                d.FullName,
                d.Email,
                d.Phone,
                d.CurrentTitle,
                d.RelevantExperience,
                d.Skills,
                d.RoleAppliedOptionId,
                d.RoleAppliedOption != null ? d.RoleAppliedOption.Name : null,
                d.OriginalFileName,
                d.StoredFileName,
                d.FileType,
                d.FileSizeBytes,
                d.Status,
                d.BatchId,
                d.BatchName,
                d.CreatedAt,
                d.Location
            ))
            .ToListAsync();

        int? nextCursor = items.Count == pageSize ? items.Last().Id : null;

        return new PagedDraftsResultDto(
            items,
            totalCount,
            page,
            pageSize,
            totalPages,
            totalPending,
            totalApproved,
            totalDiscarded,
            nextCursor
        );
    }

    public async Task<CandidateDraftDto?> GetDraftByIdAsync(int id)
    {
        var d = await ScopedDrafts()
            .Include(d => d.RoleAppliedOption)
            .Include(d => d.SourceOption)
            .Include(d => d.UploadedByUser)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (d == null) return null;

        List<CandidateEducationDto>? educations = null;
        if (!string.IsNullOrWhiteSpace(d.EducationJson))
        {
            try { educations = JsonSerializer.Deserialize<List<CandidateEducationDto>>(d.EducationJson, JsonOpts); } catch { }
        }

        List<CandidateExperienceDto>? experiences = null;
        if (!string.IsNullOrWhiteSpace(d.ExperienceJson))
        {
            try { experiences = JsonSerializer.Deserialize<List<CandidateExperienceDto>>(d.ExperienceJson, JsonOpts); } catch { }
        }

        return new CandidateDraftDto(
            d.Id,
            d.FullName,
            d.Email,
            d.Phone,
            d.CurrentTitle,
            d.RelevantExperience,
            d.Skills,
            d.Summary,
            d.LinkedInUrl,
            d.GithubUrl,
            d.PortfolioUrl,
            d.RoleAppliedOptionId,
            d.RoleAppliedOption?.Name,
            d.SourceOptionId,
            d.SourceOption?.Name,
            d.SourceDetail,
            d.OriginalFileName,
            d.StoredFileName,
            d.FileType,
            d.FileSizeBytes,
            d.Status,
            d.BatchId,
            d.BatchName,
            d.UploadedByUserId,
            d.UploadedByUser?.Name,
            d.CreatedAt,
            d.UpdatedAt,
            d.Location,
            d.LeetCodeUrl,
            d.CodeforcesUrl,
            d.HackerRankUrl,
            d.GitLabUrl,
            educations,
            experiences
        );
    }

    public async Task<List<DraftBatchSummaryDto>> GetBatchesAsync()
    {
        var query = ScopedDrafts();

        var flat = await query
            .Where(d => d.BatchId != null)
            .Select(d => new { d.BatchId, d.BatchName, d.Status, d.CreatedAt })
            .ToListAsync();

        var batches = flat
            .GroupBy(d => new { d.BatchId, d.BatchName })
            .Select(g => new DraftBatchSummaryDto(
                g.Key.BatchId!,
                g.Key.BatchName ?? g.Key.BatchId!,
                g.Count(),
                g.Count(d => d.Status == "Pending"),
                g.Count(d => d.Status == "Approved"),
                g.Count(d => d.Status == "Discarded"),
                g.Min(d => d.CreatedAt)
            ))
            .OrderByDescending(b => b.CreatedAt)
            .ToList();

        return batches;
    }

    public async Task<CandidateDraft> CreateDraftAsync(
        string originalFileName,
        string storedFileName,
        string fileType,
        long fileSizeBytes,
        string? batchId,
        string? batchName,
        string? fullName,
        string? email,
        string? phone,
        string? linkedIn,
        string? github,
        string? skills,
        string? summary,
        string? location = null,
        string? leetCode = null,
        string? codeforces = null,
        string? hackerRank = null,
        string? gitLab = null,
        List<ParsedEducation>? educations = null,
        List<ParsedExperience>? experiences = null,
        int? roleAppliedOptionId = null,
        string? fileHash = null)
    {
        var eduDtos = educations?.Select((e, idx) => new CandidateEducationDto(idx + 1, e.Degree, e.Institution, e.GraduationYear, e.Cgpa)).ToList();
        var expDtos = experiences?.Select((e, idx) => new CandidateExperienceDto(idx + 1, e.JobTitle, e.Company, e.Duration, e.Description)).ToList();

        var draft = new CandidateDraft
        {
            OriginalFileName = originalFileName,
            StoredFileName = storedFileName,
            FileType = fileType,
            FileSizeBytes = fileSizeBytes,
            FileHash = fileHash,
            BatchId = batchId,
            BatchName = batchName,
            FullName = fullName,
            Email = email,
            Phone = phone,
            LinkedInUrl = linkedIn,
            GithubUrl = github,
            Skills = skills,
            Summary = summary,
            Location = location,
            LeetCodeUrl = leetCode,
            CodeforcesUrl = codeforces,
            HackerRankUrl = hackerRank,
            GitLabUrl = gitLab,
            EducationJson = eduDtos is { Count: > 0 } ? JsonSerializer.Serialize(eduDtos) : null,
            ExperienceJson = expDtos is { Count: > 0 } ? JsonSerializer.Serialize(expDtos) : null,
            RoleAppliedOptionId = roleAppliedOptionId,
            Status = "Pending",
            UploadedByUserId = currentUser.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.CandidateDrafts.Add(draft);
        await db.SaveChangesAsync();

        logger.LogInformation(
            "Created CandidateDraft {DraftId} for file '{OriginalFileName}' in batch '{BatchId}'.",
            draft.Id, originalFileName, batchId);

        return draft;
    }

    public async Task<CandidateDraftDto?> UpdateDraftAsync(int id, UpdateCandidateDraftDto dto)
    {
        var draft = await ScopedDrafts().FirstOrDefaultAsync(d => d.Id == id);
        if (draft == null) return null;

        draft.FullName = dto.FullName?.Trim();
        draft.Email = dto.Email?.Trim();
        draft.Phone = dto.Phone?.Trim();
        draft.CurrentTitle = dto.CurrentTitle?.Trim();
        draft.RelevantExperience = dto.RelevantExperience?.Trim();
        draft.Skills = dto.Skills?.Trim();
        draft.Summary = dto.Summary?.Trim();
        draft.LinkedInUrl = dto.LinkedInUrl?.Trim();
        draft.GithubUrl = dto.GithubUrl?.Trim();
        draft.PortfolioUrl = dto.PortfolioUrl?.Trim();
        draft.RoleAppliedOptionId = dto.RoleAppliedOptionId;
        draft.SourceOptionId = dto.SourceOptionId;
        draft.SourceDetail = dto.SourceDetail?.Trim();
        draft.Location = dto.Location?.Trim();
        draft.LeetCodeUrl = dto.LeetCodeUrl?.Trim();
        draft.CodeforcesUrl = dto.CodeforcesUrl?.Trim();
        draft.HackerRankUrl = dto.HackerRankUrl?.Trim();
        draft.GitLabUrl = dto.GitLabUrl?.Trim();

        if (dto.Educations != null)
        {
            draft.EducationJson = dto.Educations.Count > 0 ? JsonSerializer.Serialize(dto.Educations) : null;
        }

        if (dto.Experiences != null)
        {
            draft.ExperienceJson = dto.Experiences.Count > 0 ? JsonSerializer.Serialize(dto.Experiences) : null;
        }

        draft.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return await GetDraftByIdAsync(id);
    }

    public async Task<(Candidate? Candidate, string? Error)> ApproveDraftAsync(int id, ApproveCandidateDraftDto dto)
    {
        var draft = await ScopedDrafts().FirstOrDefaultAsync(d => d.Id == id);
        if (draft == null) return (null, "Draft not found.");

        var fullName = (dto.FullName ?? draft.FullName)?.Trim();
        var email = (dto.Email ?? draft.Email)?.Trim();
        var roleId = dto.RoleAppliedOptionId ?? draft.RoleAppliedOptionId;
        var experience = (dto.RelevantExperience ?? draft.RelevantExperience)?.Trim();

        var nameError = PersonNameValidator.Validate(fullName, "Full name");
        if (nameError is not null) return (null, nameError);
        if (string.IsNullOrWhiteSpace(email)) return (null, "Email is required.");
        if (!roleId.HasValue) return (null, "Role applied for is required.");
        if (string.IsNullOrWhiteSpace(experience)) experience = "0 Years";

        // Check if role is active and not expired
        var role = await db.RoleAppliedOptions.FindAsync(roleId.Value);
        if (role == null || !role.IsActive) return (null, "Selected role is not active.");
        if (role.EndDate < DateTime.UtcNow)
            return (null, $"Role '{role.Name}' expired on {role.EndDate:yyyy-MM-dd}.");

        var candidate = new Candidate
        {
            FullName = fullName,
            Email = email,
            Phone = (dto.Phone ?? draft.Phone)?.Trim(),
            CurrentTitle = (dto.CurrentTitle ?? draft.CurrentTitle)?.Trim(),
            RelevantExperience = experience,
            Skills = (dto.Skills ?? draft.Skills)?.Trim(),
            Summary = (dto.Summary ?? draft.Summary)?.Trim(),
            LinkedInUrl = (dto.LinkedInUrl ?? draft.LinkedInUrl)?.Trim(),
            GithubUrl = (dto.GithubUrl ?? draft.GithubUrl)?.Trim(),
            PortfolioUrl = (dto.PortfolioUrl ?? draft.PortfolioUrl)?.Trim(),
            Location = (dto.Location ?? draft.Location)?.Trim(),
            LeetCodeUrl = (dto.LeetCodeUrl ?? draft.LeetCodeUrl)?.Trim(),
            CodeforcesUrl = (dto.CodeforcesUrl ?? draft.CodeforcesUrl)?.Trim(),
            HackerRankUrl = (dto.HackerRankUrl ?? draft.HackerRankUrl)?.Trim(),
            GitLabUrl = (dto.GitLabUrl ?? draft.GitLabUrl)?.Trim(),
            RoleAppliedOptionId = roleId,
            SourceOptionId = dto.SourceOptionId ?? draft.SourceOptionId,
            SourceDetail = (dto.SourceDetail ?? draft.SourceDetail)?.Trim(),
            IsReferred = dto.IsReferred,
            ReferenceName = dto.ReferenceName?.Trim(),
            ReferenceEmail = dto.ReferenceEmail?.Trim(),
            ReferenceEmployeeId = dto.ReferenceEmployeeId?.Trim(),
            CurrentStatus = "Uploaded",
            BatchId = draft.BatchId,
            BatchName = draft.BatchName,
            OwnerUserId = currentUser.UserId ?? draft.UploadedByUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Attach Educations
        var eduList = dto.Educations;
        if (eduList == null && !string.IsNullOrWhiteSpace(draft.EducationJson))
        {
            try { eduList = JsonSerializer.Deserialize<List<CandidateEducationDto>>(draft.EducationJson, JsonOpts); } catch { }
        }

        if (eduList is { Count: > 0 })
        {
            foreach (var ed in eduList)
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

        // Attach Experiences
        var expList = dto.Experiences;
        if (expList == null && !string.IsNullOrWhiteSpace(draft.ExperienceJson))
        {
            try { expList = JsonSerializer.Deserialize<List<CandidateExperienceDto>>(draft.ExperienceJson, JsonOpts); } catch { }
        }

        if (expList is { Count: > 0 })
        {
            foreach (var ex in expList)
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

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        // Attach CVFile
        var cvFile = new CVFile
        {
            CandidateId = candidate.Id,
            StoredFileName = draft.StoredFileName,
            OriginalFileName = draft.OriginalFileName,
            FileType = draft.FileType,
            FileSizeBytes = draft.FileSizeBytes,
            FileHash = draft.FileHash,
            UploadedAt = DateTime.UtcNow
        };
        db.CVFiles.Add(cvFile);

        // Initial status history
        var history = new StatusHistory
        {
            CandidateId = candidate.Id,
            Status = "Uploaded",
            ChangedBy = currentUser.Name ?? "Super Admin",
            ChangedAt = DateTime.UtcNow,
            Comment = $"Imported from draft batch '{draft.BatchName ?? draft.BatchId ?? "Intake"}'"
        };
        db.StatusHistories.Add(history);

        // Link skill options if provided
        if (dto.SkillOptionIds is { Count: > 0 })
        {
            var validSkillIds = await db.SkillOptions
                .Where(s => dto.SkillOptionIds.Contains(s.Id) && s.IsActive)
                .Select(s => s.Id)
                .ToListAsync();

            foreach (var sId in validSkillIds)
            {
                db.CandidateSkills.Add(new CandidateSkill
                {
                    CandidateId = candidate.Id,
                    SkillOptionId = sId
                });
            }
        }

        // Mark draft as approved
        draft.Status = "Approved";
        draft.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        await audit.RecordAsync(
            action: "Candidate.CreatedFromDraft",
            entityType: nameof(Candidate),
            entityId: candidate.Id,
            summary: $"Created candidate {candidate.Id} ('{candidate.FullName}') from draft {draft.Id}.");

        return (candidate, null);
    }

    public async Task<List<int>> BulkApproveAsync(BulkApproveDraftsDto dto)
    {
        var approvedCandidateIds = new List<int>();

        var drafts = await ScopedDrafts()
            .Where(d => dto.DraftIds.Contains(d.Id) && d.Status == "Pending")
            .ToListAsync();

        foreach (var draft in drafts)
        {
            var roleId = draft.RoleAppliedOptionId ?? dto.DefaultRoleAppliedOptionId;
            var experience = draft.RelevantExperience ?? dto.DefaultRelevantExperience ?? "0 Years";

            if (string.IsNullOrWhiteSpace(draft.FullName) || string.IsNullOrWhiteSpace(draft.Email) || !roleId.HasValue)
            {
                continue; // Skip drafts missing required fields
            }

            var approveDto = new ApproveCandidateDraftDto(
                draft.FullName,
                draft.Email,
                draft.Phone,
                draft.CurrentTitle,
                experience,
                draft.Skills,
                draft.Summary,
                draft.LinkedInUrl,
                draft.GithubUrl,
                draft.PortfolioUrl,
                roleId,
                draft.SourceOptionId ?? dto.DefaultSourceOptionId,
                draft.SourceDetail,
                null,
                false,
                null,
                null,
                null,
                draft.Location,
                draft.LeetCodeUrl,
                draft.CodeforcesUrl,
                draft.HackerRankUrl,
                draft.GitLabUrl
            );

            var (candidate, err) = await ApproveDraftAsync(draft.Id, approveDto);
            if (candidate != null)
            {
                approvedCandidateIds.Add(candidate.Id);
            }
        }

        return approvedCandidateIds;
    }

    public async Task<bool> DiscardDraftAsync(int id)
    {
        var draft = await ScopedDrafts().FirstOrDefaultAsync(d => d.Id == id);
        if (draft == null) return false;

        draft.Status = "Discarded";
        draft.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        logger.LogInformation("Discarded CandidateDraft {DraftId}.", id);
        return true;
    }

    public async Task<int> BulkDiscardAsync(List<int> draftIds)
    {
        var drafts = await ScopedDrafts()
            .Where(d => draftIds.Contains(d.Id) && d.Status == "Pending")
            .ToListAsync();

        foreach (var d in drafts)
        {
            d.Status = "Discarded";
            d.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return drafts.Count;
    }
}
