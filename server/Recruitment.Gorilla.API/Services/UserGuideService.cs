using System.Collections.Concurrent;
using System.Text;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Serves the user guide cut to the reader's role. The guide is one Markdown file per chapter,
/// embedded in the assembly (see the csproj's <c>UserGuide\*.md</c> item) so there is no file path
/// to resolve at runtime and nothing to go missing from a published or containerized build.
///
/// Each reader's edition is the cumulative set of chapters their highest role reaches; a chapter
/// below that reader's rank is simply never read into the response. Filtering happens here, not in
/// the browser, so a restricted chapter is never sent to a reader who should not have it.
/// </summary>
public class UserGuideService
{
    private readonly record struct Chapter(string Id, string File, int MinRank);

    // Order here is the order chapters are returned in. "intro" and the appendix are rank 0
    // (every signed-in reader, same as the Interviewer edition) because they carry no
    // role-specific instructions.
    private static readonly Chapter[] Manifest =
    [
        new("intro", "intro.md", 0),
        new("chapter-0", "chapter-0-getting-started.md", 0),
        new("chapter-1", "chapter-1-interviewer.md", 0),
        new("chapter-2", "chapter-2-recruiter.md", 1),
        new("chapter-3", "chapter-3-admin.md", 2),
        new("chapter-4", "chapter-4-super-admin.md", 3),
        new("chapter-5", "chapter-5-appendix.md", 0),
    ];

    private static readonly string[] EditionByRank = ["interviewer", "recruiter", "admin", "superadmin"];

    private readonly ConcurrentDictionary<string, Lazy<UserGuideDto>> _cache = new();

    public UserGuideDto Get(IReadOnlyCollection<string> roles)
    {
        var edition = EditionFor(roles);
        return _cache.GetOrAdd(edition, static e => new Lazy<UserGuideDto>(() => Build(e))).Value;
    }

    /// <summary>
    /// The highest role present decides the edition. A user with no roles at all (or only roles
    /// outside the four named here) gets the Interviewer edition rather than an error, matching
    /// what an Interviewer-only account sees.
    /// </summary>
    public static string EditionFor(IReadOnlyCollection<string> roles)
    {
        if (roles.Contains(Roles.SuperAdmin)) return "superadmin";
        if (roles.Contains(Roles.Admin)) return "admin";
        if (roles.Contains(Roles.Recruiter)) return "recruiter";
        return "interviewer";
    }

    private static int RankOf(string edition) => Array.IndexOf(EditionByRank, edition);

    private static string LabelFor(string edition) => edition switch
    {
        "recruiter" => "Recruiter edition",
        "admin" => "Admin edition",
        "superadmin" => "Super Admin edition",
        _ => "Interviewer edition",
    };

    private static UserGuideDto Build(string edition)
    {
        var rank = RankOf(edition);
        var chapters = Manifest
            .Where(c => c.MinRank <= rank)
            .Select(c => LoadChapter(c.Id, c.File))
            .ToList();
        return new UserGuideDto(edition, LabelFor(edition), chapters);
    }

    private static UserGuideChapterDto LoadChapter(string id, string fileName)
    {
        var markdown = ReadResource(fileName);
        var title = FirstHeading(markdown) ?? fileName;
        return new UserGuideChapterDto(id, title, markdown);
    }

    private static string? FirstHeading(string markdown)
    {
        foreach (var line in markdown.Split('\n'))
        {
            var trimmed = line.TrimStart();
            if (trimmed.StartsWith("# ", StringComparison.Ordinal))
                return trimmed[2..].Trim();
        }
        return null;
    }

    private static string ReadResource(string fileName)
    {
        var logicalName = $"UserGuide.{fileName}";
        using var stream = typeof(UserGuideService).Assembly.GetManifestResourceStream(logicalName)
            ?? throw new InvalidOperationException($"User guide resource '{logicalName}' is missing.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd().Replace("\r\n", "\n");
    }
}
