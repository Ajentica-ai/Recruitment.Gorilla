using System.Text.RegularExpressions;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The one definition of what a person's name may contain (issue #38): user
/// names, candidate full names and reference names all go through this.
/// It is deliberately permissive about script and punctuation so that names
/// like "Anne-Marie O'Neill" or non-Latin names still save, and strict about
/// the two things a name never legitimately holds: emoji/symbols, and nothing
/// but punctuation. Mirrored on the client in client/src/utils/personName.ts —
/// change one and change the other.
/// </summary>
public static class PersonNameValidator
{
    public const int MaxLength = 100;

    /// <summary>At least one letter, in any script.</summary>
    private static readonly Regex HasLetter = new(@"\p{L}", RegexOptions.Compiled);

    /// <summary>
    /// Symbols (\p{S}) is where emoji and pictographs live; Other (\p{C}) covers
    /// control characters, zero-width joiners and the surrogate halves that make
    /// up multi-codepoint emoji sequences.
    /// </summary>
    private static readonly Regex HasEmojiOrSymbol = new(@"[\p{S}\p{C}]", RegexOptions.Compiled);

    /// <summary>Returns an error message, or null when the name is acceptable.</summary>
    public static string? Validate(string? name, string label)
    {
        if (string.IsNullOrWhiteSpace(name))
            return $"{label} is required.";

        var trimmed = name.Trim();

        if (trimmed.Length > MaxLength)
            return $"{label} must be {MaxLength} characters or less.";

        if (HasEmojiOrSymbol.IsMatch(trimmed))
            return $"{label} cannot contain emoji or symbols.";

        if (!HasLetter.IsMatch(trimmed))
            return $"{label} must contain at least one letter.";

        return null;
    }
}
