using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

public class CVParserServiceTests
{
    [Fact]
    public void ParseNameAndTitleFromFileName_extracts_name_and_title()
    {
        var (name, title) = CVParserService.ParseNameAndTitleFromFileName("Tahmid_Rahman_Senior_Backend_Engineer.pdf");
        Assert.Equal("Tahmid Rahman", name);
        Assert.Equal("Senior Backend Engineer", title);
    }

    [Fact]
    public void ExtractFields_extracts_all_fields_from_raw_cv_text()
    {
        var rawText = """
            Tahmid Rahman
            Senior Backend Engineer
            Email: tahmid@recruitmentgorilla.com | Phone: +880 1711-223344 | Location: Dhaka, Bangladesh
            LinkedIn: https://linkedin.com/in/tahmid-r | GitHub: https://github.com/tahmid-r
            LeetCode: https://leetcode.com/u/tahmid_code | Codeforces: https://codeforces.com/profile/tahmid_cf
            GitLab: https://gitlab.com/tahmid_gl | HackerRank: https://hackerrank.com/profile/tahmid_hr

            Summary
            Passionate software engineer building resilient cloud architectures in Bangladesh.

            Skills & Technologies
            C#, .NET, ASP.NET Core, React, TypeScript, MySQL, Docker, Redis

            Professional Experience
            Senior Software Engineer — Brain Station 23 (Jan 2022 – Present)
            • Built distributed backend systems handling high volume transactions.
            • Designed microservices with ASP.NET Core and Entity Framework Core.

            Education
            BSc in Computer Science & Engineering — Bangladesh University of Engineering and Technology (2020)
            CGPA: 3.85 / 4.00
            """;

        var parser = new CVParserService();
        var tempFile = Path.Combine(Path.GetTempPath(), $"Tahmid_Rahman_Senior_Backend_Engineer_{Guid.NewGuid():N}.txt");
        File.WriteAllText(tempFile, rawText);

        try
        {
            var result = parser.Parse(tempFile, "TXT");

            Assert.NotNull(result);
            Assert.Equal("Tahmid Rahman", result.Name);
            Assert.Equal("tahmid@recruitmentgorilla.com", result.Email);
            Assert.Equal("+880 1711-223344", result.Phone);
            Assert.Contains("linkedin.com/in/tahmid-r", result.LinkedIn);
            Assert.Contains("github.com/tahmid-r", result.Github);
            Assert.Contains("leetcode.com/u/tahmid_code", result.LeetCode);
            Assert.Contains("codeforces.com/profile/tahmid_cf", result.Codeforces);
            Assert.Contains("gitlab.com/tahmid_gl", result.GitLab);
            Assert.Contains("hackerrank.com/profile/tahmid_hr", result.HackerRank);
            Assert.NotNull(result.Location);
            Assert.Contains("Dhaka", result.Location);
            Assert.NotNull(result.Summary);
            Assert.Contains("Passionate software engineer", result.Summary);
            Assert.NotNull(result.Skills);
            Assert.Contains("C#", result.Skills);

            Assert.NotNull(result.Educations);
            Assert.NotEmpty(result.Educations);
            Assert.Equal("3.85 / 4.00", result.Educations[0].Cgpa);

            Assert.NotNull(result.Experiences);
            Assert.NotEmpty(result.Experiences);
            Assert.Equal("Senior Software Engineer", result.Experiences[0].JobTitle);
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
        }
    }

    // ---- NormalizeText -----------------------------------------------------
    //
    // A subsetted PDF font drops the glyph for the "ti" ligature, and PdfPig
    // reports either NUL (the ToUnicode CMap has no entry) or a leftover
    // codepoint such as the euro sign. The inputs below are the exact strings
    // a census found in the CVs already parsed into the database.

    private const string Nul = "\u0000";
    private const string Euro = "€";

    [Theory]
    [InlineData("Brain Sta" + Nul + "on 23", "Brain Station 23")]
    [InlineData("ini" + Nul + "a" + Nul + "ves", "initiatives")]
    [InlineData("resul" + Nul + "ng", "resulting")]
    [InlineData("na" + Nul + "ve", "native")]
    [InlineData("Educa" + Nul + "on", "Education")]
    [InlineData("Sta" + Euro + "on", "Station")]
    public void NormalizeText_restores_the_ti_ligature(string input, string expected)
    {
        Assert.Equal(expected, CVParserService.NormalizeText(input));
    }

