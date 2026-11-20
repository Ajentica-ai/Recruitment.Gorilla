using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

public class OcrTextRepairTests
{
    [Theory]
    [InlineData("Email: arif. hossain@example. invalid", "Email: arif.hossain@example.invalid")]
    [InlineData("Email: jane.doe@example.com", "Email: jane.doe@example.com")]
    [InlineData("name @ example.org", "name@example.org")]
    public void Repairs_emails_with_stray_spaces(string input, string expected) =>
        Assert.Equal(expected, OcrTextRepair.Repair(input));

    [Theory]
    [InlineData("Address: Mirpur, Dhaka. arif@gmail.com")]
    [InlineData("Email: jane@example.com. Then call me")]
    [InlineData("Email: jane@example.com. available from June")]
    [InlineData("Contact: Jane.Doe@Example.com")]
    public void Does_not_glue_neighbouring_text_onto_a_correct_email(string input) =>
        Assert.Equal(input, OcrTextRepair.Repair(input));

    [Fact]
    public void Repairs_a_spaced_email_without_touching_the_sentence_before_it() =>
        Assert.Equal("Lives in Dhaka. arif.hossain@gmail.com", OcrTextRepair.Repair("Lives in Dhaka. arif. hossain@gmail. com"));

    [Theory]
    [InlineData("Linkedin: https://www_linkedin.comVin/arif-hossain", "Linkedin: https://www.linkedin.com/in/arif-hossain")]
    [InlineData("LinkedIn: https://www.linkedin.com/in/jane-doe", "LinkedIn: https://www.linkedin.com/in/jane-doe")]
    [InlineData("linkedin.com/inVnusrat-jahan", "linkedin.com/in/nusrat-jahan")]
    public void Repairs_linkedin_links(string input, string expected) =>
        Assert.Equal(expected, OcrTextRepair.Repair(input));

    [Theory]
    [InlineData("GitHub: https://github.comvarif", "GitHub: https://github.com/arif")]
    [InlineData("GitHub: https://github.com/arif", "GitHub: https://github.com/arif")]
    [InlineData("gitlab.comvjane", "gitlab.com/jane")]
    public void Repairs_a_slash_read_as_a_letter_after_github_and_gitlab(string input, string expected) =>
        Assert.Equal(expected, OcrTextRepair.Repair(input));

    [Fact]
    public void Leaves_ordinary_prose_alone()
    {
        const string prose = "Built the www pages and a github integration. Visit www_example for fun.";
        Assert.Equal(prose, OcrTextRepair.Repair(prose));
    }

    [Fact]
    public void Collapses_runs_of_blank_lines_and_trims()
    {
        Assert.Equal("a\n\nb", OcrTextRepair.Repair("\n\na\n\n\n\n\nb\n\n"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \n  ")]
    public void Returns_empty_for_blank_input(string? input) => Assert.Equal(string.Empty, OcrTextRepair.Repair(input!));

    [Fact]
    public void The_parser_finds_contacts_in_damaged_ocr_text_after_repair()
    {
        const string ocr = """
            Arif Hossain

            Senior Backend Engineer

            Email: arif. hossain@example. invalid

            Phone: +8801700000000

            Linkedin: https://www_linkedin.comVin/arif-hossain

            GitHub: https://github.comvarif
            """;
        var path = Path.Combine(Path.GetTempPath(), $"ocr_{Guid.NewGuid():N}.txt");
        File.WriteAllText(path, OcrTextRepair.Repair(ocr));
        try
        {
            var parsed = new CVParserService().Parse(path, "TXT");
            Assert.Equal("arif.hossain@example.invalid", parsed.Email);
            Assert.Contains("linkedin.com/in/arif-hossain", parsed.LinkedIn);
            Assert.Contains("github.com/arif", parsed.Github);
        }
        finally { File.Delete(path); }
    }
}
