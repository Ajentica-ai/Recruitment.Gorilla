using System.Text.RegularExpressions;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The one definition of a well-formed email address for candidate data: the create/edit form and the
/// JSON import both check it here. Mirrored on the client in client/src/utils/importManifest.ts for the
/// import pre-check; change one and change the other.
/// </summary>
public static class EmailFormat
{
    private static readonly Regex Pattern =
        new(@"^[\w.+-]+@[\w-]+\.[a-z]{2,}$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool IsValid(string? email) => !string.IsNullOrWhiteSpace(email) && Pattern.IsMatch(email.Trim());
}