    [Theory]
    [InlineData("qualityﬁrst.io", "qualityfirst.io")]
    [InlineData("oﬀer", "offer")]
    [InlineData("inﬂuence", "influence")]
    public void NormalizeText_expands_real_ligature_codepoints(string input, string expected)
    {
        Assert.Equal(expected, CVParserService.NormalizeText(input));
    }

    [Theory]
    // A euro sign that is actually money has to survive: it is never wedged
    // between two letters, which is exactly what the guard checks.
    [InlineData("Salary: " + Euro + "75,000")]
    [InlineData("Budget " + Euro + "1.2M per year")]
    [InlineData("Paid in " + Euro + " and $")]
    public void NormalizeText_leaves_currency_alone(string input)
    {
        Assert.Equal(input, CVParserService.NormalizeText(input));
    }

    [Fact]
    public void NormalizeText_drops_control_characters_it_cannot_interpret()
    {
        // Not between two letters, so there is no evidence it stood for "ti".
        // Dropping beats guessing, and a NUL is never valid text anyway.
        Assert.Equal("Dhaka Bangladesh", CVParserService.NormalizeText("Dhaka " + Nul + "Bangladesh"));
        Assert.Equal("2024", CVParserService.NormalizeText("2024" + Nul));
        Assert.Equal("ab", CVParserService.NormalizeText("a\u0007b"));
    }

    [Fact]
    public void NormalizeText_preserves_ordinary_whitespace()
    {
        const string text = "Line one\r\nLine two\tcolumn";
        Assert.Equal(text, CVParserService.NormalizeText(text));
    }

    private static readonly DateTime Now = new(2026, 10, 13);

    private static List<ParsedExperience> Jobs(params string[] durations) =>
        durations.Select(d => new ParsedExperience("Engineer", "Co", d, null)).ToList();

    [Theory]
    [InlineData("Jan 2016 - Present", "8+ Years")]
    [InlineData("2016 - 2026", "8+ Years")]
    [InlineData("Jan 2023 - Present", "3-5 Years")]
    [InlineData("Jun 2024 - Dec 2024", "< 1 Year")]
    [InlineData("Jan 2024 - Present", "1-2 Years")]
    [InlineData("Jan 2020 - Jan 2026", "5-8 Years")]
    [InlineData("10 Years", "8+ Years")]
    public void EstimateRelevantExperience_buckets_a_single_range(string duration, string expected)
    {
        Assert.Equal(expected, CVParserService.EstimateRelevantExperience(Jobs(duration), Now));
    }

    [Fact]
    public void EstimateRelevantExperience_sums_roles_and_merges_overlaps()
    {
        // 2016-2021 and 2019-2026 overlap: union is 2016-2026 (~10 years), not 12.
        var jobs = Jobs("2016 - 2021", "2019 - 2026");
        Assert.Equal("8+ Years", CVParserService.EstimateRelevantExperience(jobs, Now));

        // Two separate 2-year roles (year-only ranges are inclusive) = 4 years.
        Assert.Equal("3-5 Years", CVParserService.EstimateRelevantExperience(Jobs("2010 - 2011", "2015 - 2016"), Now));
    }

    [Fact]
    public void EstimateRelevantExperience_returns_null_when_nothing_is_dated()
    {
        Assert.Null(CVParserService.EstimateRelevantExperience(new List<ParsedExperience>(), Now));
        Assert.Null(CVParserService.EstimateRelevantExperience(Jobs(null!, "recent"), Now));
    }

    [Fact]
    public void Parsed_cv_with_ten_years_of_roles_estimates_8_plus_years()
    {
        const string rawText = """
            Tahmid Rahman
            tahmid@recruitmentgorilla.com

            Experience
            Senior Software Engineer — Brain Station 23 (Jan 2019 – Present)
            • Built backend systems.
            Software Engineer — Kaz Software (Mar 2016 – Dec 2018)
            • Built web apps.

            Education
            BSc in Computer Science — BUET (2015)
            """;

        var tempFile = Path.Combine(Path.GetTempPath(), $"Ten_Years_{Guid.NewGuid():N}.txt");
        File.WriteAllText(tempFile, rawText);
        try
        {
            var result = new CVParserService().Parse(tempFile, "TXT");
            Assert.Equal(2, result.Experiences.Count);
            Assert.Equal("8+ Years", CVParserService.EstimateRelevantExperience(result.Experiences, Now));
        }
        finally { File.Delete(tempFile); }
    }
}
