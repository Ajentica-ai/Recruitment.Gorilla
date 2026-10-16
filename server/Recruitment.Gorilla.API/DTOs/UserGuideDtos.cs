namespace Recruitment.Gorilla.API.DTOs;

/// <summary>One chapter of the user guide, as Markdown.</summary>
public record UserGuideChapterDto(string Id, string Title, string Markdown);

/// <summary>
/// The user guide cut to one reader's edition. <see cref="Edition"/> is the lowest-case token
/// ("interviewer", "recruiter", "admin", "superadmin"); <see cref="Label"/> is the display name.
/// </summary>
public record UserGuideDto(string Edition, string Label, IReadOnlyList<UserGuideChapterDto> Chapters);
