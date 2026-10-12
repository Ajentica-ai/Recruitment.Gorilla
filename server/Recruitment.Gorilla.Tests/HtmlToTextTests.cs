using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>HtmlToText: converts the simple HTML EmailTemplates produces into readable plain text.</summary>
public class HtmlToTextTests
{
    [Fact]
    public void Convert_turns_a_link_into_label_and_url()
    {
        var text = HtmlToText.Convert("""<p>Visit <a href="https://example.com/x">our site</a> today.</p>""");

        Assert.Contains("our site (https://example.com/x)", text);
        Assert.DoesNotContain("<a", text);
    }

    [Fact]
    public void Convert_turns_br_and_block_closes_into_newlines()
    {
        var text = HtmlToText.Convert("<p>Line one<br />Line two</p><p>Paragraph two</p>");

        Assert.Contains("Line one", text);
        Assert.Contains("Line two", text);
        Assert.Contains("Paragraph two", text);
        Assert.True(text.IndexOf("Line one", StringComparison.Ordinal) < text.IndexOf("Line two", StringComparison.Ordinal));
    }

    [Fact]
    public void Convert_strips_every_remaining_tag()
    {
        var text = HtmlToText.Convert("""<div style="color:red;"><strong>Hi</strong> <span>there</span></div>""");

        Assert.DoesNotContain("<", text);
        Assert.Contains("Hi", text);
        Assert.Contains("there", text);
    }

    [Fact]
    public void Convert_decodes_common_entities()
    {
        var text = HtmlToText.Convert("Terms &amp; conditions &middot; &quot;ok&quot;");

        Assert.Equal("Terms & conditions · \"ok\"", text);
    }

    [Fact]
    public void Convert_of_blank_input_is_empty()
    {
        Assert.Equal(string.Empty, HtmlToText.Convert(""));
        Assert.Equal(string.Empty, HtmlToText.Convert("   "));
    }
}
