using System.Net.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.AdminOrAbove)]
[Route("api/config")]
public class ConfigurationController(
    ConfigurationService config,
    EmailSettingsService emailSettings,
    EmailService emailService,
    EmailOutboxService emailOutbox,
    SlackSettingsService slackSettings,
    SlackService slackService,
    CurrentUser currentUser,
    AuditService audit,
    ILogger<ConfigurationController> logger) : ControllerBase
{
    // ----- Email settings (SuperAdmin only — sensitive credentials) -----

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpGet("email")]
    public async Task<IActionResult> GetEmailSettings() => Ok(await emailSettings.GetAsync());

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPut("email")]
    public async Task<IActionResult> SaveEmailSettings([FromBody] UpsertEmailSettingsDto dto)
    {
        if (dto.Provider is not (EmailProviders.Smtp or EmailProviders.HttpApi))
            return BadRequest($"Unknown provider '{dto.Provider}'.");

        if (dto.Provider != EmailProviders.HttpApi)
        {
            if (string.IsNullOrWhiteSpace(dto.Host)) return BadRequest("SMTP host is required.");
            if (string.IsNullOrWhiteSpace(dto.FromAddress)) return BadRequest("From address is required.");
            if (dto.Port is < 1 or > 65535) return BadRequest("Port must be between 1 and 65535.");
        }

        // Matches the EmailSetting column lengths (AppDbContext) — caught here as a clear 400 rather
        // than surfacing as a 500 from a DbUpdateException once EF tries to save an over-long value.
        // ApiKey is capped well under ApiKeyEncrypted's 1000 chars to leave room for the AES-GCM
        // nonce/tag and base64 overhead the encrypted form adds on top of the plaintext.
        if ((dto.ApiBaseUrl?.Length ?? 0) > 500) return BadRequest("The Notification API base URL is too long.");
        if ((dto.AllowedRecipientDomains?.Length ?? 0) > 500) return BadRequest("Allowed recipient domains is too long.");
        if ((dto.ApiKey?.Length ?? 0) > 500) return BadRequest("The API key is too long.");

        // The Notification API base URL's format (and the host-change-without-a-new-key rule) is
        // validated in EmailSettingsService.SaveAsync: it must hold regardless of which provider this
        // particular save is for, since ApiBaseUrl/ApiKeyEncrypted are shared state on the one row.
        var (ok, error) = await emailSettings.SaveAsync(dto, currentUser.UserId);
        if (!ok) return BadRequest(error);

        logger.LogInformation("Email settings updated by user {UserId}.", currentUser.UserId);
        return Ok(await emailSettings.GetAsync());
    }

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPost("email/test")]
    public async Task<IActionResult> SendTestEmail([FromBody] TestEmailRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ToEmail)) return BadRequest("A recipient email is required.");
        try
        {
            var result = await emailService.SendTestAsync(dto.ToEmail.Trim(), dto.ToEmail.Trim(),
                "Recruitment Gorilla email test",
                "<p>This is a test email from Recruitment Gorilla. Your email settings are working.</p>");
            return Ok(new TestEmailResultDto(true, null, result.MessageId));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Test email to {ToEmail} failed.", dto.ToEmail);
            return Ok(new TestEmailResultDto(false, ex.Message));
        }
    }

    // ----- Email delivery log (SuperAdmin only) -----

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpGet("email/outbox")]
    public async Task<IActionResult> GetEmailOutbox(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        // The upper bound keeps (page-1)*pageSize well clear of int overflow further down in
        // EmailOutboxService.QueryAsync, however large pageSize is within its own 200 cap.
        if (page is < 1 or > 1_000_000) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;
        return Ok(await emailOutbox.QueryAsync(status, page, pageSize));
    }

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPost("email/outbox/{id:long}/resend")]
    public async Task<IActionResult> ResendEmail(long id)
    {
        var (ok, notFound, error) = await emailOutbox.ResendAsync(id);
        if (notFound) return NotFound();
        if (!ok) return BadRequest(error);

        logger.LogInformation("Email {Id} queued for resend by user {UserId}.", id, currentUser.UserId);
        return Ok(new ResendEmailResultDto(true, null));
    }

    // ----- Slack settings (SuperAdmin only — sensitive credentials) -----

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpGet("slack")]
    public async Task<IActionResult> GetSlackSettings() => Ok(await slackSettings.GetAsync());

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPut("slack")]
    public async Task<IActionResult> SaveSlackSettings([FromBody] UpsertSlackSettingsDto dto)
    {
        var (ok, error) = await slackSettings.SaveAsync(dto, currentUser.UserId);
        if (!ok) return BadRequest(error);

        logger.LogInformation("Slack settings updated by user {UserId}.", currentUser.UserId);
        return Ok(await slackSettings.GetAsync());
    }

    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPost("slack/test")]
    public async Task<IActionResult> SendTestSlackMessage([FromBody] TestSlackRequestDto dto)
    {
        var toEmail = dto.ToEmail?.Trim();
        if (string.IsNullOrWhiteSpace(toEmail)) return BadRequest("A recipient email is required.");
        if (!MailAddress.TryCreate(toEmail, out _)) return BadRequest("That doesn't look like a valid email address.");
        try
        {
            await slackService.SendTestAsync(toEmail);
            return Ok(new TestSlackResultDto(true, null));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Test Slack DM to {ToEmail} failed.", toEmail);
            return Ok(new TestSlackResultDto(false, ex.Message));
        }
    }

    // ----- Role Applied -----

    /// <summary>
    /// Active users eligible to be a job opening's recruiter. Distinct from
    /// <c>/api/interviews/assignable-users</c> (every active user), which answers the interviewer
    /// question — assigning a recruiter only grants candidate access to Recruiter-and-above.
    /// </summary>
    [HttpGet("recruiter-options")]
    public async Task<IActionResult> GetRecruiterOptions() => Ok(await config.GetRecruiterOptionsAsync());

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles([FromQuery] bool includeInactive = false) =>
        Ok(includeInactive ? await config.GetAllRolesAsync() : await config.GetActiveRolesAsync());

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] UpsertRoleAppliedOptionDto dto)
    {
        var (created, conflict, error) = await config.CreateRoleAsync(dto, currentUser.UserId);
        if (error is not null) return BadRequest(error);
        if (conflict) return Conflict("A role with that name already exists.");

        logger.LogInformation("Created role option {Id} ('{Name}').", created!.Id, created.Name);
        await audit.RecordAsync("Role.Created", "Role", created.Id, $"Created role '{created.Name}' (#{created.Id})");
        return Ok(created);
    }

    [HttpPut("roles/{id:int}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpsertRoleAppliedOptionDto dto)
    {
        var (updated, notFound, conflict, error) = await config.UpdateRoleAsync(id, dto, currentUser.UserId);
        if (error is not null) return BadRequest(error);
        if (notFound) return NotFound();
        if (conflict) return Conflict("A role with that name already exists.");

        logger.LogInformation("Updated role option {Id}.", id);
        await audit.RecordAsync("Role.Updated", "Role", id, $"Updated role '{updated!.Name}' (#{id})");
        return Ok(updated);
    }

    // Only a Super Admin may delete a role (overrides the class-level Admin+ policy).
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpDelete("roles/{id:int}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var (found, deleted, deactivated, candidateCount) = await config.DeleteRoleAsync(id);
        if (!found) return NotFound();
        logger.LogInformation("Role option {Id} {Action} ({Count} candidates).",
            id, deleted ? "deleted" : "deactivated", candidateCount);
        await audit.RecordAsync("Role.Deleted", "Role", id,
            $"{(deleted ? "Deleted" : "Deactivated")} role #{id}" + (deactivated ? $" ({candidateCount} candidate(s))" : ""));
        return Ok(new { deleted, deactivated, candidateCount });
    }

    // ----- Candidate sources -----

    [HttpGet("sources")]
    public async Task<IActionResult> GetSources([FromQuery] bool includeInactive = false) =>
        Ok(includeInactive ? await config.GetAllSourcesAsync() : await config.GetActiveSourcesAsync());

    [HttpPost("sources")]
    public async Task<IActionResult> CreateSource([FromBody] UpsertCandidateSourceOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (created, conflict) = await config.CreateSourceAsync(dto);
        if (conflict) return Conflict("A source with that name already exists.");

        logger.LogInformation("Created candidate source {Id} ('{Name}').", created!.Id, created.Name);
        await audit.RecordAsync("Source.Created", "Source", created.Id, $"Created source '{created.Name}' (#{created.Id})");
        return Ok(created);
    }

    [HttpPut("sources/{id:int}")]
    public async Task<IActionResult> UpdateSource(int id, [FromBody] UpsertCandidateSourceOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (updated, notFound, conflict) = await config.UpdateSourceAsync(id, dto);
        if (notFound) return NotFound();
        if (conflict) return Conflict("A source with that name already exists.");

        logger.LogInformation("Updated candidate source {Id}.", id);
        await audit.RecordAsync("Source.Updated", "Source", id, $"Updated source '{updated!.Name}' (#{id})");
        return Ok(updated);
    }

    [HttpDelete("sources/{id:int}")]
    public async Task<IActionResult> DeleteSource(int id)
    {
        var (found, deleted, deactivated, candidateCount) = await config.DeleteSourceAsync(id);
        if (!found) return NotFound();

        logger.LogInformation("Candidate source {Id} {Action} ({Count} candidates).",
            id, deleted ? "deleted" : "deactivated", candidateCount);
        await audit.RecordAsync("Source.Deleted", "Source", id,
            $"{(deleted ? "Deleted" : "Deactivated")} source #{id}" + (deactivated ? $" ({candidateCount} candidate(s))" : ""));
        return Ok(new { deleted, deactivated, candidateCount });
    }

    // ----- Skills -----

    [HttpGet("skills")]
    public async Task<IActionResult> GetSkills([FromQuery] bool includeInactive = false) =>
        Ok(includeInactive ? await config.GetAllSkillsAsync() : await config.GetActiveSkillsAsync());

    [HttpPost("skills")]
    public async Task<IActionResult> CreateSkill([FromBody] UpsertSkillOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (created, conflict) = await config.CreateSkillAsync(dto);
        if (conflict) return Conflict("A skill with that name already exists.");

        logger.LogInformation("Created skill option {Id} ('{Name}').", created!.Id, created.Name);
        await audit.RecordAsync("Skill.Created", "Skill", created.Id, $"Created skill '{created.Name}' (#{created.Id})");
        return Ok(created);
    }

    [HttpPut("skills/{id:int}")]
    public async Task<IActionResult> UpdateSkill(int id, [FromBody] UpsertSkillOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (updated, notFound, conflict) = await config.UpdateSkillAsync(id, dto);
        if (notFound) return NotFound();
        if (conflict) return Conflict("A skill with that name already exists.");

        logger.LogInformation("Updated skill option {Id}.", id);
        await audit.RecordAsync("Skill.Updated", "Skill", id, $"Updated skill '{updated!.Name}' (#{id})");
        return Ok(updated);
    }

    [HttpDelete("skills/{id:int}")]
    public async Task<IActionResult> DeleteSkill(int id)
    {
        var ok = await config.DeleteSkillAsync(id);
        if (!ok) return NotFound();
        logger.LogInformation("Deleted/disabled skill option {Id}.", id);
        await audit.RecordAsync("Skill.Deleted", "Skill", id, $"Deleted/disabled skill #{id}");
        return NoContent();
    }

    // ----- Interview types -----

    [HttpGet("interview-types")]
    public async Task<IActionResult> GetInterviewTypes([FromQuery] bool includeInactive = false) =>
        Ok(includeInactive ? await config.GetAllInterviewTypesAsync() : await config.GetActiveInterviewTypesAsync());

    [HttpPost("interview-types")]
    public async Task<IActionResult> CreateInterviewType([FromBody] UpsertInterviewTypeOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (created, conflict) = await config.CreateInterviewTypeAsync(dto);
        if (conflict) return Conflict("An interview type with that name already exists.");

        logger.LogInformation("Created interview type option {Id} ('{Name}').", created!.Id, created.Name);
        await audit.RecordAsync("InterviewType.Created", "InterviewType", created.Id, $"Created interview type '{created.Name}' (#{created.Id})");
        return Ok(created);
    }

    [HttpPut("interview-types/{id:int}")]
    public async Task<IActionResult> UpdateInterviewType(int id, [FromBody] UpsertInterviewTypeOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");

        var (updated, notFound, conflict) = await config.UpdateInterviewTypeAsync(id, dto);
        if (notFound) return NotFound();
        if (conflict) return Conflict("An interview type with that name already exists.");

        logger.LogInformation("Updated interview type option {Id}.", id);
        await audit.RecordAsync("InterviewType.Updated", "InterviewType", id, $"Updated interview type '{updated!.Name}' (#{id})");
        return Ok(updated);
    }

    [HttpDelete("interview-types/{id:int}")]
    public async Task<IActionResult> DeleteInterviewType(int id)
    {
        var ok = await config.DeleteInterviewTypeAsync(id);
        if (!ok) return NotFound();
        logger.LogInformation("Deleted/disabled interview type option {Id}.", id);
        await audit.RecordAsync("InterviewType.Deleted", "InterviewType", id, $"Deleted/disabled interview type #{id}");
        return NoContent();
    }
}
