using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api/candidates")]
public class CandidatesController(
    CandidateService candidateService,
    InterviewService interviewService,
    ConfigurationService config,
    AuditService audit,
    CurrentUser currentUser,
    ILogger<CandidatesController> logger) : ControllerBase
{
    // Admin+ see all candidates; a Recruiter only sees their own. Null means "no owner
    // filter". (Interviewers can't reach the candidate list/detail endpoints at all.)
    private int? ReadOwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    // For writes, only Admin+ act on any candidate; a Recruiter is limited to candidates they own
    // or are the assigned recruiter for (enforced by CandidateService's access predicate).
    private int? WriteOwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    private bool IsAdmin => currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin);

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? roleId,
        [FromQuery] string? skillIds, // CSV of SkillOption ids (axios-friendly)
        [FromQuery] bool referred = false,
        [FromQuery] string? bucket = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        // Tolerant CSV parse: non-numeric fragments are ignored.
        var parsedSkillIds = (skillIds ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var v) ? (int?)v : null)
            .Where(v => v is not null)
            .Select(v => v!.Value)
            .ToList();

        // Named arguments deliberately: this was positional, so adding Bucket
        // after ReferredOnly silently shifted `sort` into it.
        var query = new CandidateListQuery(
            Search: search,
            Status: status,
            RoleId: roleId,
            SkillIds: parsedSkillIds.Count > 0 ? parsedSkillIds : null,
            ReferredOnly: referred,
            Bucket: CandidateBuckets.IsKnown(bucket) ? bucket : null,
            Sort: sort,
            Dir: dir,
            Page: page,
            PageSize: pageSize);

        var result = await candidateService.GetAllAsync(query, ReadOwnerScope);
        return Ok(result);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var candidate = await candidateService.GetByIdAsync(id, ReadOwnerScope);
        return candidate is null ? NotFound() : Ok(candidate);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCandidateDto dto)
    {
        var candidateError = await candidateService.ValidateCandidateAsync(
            dto.FullName, dto.Email, dto.RoleAppliedOptionId, dto.SkillOptionIds, dto.RelevantExperience,
            dto.SourceOptionId);
        if (candidateError is not null)
            return BadRequest(candidateError);

        var validationError = await candidateService.ValidateInitialStatusAsync(dto);
        if (validationError is not null)
            return BadRequest(validationError);

        var referenceError = CandidateService.ValidateReference(dto.IsReferred, dto.ReferenceName, dto.ReferenceEmail);
        if (referenceError is not null)
            return BadRequest(referenceError);

        var (created, duplicate) = await candidateService.CreateAsync(dto, currentUser.UserId, currentUser.Name);

        if (duplicate is not null)
        {
            logger.LogWarning(
                "Duplicate candidate email '{Email}' — matches existing candidate {ExistingId}.",
                dto.Email, duplicate.Id);
            return Conflict(new DuplicateCandidateDto(
                $"A candidate with email '{duplicate.Email}' already exists.", duplicate));
        }

        logger.LogInformation("Created candidate {Id} ('{Name}') by {ChangedBy}.",
            created!.Id, created.FullName, currentUser.Name);
        await audit.RecordAsync("Candidate.Created", "Candidate", created.Id,
            $"Created candidate '{created.FullName}' (#{created.Id})");
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpGet("{id}/cv/{fileId}")]
    public async Task<IActionResult> GetCvFile(int id, int fileId)
    {
        // Enforce read scope before serving the file. Assigned interviewers get access to
        // the candidate's CV too (parallels the interview page bypassing owner-scope).
        if (await candidateService.GetByIdAsync(id, ReadOwnerScope) is null &&
            !await interviewService.IsAssignedInterviewerForCandidateAsync(id, currentUser.UserId ?? 0))
            return NotFound();

        var file = await candidateService.GetCvFileAsync(id, fileId);
        return file is null
            ? NotFound()
            : PhysicalFile(file.PhysicalPath, file.ContentType, file.OriginalFileName);
    }

    // Deleting a candidate (and its CV files) is restricted to Admin+ — Recruiters can't delete,
    // not even candidates they own.
    [Authorize(Roles = Roles.AdminOrAbove)]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        // Capture the name before deletion so the audit summary is readable.
        var candidate = await candidateService.GetByIdAsync(id, ReadOwnerScope);
        var deleted = await candidateService.DeleteAsync(id, WriteOwnerScope);
        if (!deleted) return NotFound();

        logger.LogInformation("Deleted candidate {Id} and its CV files.", id);
        await audit.RecordAsync("Candidate.Deleted", "Candidate", id,
            $"Deleted candidate {(candidate is not null ? $"'{candidate.FullName}' " : "")}(#{id})");
        return NoContent();
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await candidateService.GetDistinctRolesAsync();
        return Ok(roles);
    }

    // Active role/skill lookups for the candidate create/edit forms. Exposed here (not on the
    // Admin-only ConfigurationController) so Recruiters can populate the dropdowns. Admin+ get all
    // active roles; a Recruiter gets only the roles they are the assigned recruiter for.
    // Candidate evaluation report — every interviewer's full rubric + aggregates across the
    // candidate's interviews. Recruiter+ only (excludes Interviewers); candidate-access-scoped
    // (recruiters get 404 for candidates outside their access).
    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("{id}/evaluation-report")]
    public async Task<IActionResult> GetEvaluationReport(int id) =>
        await interviewService.GetCandidateEvaluationReportAsync(id, ReadOwnerScope) is { } report
            ? Ok(report)
            : NotFound();

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("role-options")]
    public async Task<IActionResult> GetRoleOptions() =>
        Ok(IsAdmin
            ? await config.GetActiveRolesAsync()
            : await config.GetAssignedRolesAsync(currentUser.UserId ?? 0));

    // Roles for the candidate-list role filter. Unlike the create/edit form's role-options
    // (active only), this includes inactive roles so candidates under a closed/deactivated
    // job opening stay filterable. Scoped: Admin+ get all roles; a Recruiter gets their
    // assigned roles.
    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("role-filter-options")]
    public async Task<IActionResult> GetRoleFilterOptions() =>
        Ok(IsAdmin
            ? await config.GetAllRolesAsync()
            : await config.GetAssignedRolesAsync(currentUser.UserId ?? 0, includeInactive: true));

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("skill-options")]
    public async Task<IActionResult> GetSkillOptions() => Ok(await config.GetActiveSkillsAsync());

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("source-options")]
    public async Task<IActionResult> GetSourceOptions() => Ok(await config.GetActiveSourcesAsync());

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("batches")]
    public async Task<IActionResult> GetBatches() =>
        Ok(await candidateService.GetCandidateBatchesAsync(ReadOwnerScope));

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("jobs")]
    public async Task<IActionResult> GetJobs() =>
        Ok(await config.GetAllRolesAsync());

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCandidateDto dto)
    {
        var candidateError = await candidateService.ValidateCandidateAsync(
            dto.FullName, dto.Email, dto.RoleAppliedOptionId, dto.SkillOptionIds, dto.RelevantExperience,
            dto.SourceOptionId);
        if (candidateError is not null)
            return BadRequest(candidateError);

        var referenceError = CandidateService.ValidateReference(dto.IsReferred, dto.ReferenceName, dto.ReferenceEmail);
        if (referenceError is not null)
            return BadRequest(referenceError);

        // Block edits once the candidate's applied-for job opening has ended (applies to all roles).
        var lockError = await candidateService.GetRoleLockErrorAsync(id);
        if (lockError is not null)
            return BadRequest(lockError);

        var updated = await candidateService.UpdateAsync(id, dto, WriteOwnerScope);
        if (updated is null) return NotFound();

        await audit.RecordAsync("Candidate.Updated", "Candidate", id,
            $"Updated candidate '{updated.FullName}' (#{id})");
        return Ok(updated);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("{id}/status")]
    public async Task<IActionResult> AddStatus(int id, [FromBody] StatusChangeDto dto)
    {
        // Enforce write scope before validating/applying the change.
        if (await candidateService.GetByIdAsync(id, WriteOwnerScope) is null)
            return NotFound();

        var validationError = await candidateService.ValidateStatusChangeAsync(id, dto);
        if (validationError is not null)
            return BadRequest(validationError);

        var entry = await candidateService.AddStatusAsync(id, dto, currentUser.Name, currentUser.UserId);
        if (entry is null) return NotFound();

        logger.LogInformation("Candidate {Id} status changed to '{Status}' by {ChangedBy}.",
            id, dto.Status, currentUser.Name);
        await audit.RecordAsync("Candidate.StatusChanged", "Candidate", id,
            $"Status changed to '{dto.Status}' (candidate #{id})",
            JsonSerializer.Serialize(new { to = dto.Status }));
        return Ok(entry);
    }
}
