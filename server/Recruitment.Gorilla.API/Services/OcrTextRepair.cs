using System.Text.RegularExpressions;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Repairs the damage OCR does to text before the CV parser reads it. Browser OCR (Tesseract.js) recovers
/// almost every word of a clean scan, but a blurry one reliably breaks the two things the parser relies on most:
/// emails (a space slips in after a dot) and profile links (a "/" is read as a letter such as "V" or "v", and
/// "www." comes out as "www_"). This only touches those shapes, so ordinary prose is left alone.
/// </summary>
public static class OcrTextRepair
{
    // Characters OCR commonly returns for a "/" it could not read cleanly.
    private const string SlashLookalikes = @"VvlI|!\\";

    // An email with stray spaces: "arif. hossain@example. invalid" or "name @ example.org". The space is only
    // closed up where it cannot be a sentence break, so text next to a correct email is never glued onto it:
    // - local part: a spaced dot only between lowercase pieces, and the match must start at a word boundary
    //   ("Dhaka. arif@gmail.com" keeps "Dhaka." out of the address);
    // - domain: a spaced dot only before the first dot, followed by a lowercase TLD-like word
    //   ("jane@example.com. Then" stays as it is).
    private static readonly Regex SpacedEmail = new(
        @"(?<![A-Za-z0-9._%+-])(?<local>(?:[a-z0-9._%+-]+\.[ \t]+)*[A-Za-z0-9._%+-]+)[ \t]*@[ \t]*" +
        @"(?<domain>[A-Za-z0-9-]+(?:(?:\.[A-Za-z0-9-]+)+|\.[ \t]+[a-z]{2,24}\b(?:\.[A-Za-z0-9-]+)*))",
        RegexOptions.Compiled);

    private static readonly Regex Whitespace = new(@"[ \t]+", RegexOptions.Compiled);

    private static readonly Regex WwwUnderscore = new(
        @"\bwww[_ ](?=(?:linkedin|github|gitlab|leetcode|codeforces|hackerrank)\b)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // linkedin.com<slash?>in<slash?>handle, where either slash may have been read as a lookalike letter.
    private static readonly Regex LinkedIn = new(
        $@"linkedin[ \t]*\.[ \t]*com[ \t]*[/{SlashLookalikes}]?[ \t]*in[ \t]*[/{SlashLookalikes}]?(?=[A-Za-z0-9])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // github.comvhandle: the slash after ".com" was read as a letter and is glued to the handle.
    private static readonly Regex HostGluedSlash = new(
        $@"\b(?<host>github|gitlab)[ \t]*\.[ \t]*com(?<slash>[{SlashLookalikes}])(?=[A-Za-z0-9])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // Three or more newlines (OCR puts a blank line between every paragraph).
    private static readonly Regex BlankRuns = new(@"(\r?\n){3,}", RegexOptions.Compiled);

    public static string Repair(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var repaired = text.Replace("\r\n", "\n");
        repaired = SpacedEmail.Replace(repaired, m => Whitespace.Replace(m.Value, ""));
        repaired = WwwUnderscore.Replace(repaired, "www.");
        repaired = LinkedIn.Replace(repaired, "linkedin.com/in/");
        repaired = HostGluedSlash.Replace(repaired, m => $"{m.Groups["host"].Value.ToLowerInvariant()}.com/");
        repaired = BlankRuns.Replace(repaired, "\n\n");
        return repaired.Trim();
    }
}
