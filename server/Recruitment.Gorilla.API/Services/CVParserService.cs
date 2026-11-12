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

/// <summary>
/// StartMonth/EndMonth are "yyyy-MM" and both inclusive. A null EndMonth with a StartMonth means the role is ongoing.
/// Both are null when the dates could not be read; <see cref="Duration"/> stays the text the reviewer sees.
/// </summary>
public record ParsedExperience(
    string JobTitle,
    string Company,
    string? Duration,
    string? Description,
    string? StartMonth = null,
    string? EndMonth = null
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

    private const string MonthName =
        @"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b\.?";

    // One end of a date range: MM/YYYY, YYYY-MM, "Mon YYYY", "Mon 'YY", a bare year, or a bare 'YY.
    private const string DatePoint =
        @"(?:(?:0?[1-9]|1[0-2])/(?:19|20)\d{2}" +
        @"|(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?!\d)" +
        @"|" + MonthName + @",?\s*(?:(?:19|20)\d{2}|['’]\d{2})" +
        @"|(?:19|20)\d{2}" +
        @"|['’]\d{2})";

    private const string OpenEnd =
        @"(?:Present|Current(?:ly)?|Now|Ongoing|Today|(?:Till|Until|To)\s+(?:date|now|today|present)|date)";

    private static readonly Regex DateRangeRegex =
        new(@"(?<![\d/])(?<start>" + DatePoint + @")\s*(?:[-–\u2014]|\bto\b|\buntil\b|\btill\b)\s*(?<end>" + OpenEnd + @"\b|" + DatePoint + @")",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex OpenEndRegex =
        new("^" + OpenEnd + "$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PointNumericMonthFirstRegex =
        new(@"^(\d{1,2})/((?:19|20)\d{2})$", RegexOptions.Compiled);

    private static readonly Regex PointNumericYearFirstRegex =
        new(@"^((?:19|20)\d{2})-(\d{2})$", RegexOptions.Compiled);

    private static readonly Regex PointNamedRegex =
        new(@"^(?:([A-Za-z]+)\.?,?\s*)?(?:((?:19|20)\d{2})|['’](\d{2}))$", RegexOptions.Compiled);

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
                for (int j = i + 1; j < lines.Length; j++)
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

    private static readonly Regex HeaderSeparatorRegex =
        new(@"\s*(?:\u2014|–|[-|]|(?<=\s)at(?=\s))\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsBullet(string line) =>
        line.StartsWith("•") || line.StartsWith("-") || line.StartsWith("*") || line.StartsWith("–");

    private static string TextAroundDate(string line, Match dateMatch) =>
        line.Replace(dateMatch.Value, "").Trim(' ', '|', '-', '–', '\u2014', ',', '(', ')');

    // True when one of the next two lines is a date that closes a header written over several lines
    // (title, company, date). A date inside a full "Title - Company (dates)" line starts its own role instead.
    private static bool StartsRoleHeader(List<string> lines, int index)
    {
        for (var k = 1; k <= 2 && index + k < lines.Count; k++)
        {
            var next = lines[index + k];
            if (IsBullet(next)) return false;
            var match = DateRangeRegex.Match(next);
            if (!match.Success) continue;
            return HeaderSeparatorRegex.Split(TextAroundDate(next, match)).Length < 2;
        }
        return false;
    }

    private static List<ParsedExperience> ParseExperienceLines(List<string> lines)
    {
        var list = new List<ParsedExperience>();

        string? title = null, company = null, duration = null, start = null, end = null;
        // The header (title, company, dates) is complete; later plain lines are description unless they open a new role.
        var headerClosed = false;
        var descSb = new StringBuilder();

        bool HasContent() => title != null || company != null || duration != null;

        void Flush()
        {
            if (HasContent())
            {
                list.Add(new ParsedExperience(
                    title ?? "",
                    company ?? "",
                    duration,
                    descSb.ToString().Trim().NullIfEmpty(),
                    start,
                    end));
            }
            title = company = duration = start = end = null;
            headerClosed = false;
            descSb.Clear();
        }

        void SetDates(Match dateMatch)
        {
            duration = dateMatch.Value.Trim();
            var range = TryParseDateRange(dateMatch.Value);
            start = range?.Start;
            end = range?.End;
        }

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var dateMatch = DateRangeRegex.Match(line);
            if (dateMatch.Success)
            {
                var remaining = TextAroundDate(line, dateMatch);
                if (string.IsNullOrWhiteSpace(remaining))
                {
                    // A bare date line closes the title/company lines above it. If the role already has dates,
                    // or there is nothing above it, it opens a role whose title and company may follow (or never come).
                    if ((title != null || company != null) && duration == null)
                    {
                        SetDates(dateMatch);
                        headerClosed = true;
                    }
                    else
                    {
                        Flush();
                        SetDates(dateMatch);
                    }
                    continue;
                }

                var parts = HeaderSeparatorRegex.Split(remaining);
                if (parts.Length >= 2)
                {
                    Flush();
                    title = parts[0].Trim();
                    company = parts[1].Trim();
                }
                else if (title != null && company == null && duration == null)
                {
                    company = remaining;
                }
                else
                {
                    Flush();
                    title = remaining;
                }
                SetDates(dateMatch);
                headerClosed = true;
                continue;
            }

            var text = line.Trim();
            if (IsBullet(line))
            {
                descSb.AppendLine(text);
            }
            else if (!HasContent())
            {
                title = text;
            }
            else if (headerClosed)
            {
                if (StartsRoleHeader(lines, i))
                {
                    Flush();
                    title = text;
                }
                else
                {
                    descSb.AppendLine(text);
                }
            }
            else if (title == null)
            {
                title = text;
            }
            else if (company == null)
            {
                company = text;
            }
            else
            {
                descSb.AppendLine(text);
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

    private static readonly Regex DurationYearsRegex =
        new(@"^\s*(?<n>\d+)\s+Years?\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly string[] MonthAbbreviations =
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    private static string FormatMonth(int year, int month) => $"{year:D4}-{month:D2}";

    private static int TwoDigitYear(int yy) => yy <= DateTime.UtcNow.Year % 100 ? 2000 + yy : 1900 + yy;

    private static int? MonthFromName(string name)
    {
        if (name.Length < 3) return null;
        var index = Array.IndexOf(MonthAbbreviations, name[..3].ToLowerInvariant());
        return index < 0 ? null : index + 1;
    }

    private static (int Year, int? Month)? ParseDatePoint(string text)
    {
        var t = text.Trim();

        var m = PointNumericMonthFirstRegex.Match(t);
        if (m.Success) return (int.Parse(m.Groups[2].Value), int.Parse(m.Groups[1].Value));

        m = PointNumericYearFirstRegex.Match(t);
        if (m.Success) return (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value));

        m = PointNamedRegex.Match(t);
        if (!m.Success) return null;

        var year = m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : TwoDigitYear(int.Parse(m.Groups[3].Value));
        int? month = null;
        if (m.Groups[1].Success)
        {
            month = MonthFromName(m.Groups[1].Value);
            if (month is null) return null;
        }
        return (year, month);
    }

    /// <summary>
    /// Reads the first date range in <paramref name="text"/> as inclusive "yyyy-MM" months. Year-only ends are placed
    /// mid-year (July to June) so two roles a year apart are never joined into one. End is null when the role is ongoing.
    /// </summary>
    private static (string Start, string? End)? TryParseDateRange(string text)
    {
        var match = DateRangeRegex.Match(text);
        if (!match.Success) return null;

        var start = ParseDatePoint(match.Groups["start"].Value);
        if (start is null) return null;

        string? endMonth = null;
        var endText = match.Groups["end"].Value.Trim();
        if (!OpenEndRegex.IsMatch(endText))
        {
            var end = ParseDatePoint(endText);
            if (end is null) return null;
            endMonth = FormatMonth(end.Value.Year, end.Value.Month ?? 6);
        }

        return (FormatMonth(start.Value.Year, start.Value.Month ?? 7), endMonth);
    }

    private static bool TryParseMonthIndex(string? value, out int index)
    {
        index = 0;
        if (string.IsNullOrWhiteSpace(value) || value.Length != 7 || value[4] != '-') return false;
        if (!int.TryParse(value.AsSpan(0, 4), out var year) || !int.TryParse(value.AsSpan(5, 2), out var month) || month is < 1 or > 12)
            return false;
        index = year * 12 + month;
        return true;
    }

    public static string BucketRelevantExperience(int totalMonths) => totalMonths switch
    {
        < 12 => "< 1 Year",
        < 24 => "1-2 Years",
        < 36 => "2-3 Years",
        < 60 => "3-5 Years",
        < 96 => "5-8 Years",
        _ => "8+ Years"
    };

    /// <summary>
    /// Estimates total relevant experience from the dated roles and returns one of the review-form presets
    /// ("&lt; 1 Year", "1-2 Years", "2-3 Years", "3-5 Years", "5-8 Years", "8+ Years"). Overlapping roles are counted
    /// once and gaps between roles count as zero. Returns null when no role has a usable duration, so the reviewer
    /// chooses instead of getting a guess.
    /// </summary>
    public static string? EstimateRelevantExperience(IEnumerable<ParsedExperience> experiences, DateTime now) =>
        EstimateTotalMonths(experiences, now) is { } months ? BucketRelevantExperience(months) : null;

    /// <summary>
    /// A role is read from its structured StartMonth/EndMonth when present, otherwise from the text in Duration
    /// (so a reviewer who retypes the dates is still understood). The current month is not counted for ongoing roles.
    /// </summary>
    public static int? EstimateTotalMonths(IEnumerable<ParsedExperience> experiences, DateTime now)
    {
        var nowIdx = now.Year * 12 + now.Month;           // exclusive end index of the current month
        var spans = new List<(int Start, int End)>();
        var standaloneMonths = 0;

        foreach (var exp in experiences)
        {
            int startIdx;
            int endIdx;

            if (TryParseMonthIndex(exp.StartMonth, out startIdx))
            {
                if (string.IsNullOrWhiteSpace(exp.EndMonth)) endIdx = nowIdx;
                else if (TryParseMonthIndex(exp.EndMonth, out var endMonthIdx)) endIdx = endMonthIdx + 1;
                else continue;
            }
            else if (!string.IsNullOrWhiteSpace(exp.Duration))
            {
                var years = DurationYearsRegex.Match(exp.Duration);
                if (years.Success)
                {
                    standaloneMonths += int.Parse(years.Groups["n"].Value) * 12;
                    continue;
                }

                var range = TryParseDateRange(exp.Duration);
                if (range is null || !TryParseMonthIndex(range.Value.Start, out startIdx)) continue;
                if (range.Value.End is null) endIdx = nowIdx;
                else if (TryParseMonthIndex(range.Value.End, out var endMonthIdx)) endIdx = endMonthIdx + 1;
                else continue;
            }
            else
            {
                continue;
            }

            endIdx = Math.Min(endIdx, nowIdx);
            if (endIdx > startIdx) spans.Add((startIdx, endIdx));
        }

        if (spans.Count == 0 && standaloneMonths == 0) return null;

        var totalMonths = standaloneMonths;
        var (curStart, curEnd) = (0, 0);
        foreach (var (s, e) in spans.OrderBy(x => x.Start))
        {
            if (curEnd == 0) { (curStart, curEnd) = (s, e); continue; }
            if (s <= curEnd) { curEnd = Math.Max(curEnd, e); continue; }
            totalMonths += curEnd - curStart;
            (curStart, curEnd) = (s, e);
        }
        if (curEnd > 0) totalMonths += curEnd - curStart;

        return totalMonths;
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

    // Short standalone headings that end the experience section now that it is no longer capped at 25 lines.
    // Whole-line only, so a role titled "Training Manager" or "Languages Teacher" is not mistaken for a heading.
    private static readonly Regex StandaloneHeadingRegex =
        new(@"^(?:LANGUAGES|REFERENCES|AWARDS|INTERESTS|HOBBIES|TRAINING|COURSES|VOLUNTEER(?:\s+EXPERIENCE)?|EXTRACURRICULAR\s+ACTIVITIES|ACTIVITIES|DECLARATION)\s*:?$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsHeading(string line) =>
        StandaloneHeadingRegex.IsMatch(line.Trim()) ||
        Regex.IsMatch(line.Trim(), @"^(EDUCATION|ACADEMIC|ACADEMICS|EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s+EXPERIENCE|SKILLS|TECHNICAL\s+SKILLS|TECHNOLOGIES|PROJECTS|KEY\s+PROJECTS|PUBLICATIONS|CERTIFICATIONS|ACHIEVEMENTS|SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|OBJECTIVE)\b", RegexOptions.IgnoreCase);
}

file static class StringExtensions
{
    public static string? NullIfEmpty(this string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
