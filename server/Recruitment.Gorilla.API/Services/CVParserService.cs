using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace Recruitment.Gorilla.API.Services;

public record ParsedEducation(
    string Degree,
    string Institution,
    string? GraduationYear,
    string? Cgpa
);

public record ParsedExperience(
    string JobTitle,
    string Company,
    string? Duration,
    string? Description
);

public record ParsedCVResult(
    string? Name,
    string? Email,
    string? Phone,
    string? LinkedIn,
    string? Github,
    string? Skills,
    string? Summary,
    string? Location,
    string? LeetCode,
    string? Codeforces,
    string? HackerRank,
    string? GitLab,
    List<ParsedEducation> Educations,
    List<ParsedExperience> Experiences
);

public class CVParserService
{
    // Tolerates whitespace around '@' — some PDFs lay the address out as "name @ domain".
    private static readonly Regex EmailRegex =
        new(@"[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PhoneRegex =
        new(@"(\+?\d[\d\s\-().]{7,}\d)", RegexOptions.Compiled);

    private static readonly Regex LinkedInRegex =
        new(@"linkedin\.com/in/[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex GithubRegex =
        new(@"github\.com/[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex GitlabRegex =
        new(@"gitlab\.com/[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex LeetCodeRegex =
        new(@"leetcode\.com/(?:u/)?[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex CodeforcesRegex =
        new(@"codeforces\.com/(?:profile/)?[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex HackerRankRegex =
        new(@"hackerrank\.com/(?:profile/)?[\w\-.]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex CgpaRegex =
        new(@"(?:CGPA|GPA|Result)?\s*[:=\-]?\s*([0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0{1,2})?)?|[0-5]\.\d{1,2}(?:\s*\/\s*5(?:\.0{1,2})?)?)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex YearRegex =
        new(@"\b(19\d\d|20\d\d)\b", RegexOptions.Compiled);

    private static readonly Regex DateRangeRegex =
        new(@"(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}|\d+\s+Years?)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly string[] BdLocations =
    [
        "Dhaka", "Chattogram", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur",
        "Mymensingh", "Comilla", "Cumilla", "Gazipur", "Narayanganj", "Mirpur", "Uttara", "Gulshan",
        "Banani", "Dhanmondi", "Mohakhali", "Badda", "Mohammadpur", "Bashundhara", "Bangladesh"
    ];

    public ParsedCVResult Parse(string filePath, string fileType)
    {
        var hyperlinks = new List<string>();
        var text = fileType.ToUpperInvariant() switch
        {
            "PDF" => ExtractPdfText(filePath, hyperlinks),
            "TXT" => File.ReadAllText(filePath),
            _ => ExtractWordText(filePath)
        };
        return ExtractFields(text, hyperlinks);
    }

    private static string ExtractPdfText(string filePath, List<string> hyperlinks)
    {
        var sb = new StringBuilder();
        using var doc = PdfDocument.Open(filePath);
        foreach (Page page in doc.GetPages())
        {
            try
            {
                var words = page.GetWords().ToList();
                if (words.Count > 0)
                {
                    // Group words by Y-baseline coordinate to preserve line breaks accurately
                    var lines = words
                        .GroupBy(w => (int)Math.Round(w.BoundingBox.Bottom / 3.0) * 3)
                        .OrderByDescending(g => g.Key)
                        .Select(g => string.Join(" ", g.OrderBy(w => w.BoundingBox.Left).Select(w => w.Text)));
                    sb.AppendLine(NormalizeText(string.Join("\n", lines)));
                }
                else
                {
                    sb.AppendLine(NormalizeText(page.Text));
                }
            }
            catch
            {
                sb.AppendLine(NormalizeText(page.Text));
            }

            try
            {
                foreach (var link in page.GetHyperlinks())
                    if (!string.IsNullOrWhiteSpace(link.Uri))
                        hyperlinks.Add(NormalizeText(link.Uri));
            }
            catch
            {
                // Hyperlink extraction is best-effort; ignore malformed annotations.
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// A ligature the font failed to map, wedged between two letters.
    ///
    /// U+0000 is what PdfPig yields when a subsetted font's ToUnicode CMap has
    /// no entry for the glyph at all. U+20AC is what it yields when the CMap
    /// maps the glyph onto whatever codepoint held that slot in the original
    /// encoding. Both turn up as the missing "ti".
    /// See <see cref="NormalizeText"/>.
    /// </summary>
    private static readonly Regex UnmappedTiLigature =
        new(@"(?<=\p{L})[\u0000\u20AC](?=\p{L})", RegexOptions.Compiled);

    /// <summary>
    /// Control characters that carry no text. Whatever glyph they stood for is
    /// unrecoverable, and keeping them is worse than dropping them: a NUL is
    /// not valid text for anything downstream.
    /// </summary>
    private static readonly Regex StrayControlChars =
        new(@"[\u0000-\u0008\u000B\u000C\u000E-\u001F]", RegexOptions.Compiled);

    /// <summary>
    /// Repairs ligatures that a PDF's font reports as the wrong character.
    ///
    /// The U+FB0x replacements are the well-behaved case: the font uses the
    /// real Unicode ligature codepoints, and we just want the letters back.
    ///
    /// The unmapped-glyph rule is the misbehaving case. A subsetted font ships
    /// only the glyphs its document uses, and its ToUnicode CMap either omits
    /// an entry outright or points it at a leftover codepoint. Either way it is
    /// the "ti" ligature that goes missing, turning "Station" into "Sta?on",
    /// "initiatives" into "ini?a?ves" and "Education" into "Educa?on".
    ///
    /// A census of every CV already parsed into this database found 120 such
    /// characters, 118 of them plainly "ti" from the letters around them; the
    /// other two were words already beyond recovery. So the rule is
    /// evidence-based rather than certain, and it is deliberately narrow: a
    /// control character it does not claim is deleted rather than guessed at.
    ///
    /// The letter-on-BOTH-sides guard is what makes the euro half safe. A euro
    /// sign in a CV is a salary or a currency list - preceded by a space,
    /// followed by a digit - never wedged between two letters. Replacing
    /// unconditionally would corrupt those; this cannot.
    /// </summary>
    public static string NormalizeText(string text)
    {
        var normalized = text
            .Replace("\uFB00", "ff")
            .Replace("\uFB01", "fi")
            .Replace("\uFB02", "fl")
            .Replace("\uFB03", "ffi")
            .Replace("\uFB04", "ffl")
            .Replace("\uFB05", "st")
            .Replace("\uFB06", "st");

        normalized = UnmappedTiLigature.Replace(normalized, "ti");
        normalized = StrayControlChars.Replace(normalized, string.Empty);

        return normalized.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static string ExtractWordText(string filePath)
    {
        var sb = new StringBuilder();
        using var doc = WordprocessingDocument.Open(filePath, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        if (body is null) return string.Empty;
        foreach (var para in body.Descendants<DocumentFormat.OpenXml.Wordprocessing.Paragraph>())
            sb.AppendLine(para.InnerText);
        return sb.ToString();
    }

    private static ParsedCVResult ExtractFields(string text, List<string> hyperlinks)
    {
        var lines = text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var name = ExtractName(lines);

        var emailMatch = EmailRegex.Match(text);
        var email = emailMatch.Success ? emailMatch.Value.Replace(" ", "") : null;

        var phone = PhoneRegex.Match(text).Value.NullIfEmpty();

        var linkedin = MatchUrl(text, hyperlinks, LinkedInRegex);
        var github = MatchUrl(text, hyperlinks, GithubRegex);
        var gitlab = MatchUrl(text, hyperlinks, GitlabRegex);
        var leetcode = MatchUrl(text, hyperlinks, LeetCodeRegex);
        var codeforces = MatchUrl(text, hyperlinks, CodeforcesRegex);
        var hackerrank = MatchUrl(text, hyperlinks, HackerRankRegex);

        var location = ExtractLocation(lines);

        string? skills = null;
        string? summary = null;
        var educations = new List<ParsedEducation>();
        var experiences = new List<ParsedExperience>();

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line.Length > 50) continue;
            var lower = line.ToLower();

            // Skills Section
            if (skills is null && (lower.StartsWith("skills") || lower.StartsWith("technical skills") || lower.StartsWith("technologies") || lower.Contains("skills & technologies")))
            {
                var block = new StringBuilder();
                for (int j = i + 1; j < Math.Min(i + 12, lines.Length); j++)
                {
                    if (IsHeading(lines[j])) break;
                    block.AppendLine(lines[j]);
                }
                skills = block.ToString().Trim().NullIfEmpty();
            }

            // Summary Section
            if (summary is null && (lower.StartsWith("summary") || lower.StartsWith("professional summary") || lower.StartsWith("profile") || lower.StartsWith("about me") || lower.StartsWith("objective")))
            {
                var block = new StringBuilder();
                for (int j = i + 1; j < Math.Min(i + 10, lines.Length); j++)
                {
                    if (IsHeading(lines[j])) break;
                    block.AppendLine(lines[j]);
                }
                summary = block.ToString().Trim().NullIfEmpty();
            }

            // Education Section
            if (educations.Count == 0 && (lower.StartsWith("education") || lower.StartsWith("academics") || lower.StartsWith("academic background") || lower.StartsWith("educational qualification")))
            {
                var eduLines = new List<string>();
                for (int j = i + 1; j < Math.Min(i + 15, lines.Length); j++)
                {
                    if (IsHeading(lines[j])) break;
                    eduLines.Add(lines[j]);
                }
                educations = ParseEducationLines(eduLines);
            }

            // Experience Section
            if (experiences.Count == 0 && (lower.StartsWith("experience") || lower.StartsWith("professional experience") || lower.StartsWith("work experience") || lower.StartsWith("employment history") || lower.StartsWith("work history")))
            {
                var expLines = new List<string>();
                for (int j = i + 1; j < Math.Min(i + 25, lines.Length); j++)
                {
                    if (IsHeading(lines[j])) break;
                    expLines.Add(lines[j]);
                }
                experiences = ParseExperienceLines(expLines);
            }
        }

        return new ParsedCVResult(
            name, email, phone, linkedin, github, skills, summary,
            location, leetcode, codeforces, hackerrank, gitlab,
            educations, experiences
        );
    }

    private static string? ExtractLocation(string[] lines)
    {
        // Check first 10 header lines
        for (int i = 0; i < Math.Min(10, lines.Length); i++)
        {
            var line = lines[i];
            foreach (var loc in BdLocations)
            {
                if (Regex.IsMatch(line, $@"\b{loc}\b", RegexOptions.IgnoreCase))
                {
                    // If the line is short (typical location line like "Mirpur, Dhaka, Bangladesh"), return the cleaned line
                    if (line.Length <= 50 && !line.Contains('@'))
                        return line.Trim();
                    return loc;
                }
            }
        }
        return null;
    }

    private static List<ParsedEducation> ParseEducationLines(List<string> lines)
    {
        var list = new List<ParsedEducation>();
        if (lines.Count == 0) return list;

        string? currentDegree = null;
        string? currentInst = null;
        string? currentYear = null;
        string? currentCgpa = null;

        void Flush()
        {
            if (!string.IsNullOrWhiteSpace(currentDegree) || !string.IsNullOrWhiteSpace(currentInst))
            {
                if (!string.IsNullOrWhiteSpace(currentDegree) && string.IsNullOrWhiteSpace(currentInst))
                {
                    var parts = Regex.Split(currentDegree, @"\s*(?:—|–|[-|]|(?<=\s)at(?=\s))\s*", RegexOptions.IgnoreCase);
                    if (parts.Length >= 2)
                    {
                        currentDegree = parts[0].Trim();
                        currentInst = parts[1].Trim();
                    }
                }

                if (!string.IsNullOrWhiteSpace(currentYear))
                {
                    if (currentInst != null) currentInst = currentInst.Replace($"({currentYear})", "").Replace(currentYear, "").Trim(' ', '(', ')', '-', '—');
                    if (currentDegree != null) currentDegree = currentDegree.Replace($"({currentYear})", "").Replace(currentYear, "").Trim(' ', '(', ')', '-', '—');
                }

                list.Add(new ParsedEducation(
                    currentDegree ?? "Bachelor of Science",
                    currentInst ?? "University",
                    currentYear,
                    currentCgpa
                ));
                currentDegree = null;
                currentInst = null;
                currentYear = null;
                currentCgpa = null;
            }
        }

        foreach (var line in lines)
        {
            var lower = line.ToLower();

            // Look for CGPA
            var cgpaMatch = CgpaRegex.Match(line);
            if (cgpaMatch.Success && currentCgpa == null && (lower.Contains("cgpa") || lower.Contains("gpa") || lower.Contains("3.") || lower.Contains("4.") || lower.Contains("5.")))
            {
                currentCgpa = cgpaMatch.Groups[1].Value.Trim();
            }

            // Look for year
            var yearMatch = YearRegex.Match(line);
            if (yearMatch.Success && currentYear == null)
            {
                currentYear = yearMatch.Value;
            }

            // Degree detection
            if (lower.Contains("bachelor") || lower.Contains("b.sc") || lower.Contains("bsc") ||
                lower.Contains("master") || lower.Contains("m.sc") || lower.Contains("msc") ||
                lower.Contains("bba") || lower.Contains("mba") || lower.Contains("hsc") ||
                lower.Contains("ssc") || lower.Contains("diploma") || lower.Contains("engineering") ||
                lower.Contains("computer science") || lower.Contains("cse") || lower.Contains("swe") || lower.Contains("eee"))
            {
                if (currentDegree != null && currentInst != null) Flush();
                currentDegree ??= line.Trim();
            }
            // Institution detection
            else if (lower.Contains("university") || lower.Contains("institute") || lower.Contains("college") ||
                     lower.Contains("buet") || lower.Contains("du") || lower.Contains("nsu") ||
                     lower.Contains("brac") || lower.Contains("iut") || lower.Contains("aust") ||
                     lower.Contains("aiub") || lower.Contains("sust") || lower.Contains("ewu") || lower.Contains("uiu"))
            {
                if (currentInst != null && currentDegree != null) Flush();
                currentInst ??= line.Trim();
            }
        }

        Flush();

        // Fallback: if we found some lines but couldn't segment, create one item
        if (list.Count == 0 && lines.Count > 0)
        {
            var first = lines[0];
            var second = lines.Count > 1 ? lines[1] : null;
            list.Add(new ParsedEducation(first, second ?? "University", null, null));
        }

        return list;
    }

    private static List<ParsedExperience> ParseExperienceLines(List<string> lines)
    {
        var list = new List<ParsedExperience>();
        if (lines.Count == 0) return list;

        string? currentTitle = null;
        string? currentCompany = null;
        string? currentDuration = null;
        var descSb = new StringBuilder();

        void Flush()
        {
            if (!string.IsNullOrWhiteSpace(currentTitle) || !string.IsNullOrWhiteSpace(currentCompany))
            {
                list.Add(new ParsedExperience(
                    currentTitle ?? "Software Engineer",
                    currentCompany ?? "Company",
                    currentDuration,
                    descSb.ToString().Trim().NullIfEmpty()
                ));
                currentTitle = null;
                currentCompany = null;
                currentDuration = null;
                descSb.Clear();
            }
        }

        foreach (var line in lines)
        {
            var dateMatch = DateRangeRegex.Match(line);
            if (dateMatch.Success)
            {
                if (currentTitle != null || currentCompany != null) Flush();

                currentDuration = dateMatch.Value.Trim();
                var remaining = line.Replace(dateMatch.Value, "").Trim(' ', '|', '-', '–', ',', '(', ')');
                if (!string.IsNullOrWhiteSpace(remaining))
                {
                    var parts = Regex.Split(remaining, @"\s*(?:—|–|[-|]|(?<=\s)at(?=\s))\s*", RegexOptions.IgnoreCase);
                    if (parts.Length >= 2)
                    {
                        currentTitle = parts[0].Trim();
                        currentCompany = parts[1].Trim();
                    }
                    else
                    {
                        if (currentTitle == null) currentTitle = remaining;
                        else currentCompany ??= remaining;
                    }
                }
                continue;
            }

            if (line.StartsWith("•") || line.StartsWith("-") || line.StartsWith("*") || line.StartsWith("–"))
            {
                descSb.AppendLine(line.Trim());
            }
            else if (currentTitle == null)
            {
                currentTitle = line.Trim();
            }
            else if (currentCompany == null)
            {
                currentCompany = line.Trim();
            }
            else
            {
                descSb.AppendLine(line.Trim());
            }
        }

        Flush();

        return list;
    }

    private static string? MatchUrl(string text, List<string> hyperlinks, Regex regex)
    {
        var match = regex.Match(text);
        if (match.Success) return match.Value;
        return hyperlinks.Select(h => regex.Match(h)).FirstOrDefault(m => m.Success)?.Value;
    }

    private static string? ExtractName(string[] lines)
    {
        if (lines.Length == 0) return null;

        for (int i = 0; i < Math.Min(5, lines.Length); i++)
        {
            var line = lines[i].Trim();
            if (line.Length is > 1 and <= 50 &&
                !line.Contains('@') &&
                !line.Contains("http", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains(".com", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains("Email", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains("Phone", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains("Curriculum", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains("Resume", StringComparison.OrdinalIgnoreCase) &&
                !IsHeading(line) &&
                !line.Any(char.IsDigit))
            {
                return line;
            }
        }

        return lines.FirstOrDefault(l => l.Length is > 2 and <= 40 && !l.Contains('@') && !l.Any(char.IsDigit));
    }

    public static (string Name, string? Title) ParseNameAndTitleFromFileName(string fileName)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName);
        var parts = baseName.Split(['_', '-'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length >= 2)
        {
            var name = $"{parts[0]} {parts[1]}";
            var title = parts.Length > 2 ? string.Join(' ', parts.Skip(2)) : null;
            return (name, title);
        }
        return (baseName.Replace('_', ' '), null);
    }

    private static bool IsHeading(string line) =>
        Regex.IsMatch(line.Trim(), @"^(EDUCATION|ACADEMIC|ACADEMICS|EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s+EXPERIENCE|SKILLS|TECHNICAL\s+SKILLS|TECHNOLOGIES|PROJECTS|KEY\s+PROJECTS|PUBLICATIONS|CERTIFICATIONS|ACHIEVEMENTS|SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|OBJECTIVE)\b", RegexOptions.IgnoreCase);
}

file static class StringExtensions
{
    public static string? NullIfEmpty(this string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
