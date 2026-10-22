using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Route("api/evaluation-rubrics")]
[Authorize]
public class EvaluationRubricsController(
    EvaluationRubricService rubricService,
    InterviewService interviewService,
    CurrentUser currentUser) : ControllerBase
{
    // The id lives in the "sub" claim, which CurrentUser reads. This used to look for NameIdentifier, which is never
    // set because inbound claim mapping is off, so it was always 0 (#201).
    private int CurrentUserId => currentUser.UserId ?? 0;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await rubricService.GetAllAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var rubric = await rubricService.GetByIdAsync(id);
        return rubric is null ? NotFound() : Ok(rubric);
    }

    [HttpGet("for-interview/{interviewId:int}")]
    public async Task<IActionResult> GetForInterview(int interviewId)
    {
        // Scoped like the rest of /api/interviews/*: a caller who may not open the interview gets the same 404 as for
        // one that does not exist (#201).
        if (!await interviewService.CanReadInterviewRubricAsync(
                interviewId,
                CurrentUserId,
                currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin),
                currentUser.IsInRole(Roles.Recruiter)))
            return NotFound();

        var rubric = await rubricService.GetForInterviewAsync(interviewId);
        return rubric is null ? NotFound() : Ok(rubric);
    }

    [HttpPost]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public async Task<IActionResult> Create([FromBody] UpsertEvaluationRubricDto dto)
    {
        var (rubric, error, conflict) = await rubricService.CreateAsync(dto, CurrentUserId);
        if (conflict) return Conflict(new { message = error });
        if (error is not null) return BadRequest(new { message = error });
        return CreatedAtAction(nameof(GetById), new { id = rubric!.Id }, rubric);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertEvaluationRubricDto dto)
    {
        var (rubric, error, notFound, conflict) = await rubricService.UpdateAsync(id, dto, CurrentUserId);
        if (notFound) return NotFound();
        if (conflict) return Conflict(new { message = error });
        if (error is not null) return BadRequest(new { message = error });
        return Ok(rubric);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public async Task<IActionResult> Delete(int id)
    {
        var (success, error, notFound) = await rubricService.DeleteAsync(id, CurrentUserId);
        if (notFound) return NotFound();
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }

    [HttpPost("{id:int}/clone")]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public async Task<IActionResult> Clone(int id)
    {
        var (rubric, error, notFound) = await rubricService.CloneAsync(id, CurrentUserId);
        if (notFound) return NotFound();
        if (error is not null) return BadRequest(new { message = error });
        return Ok(rubric);
    }

    [HttpPost("{id:int}/default")]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public async Task<IActionResult> SetDefault(int id)
    {
        var (success, error, notFound) = await rubricService.SetDefaultAsync(id, CurrentUserId);
        if (notFound) return NotFound();
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }
}
