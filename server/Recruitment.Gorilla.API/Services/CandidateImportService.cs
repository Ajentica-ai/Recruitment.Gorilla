using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>What validation made of one import entry: why it can't be imported, what the reviewer should
/// look at, and the role and source its names resolved to.</summary>
public record ImportValidation(List<string> Errors, List<string> Warnings, int? RoleAppliedOptionId, int? SourceOptionId);

/// <summary>
/// Turns candidates described in a JSON import file into Pending drafts, so they go through the same
/// Review Workspace as parsed CVs. The JSON is the source of truth: the CV is stored but not parsed.
/// Also produces the downloadable template, whose comments tell a person or an AI how to fill it in.
/// </summary>
public class CandidateImportService(
    AppDbContext db,
    CandidateDraftService draftService,
    CandidateService candidateService,
    AuditService audit)
{
    /// <summary>The relevant-experience presets the review form offers; keep in step with
    /// EXPERIENCE_PRESETS in client/src/components/drafts/DraftReviewWorkspace.tsx.</summary>
    public static readonly string[] ExperiencePresets = ["< 1 Year", "1-2 Years", "3-5 Years", "5-8 Years", "8+ Years"];

    /// <summary>Accepts what the template allows a person or an AI to write: comments, trailing commas, any
    /// key casing, and numbers where text is expected.</summary>
    public static readonly JsonSerializerOptions ReadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        Converters = { new LenientStringConverter() },
    };

    // Column limits from AppDbContext (the tighter of the draft and candidate columns), checked up front so
    // an over-long value is a readable error on its entry instead of a database failure.
    private static readonly (string Label, Func<ImportCandidateEntryDto, string?> Get, int Max)[] FieldLimits =
    [
        ("cvFileName", e => e.CvFileName, 255),
        ("email", e => e.Email, 200),
        ("phone", e => e.Phone, 50),
        ("currentTitle", e => e.CurrentTitle, 200),
        ("relevantExperience", e => e.RelevantExperience, 100),
        ("location", e => e.Location, 200),
        ("sourceDetail", e => e.SourceDetail, 300),
        ("linkedInUrl", e => e.LinkedInUrl, 500),
        ("githubUrl", e => e.GithubUrl, 500),
        ("gitLabUrl", e => e.GitLabUrl, 500),
        ("portfolioUrl", e => e.PortfolioUrl, 500),
        ("leetCodeUrl", e => e.LeetCodeUrl, 500),
        ("codeforcesUrl", e => e.CodeforcesUrl, 500),
        ("hackerRankUrl", e => e.HackerRankUrl, 500),
        // Free text has no column limit on the draft, but a bounded size keeps the review UI usable.
        ("summary", e => e.Summary, 4000),
        ("skills", e => e.Skills, 2000),
    ];

    /// <summary>One candidate is a few KB; anything far larger is not a real entry.</summary>
    public const int MaxEntryLength = 256 * 1024;
    public const int MaxRowsPerList = 50;
    // CandidateExperience.Description is a MySQL `text` column (64 KB); 4000 characters fits in any encoding.
    private const int MaxDescriptionLength = 4000;

    /// <summary>Reads one entry, or explains why the JSON can't be read.</summary>
    public static (ImportCandidateEntryDto? Entry, string? Error) ParseEntry(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (null, "No candidate entry provided.");
        if (json.Length > MaxEntryLength) return (null, "The candidate entry is too large.");
        try
        {
            var entry = JsonSerializer.Deserialize<ImportCandidateEntryDto>(json, ReadOptions);
            return entry is null ? (null, "The candidate entry is empty.") : (Normalize(entry), null);
        }
        catch (JsonException ex)
        {
            return (null, $"The candidate entry is not valid JSON: {ex.Message}");
        }
    }

    /// <summary>Trims every value, turns blanks into nulls, and drops education/experience rows left empty
    /// (the template ships with one empty row of each as an example).</summary>
    private static ImportCandidateEntryDto Normalize(ImportCandidateEntryDto e) => e with
    {
        CvFileName = Clean(e.CvFileName),
        FullName = Clean(e.FullName),
        Email = Clean(e.Email),
        Phone = Clean(e.Phone),
        CurrentTitle = Clean(e.CurrentTitle),
        RelevantExperience = Clean(e.RelevantExperience),
        Location = Clean(e.Location),
        Role = Clean(e.Role),
        Source = Clean(e.Source),
        SourceDetail = Clean(e.SourceDetail),
        Skills = Clean(e.Skills),
        Summary = Clean(e.Summary),
        LinkedInUrl = Clean(e.LinkedInUrl),
        GithubUrl = Clean(e.GithubUrl),
        GitLabUrl = Clean(e.GitLabUrl),
        PortfolioUrl = Clean(e.PortfolioUrl),
        LeetCodeUrl = Clean(e.LeetCodeUrl),
        CodeforcesUrl = Clean(e.CodeforcesUrl),
        HackerRankUrl = Clean(e.HackerRankUrl),
        Educations = e.Educations?
            .Where(x => x is not null)
            .Select(x => new ImportEducationDto(Clean(x.Degree), Clean(x.Institution), Clean(x.GraduationYear), Clean(x.Cgpa)))
            .Where(x => x.Degree is not null || x.Institution is not null || x.GraduationYear is not null || x.Cgpa is not null)
            .ToList(),
        Experiences = e.Experiences?
            .Where(x => x is not null)
            .Select(x => new ImportExperienceDto(Clean(x.JobTitle), Clean(x.Company), Clean(x.Duration), Clean(x.Description)))
            .Where(x => x.JobTitle is not null || x.Company is not null || x.Duration is not null || x.Description is not null)
            .ToList(),
    };

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// A caller-supplied value made safe to echo into a message, a log line or the template: control
    /// characters (newlines included) become spaces, so it can't forge a line, and it is cut to length.
    /// </summary>
    public static string Shorten(string? value, int max = 80)
    {
        if (value is null) return "";
        var flat = new string(value.Select(c => char.IsControl(c) ? ' ' : c).ToArray());
        return flat.Length <= max ? flat : flat[..max] + "...";
    }

    /// <summary>
    /// Errors reject the entry. Warnings don't: a role or source that doesn't resolve is left blank for the
    /// reviewer to pick, and an email already on file is flagged because approving a draft doesn't check it.
    /// </summary>
    public async Task<ImportValidation> ValidateAsync(ImportCandidateEntryDto entry, int? defaultRoleAppliedOptionId = null)
    {
        var errors = new List<string>();
        var warnings = new List<string>();

        if (entry.CvFileName is null) errors.Add("cvFileName is required.");

        var nameError = PersonNameValidator.Validate(entry.FullName, "fullName");
        if (nameError is not null) errors.Add(nameError);

        if (entry.Email is null) errors.Add("email is required.");
        else if (!EmailFormat.IsValid(entry.Email)) errors.Add($"email '{Shorten(entry.Email)}' is not a valid email address.");

        foreach (var (label, get, max) in FieldLimits)
            if (get(entry) is { Length: var length } && length > max)
                errors.Add($"{label} must be {max} characters or less.");

        foreach (var (edu, i) in (entry.Educations ?? []).Select((x, i) => (x, i + 1)))
        {
            if (edu.Degree is null || edu.Institution is null)
                errors.Add($"educations[{i}] needs both degree and institution.");
            if (edu.Degree?.Length > 200 || edu.Institution?.Length > 200 || edu.GraduationYear?.Length > 50 || edu.Cgpa?.Length > 50)
                errors.Add($"educations[{i}] has a value that is too long.");
        }

        foreach (var (exp, i) in (entry.Experiences ?? []).Select((x, i) => (x, i + 1)))
        {
            if (exp.JobTitle is null || exp.Company is null)
                errors.Add($"experiences[{i}] needs both jobTitle and company.");
            if (exp.JobTitle?.Length > 200 || exp.Company?.Length > 200 || exp.Duration?.Length > 100
                || exp.Description?.Length > MaxDescriptionLength)
                errors.Add($"experiences[{i}] has a value that is too long.");
        }

        if (entry.Educations?.Count > MaxRowsPerList) errors.Add($"educations can have at most {MaxRowsPerList} items.");
        if (entry.Experiences?.Count > MaxRowsPerList) errors.Add($"experiences can have at most {MaxRowsPerList} items.");

        if (entry.UnknownKeys is { Count: > 0 } unknown)
        {
            var shown = string.Join(", ", unknown.Keys.Take(10).Select(k => Shorten(k, 40)));
            var more = unknown.Count > 10 ? $" and {unknown.Count - 10} more" : "";
            warnings.Add($"Ignored unknown key(s): {shown}{more}.");
        }

        var roleId = await ResolveRoleAsync(entry.Role, defaultRoleAppliedOptionId, warnings);
        var sourceId = await ResolveSourceAsync(entry.Source, warnings);

        if (entry.Email is not null && EmailFormat.IsValid(entry.Email))
        {
            var existing = await candidateService.FindDuplicateAsync(entry.Email);
            if (existing is not null)
                warnings.Add($"A candidate with this email already exists ({existing.FullName}, #{existing.Id}).");
            else if (await db.CandidateDrafts.AnyAsync(d => d.Status == "Pending" && d.Email == entry.Email))
                warnings.Add("A pending draft with this email is already waiting for review.");
        }

        return new ImportValidation(errors, warnings, roleId, sourceId);
    }

    private async Task<int?> ResolveRoleAsync(string? roleName, int? defaultRoleId, List<string> warnings)
    {
        var now = DateTime.UtcNow;
        if (roleName is not null)
        {
            // Names are not unique: a reopened position can share its name with a closed one, so prefer an open match.
            var matches = await db.RoleAppliedOptions.Where(r => r.Name.ToLower() == roleName.ToLower()).ToListAsync();
            var role = matches.FirstOrDefault(r => r.IsActive && r.EndDate >= now) ?? matches.FirstOrDefault();

            string? problem = null;
            if (role is null) problem = $"No job opening is named '{Shorten(roleName)}'";
            else if (!role.IsActive) problem = $"Job opening '{role.Name}' is not active";
            else if (role.EndDate < now) problem = $"Job opening '{role.Name}' closed on {role.EndDate:yyyy-MM-dd}";
            else return role.Id;

            // The entry's own role didn't resolve: fall back to the batch's default opening (required at
            // the controller) rather than leaving the entry with no role at all.
            warnings.Add(defaultRoleId is int
                ? $"{problem}; using the batch's job opening instead."
                : $"{problem}; pick the role in review.");
        }

        if (defaultRoleId is int id)
        {
            if (await db.RoleAppliedOptions.AnyAsync(r => r.Id == id && r.IsActive && r.EndDate >= now)) return id;
            warnings.Add("The selected job opening is not open; pick the role in review.");
        }
        return null;
    }

    private async Task<int?> ResolveSourceAsync(string? sourceName, List<string> warnings)
    {
        if (sourceName is null) return null;
        var matches = await db.CandidateSourceOptions.Where(s => s.Name.ToLower() == sourceName.ToLower()).ToListAsync();
        var source = matches.FirstOrDefault(s => s.IsActive) ?? matches.FirstOrDefault();
        if (source is null) warnings.Add($"No source is named '{Shorten(sourceName)}'; pick the source in review.");
        else if (!source.IsActive) warnings.Add($"Source '{source.Name}' is not active; pick the source in review.");
        else return source.Id;
        return null;
    }

    /// <summary>Saves a validated entry and its stored CV as a Pending draft owned by the caller.</summary>
    public async Task<CVDraftDto> CreateDraftAsync(
        ImportCandidateEntryDto entry, ImportValidation validation, StoredCvFile file, string? batchId, string? batchName)
    {
        var educations = entry.Educations?
            .Select((e, i) => new CandidateEducationDto(i + 1, e.Degree!, e.Institution!, e.GraduationYear, e.Cgpa))
            .ToList() ?? [];
        var experiences = entry.Experiences?
            .Select((e, i) => new CandidateExperienceDto(i + 1, e.JobTitle!, e.Company!, e.Duration, e.Description))
            .ToList() ?? [];

        var draft = await draftService.AddDraftAsync(new CandidateDraft
        {
            OriginalFileName = file.OriginalFileName,
            StoredFileName = file.StoredFileName,
            FileType = file.FileType,
            FileSizeBytes = file.FileSizeBytes,
            FileHash = file.FileHash,
            BatchId = batchId,
            BatchName = batchName,
            FullName = entry.FullName,
            Email = entry.Email,
            Phone = entry.Phone,
            CurrentTitle = entry.CurrentTitle,
            RelevantExperience = entry.RelevantExperience,
            Skills = entry.Skills,
            Summary = entry.Summary,
            LinkedInUrl = entry.LinkedInUrl,
            GithubUrl = entry.GithubUrl,
            PortfolioUrl = entry.PortfolioUrl,
            Location = entry.Location,
            LeetCodeUrl = entry.LeetCodeUrl,
            CodeforcesUrl = entry.CodeforcesUrl,
            HackerRankUrl = entry.HackerRankUrl,
            GitLabUrl = entry.GitLabUrl,
            RoleAppliedOptionId = validation.RoleAppliedOptionId,
            SourceOptionId = validation.SourceOptionId,
            SourceDetail = entry.SourceDetail,
            EducationJson = educations.Count > 0 ? JsonSerializer.Serialize(educations) : null,
            ExperienceJson = experiences.Count > 0 ? JsonSerializer.Serialize(experiences) : null,
        });

        await audit.RecordAsync(
            action: "CandidateDraft.ImportedFromJson",
            entityType: nameof(CandidateDraft),
            entityId: draft.Id,
            // AuditLog.Summary is 400 characters; a longer one would fail the whole audit batch it is written in.
            summary: $"Imported draft {draft.Id} ('{Shorten(draft.FullName, 100)}') from JSON with CV '{Shorten(file.OriginalFileName, 120)}'.");

        return new CVDraftDto(
            draft.FullName, draft.Email, draft.Phone, draft.CurrentTitle, draft.Skills, draft.Summary,
            draft.LinkedInUrl, draft.GithubUrl, draft.OriginalFileName, draft.StoredFileName, draft.FileType,
            draft.FileSizeBytes, draft.Id, draft.BatchId, draft.BatchName, draft.Location,
            draft.LeetCodeUrl, draft.CodeforcesUrl, draft.HackerRankUrl, draft.GitLabUrl,
            educations, experiences);
    }

    /// <summary>
    /// The template with today's open job openings and active sources written into its instructions, so a
    /// person or an AI filling it in can only pick names that will resolve.
    /// </summary>
    public async Task<string> BuildTemplateAsync()
    {
        var now = DateTime.UtcNow;
        var roles = await db.RoleAppliedOptions
            .Where(r => r.IsActive && r.EndDate >= now)
            .OrderBy(r => r.SortOrder).ThenBy(r => r.Name)
            .Select(r => r.Name)
            .ToListAsync();
        var sources = await db.CandidateSourceOptions
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => s.Name)
            .ToListAsync();

        return ReadTemplateResource()
            .Replace("{{GENERATED}}", now.ToString("yyyy-MM-dd"))
            .Replace("{{EXPERIENCE}}", string.Join(", ", ExperiencePresets.Select(p => $"\"{p}\"")))
            .Replace("{{ROLES}}", CommentList(roles, "(no open job openings; use null)"))
            .Replace("{{SOURCES}}", CommentList(sources, "(no active sources; use null)"));
    }

    // Each name on its own comment line. The names are admin-entered and the template is read by an AI, so
    // a newline (which could forge an extra instruction line) is flattened, and "*/" (which would end the
    // comment block early) is broken up.
    private static string CommentList(List<string> names, string whenEmpty) =>
        names.Count == 0
            ? $" *   {whenEmpty}"
            : string.Join("\n", names.Select(n => $" *   - \"{Shorten(n, 150).Replace("*/", "* /")}\""));

    private static string ReadTemplateResource()
    {
        using var stream = typeof(CandidateImportService).Assembly.GetManifestResourceStream("CandidateImportTemplate")
            ?? throw new InvalidOperationException("The candidate import template resource is missing.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd().Replace("\r\n", "\n");
    }
}
