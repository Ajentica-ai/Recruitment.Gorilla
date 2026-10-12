using System.Text.RegularExpressions;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Turns the simple, self-authored HTML <see cref="EmailTemplates"/> produces into a readable plain
/// text alternative, for the one provider that asks for text instead of (or alongside) HTML. Not a
/// general HTML-to-text library: it only needs to handle the tags our own templates actually emit
/// (<c>p</c>, <c>div</c>, <c>span</c>, <c>h2</c>, <c>strong</c>, <c>br</c>, <c>a href</c>), the same
/// way <c>EmailTemplates</c> itself is plain interpolated HTML rather than a templating engine.
/// </summary>
public static partial class HtmlToText
{
    public static string Convert(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;

        var text = html;

        // A link becomes "label (url)" — the url survives even though plain text can't carry the
        // href separately from the visible text.
        text = LinkPattern().Replace(text, m => $"{StripTags(m.Groups["label"].Value)} ({m.Groups["href"].Value})");

        text = LineBreakPattern().Replace(text, "\n");
        text = BlockClosePattern().Replace(text, "\n");
        text = StripTags(text);
        text = DecodeEntities(text);

        // Collapse the blank-line runs the block-level replacements above leave behind, and trim
        // trailing whitespace off each line (the source is indented multi-line interpolated HTML).
        var lines = text.Split('\n').Select(l => l.Trim());
        text = string.Join("\n", lines);
        text = BlankRunPattern().Replace(text, "\n\n");

        return text.Trim();
    }

    private static string StripTags(string value) => TagPattern().Replace(value, "");

    private static string DecodeEntities(string value) => value
        .Replace("&nbsp;", " ")
        .Replace("&middot;", "·")
        .Replace("&amp;", "&")
        .Replace("&lt;", "<")
        .Replace("&gt;", ">")
        .Replace("&quot;", "\"")
        .Replace("&#39;", "'");

    [GeneratedRegex("""<a\s+[^>]*href="(?<href>[^"]*)"[^>]*>(?<label>.*?)</a>""", RegexOptions.Singleline)]
    private static partial Regex LinkPattern();

    [GeneratedRegex(@"<br\s*/?>", RegexOptions.IgnoreCase)]
    private static partial Regex LineBreakPattern();

    [GeneratedRegex(@"</(p|div|h[1-6])\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex BlockClosePattern();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex TagPattern();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex BlankRunPattern();
}
