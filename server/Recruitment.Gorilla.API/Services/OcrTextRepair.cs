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

    private static readonly Regex SpacedEmail = new(
        @"(?<local>[A-Za-z0-9._%+-]+(?:\.[ \t]+[A-Za-z0-9._%+-]+)*)[ \t]*@[ \t]*(?<domain>[A-Za-z0-9-]+(?:\.[ \t]*[A-Za-z0-9-]+)+)",
        RegexOptions.Compiled);

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
        repaired = SpacedEmail.Replace(repaired, m => Regex.Replace(m.Value, @"[ \t]+", ""));
        repaired = WwwUnderscore.Replace(repaired, "www.");
        repaired = LinkedIn.Replace(repaired, "linkedin.com/in/");
        repaired = HostGluedSlash.Replace(repaired, m => $"{m.Groups["host"].Value.ToLowerInvariant()}.com/");
        repaired = BlankRuns.Replace(repaired, "\n\n");
        return repaired.Trim();
    }
}
