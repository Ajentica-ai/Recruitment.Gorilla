using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The shared person-name rule (issue #38). Pure, no DB. The client mirror of
/// this table lives in client/src/utils/personName.test.ts — keep them in step.
/// </summary>
public class PersonNameValidatorTests
{
    [Theory]
    [InlineData("Tahmid Rahman")]
    [InlineData("Anne-Marie O'Neill")]
    [InlineData("Anne-Marie O’Neill")]       // curly apostrophe
    [InlineData("José Álvarez")]        // accents
    [InlineData("তাহমিদ")] // Bangla
    [InlineData("张伟")]                  // CJK
    [InlineData("محمد")]      // Arabic
    [InlineData("Dr. Jane Smith, Jr.")]
    [InlineData("X")]
    [InlineData("  Padded Name  ")]               // trimmed before checking
    [InlineData("Elizabeth II")]
    public void Accepts_real_names(string name) =>
        Assert.Null(PersonNameValidator.Validate(name, "Name"));

    [Theory]
    [InlineData("\U0001F604\U0001F60A")]                       // plain emoji — the reported bug
    [InlineData("Tahmid \U0001F604")]                          // emoji mixed with a real name
    [InlineData("\U0001F469‍\U0001F4BB")]                 // ZWJ sequence
    [InlineData("\U0001F1E7\U0001F1E9")]                       // regional-indicator flag
    [InlineData("\U0001F44D\U0001F3FD")]                       // skin-tone modifier
    [InlineData("Jane\u0000Doe")]                              // control character
    [InlineData("Jane​Doe")]                              // zero-width space (format)
    [InlineData("♥ ★")]                              // symbols only
    [InlineData("Jane ❤ Doe")]                            // symbol inside a name
    public void Rejects_emoji_and_symbols(string name) =>
        Assert.Equal("Name cannot contain emoji or symbols.", PersonNameValidator.Validate(name, "Name"));

    [Theory]
    [InlineData("###")]
    [InlineData("...")]
    [InlineData("12345")]
    [InlineData("-")]
    public void Rejects_input_with_no_letter(string name) =>
        Assert.Equal("Name must contain at least one letter.", PersonNameValidator.Validate(name, "Name"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Rejects_missing_input(string? name) =>
        Assert.Equal("Name is required.", PersonNameValidator.Validate(name, "Name"));

    [Fact]
    public void Rejects_names_longer_than_100_characters()
    {
        Assert.Null(PersonNameValidator.Validate(new string('a', 100), "Name"));
        Assert.Equal("Name must be 100 characters or less.",
            PersonNameValidator.Validate(new string('a', 101), "Name"));
    }

    [Fact]
    public void Uses_the_supplied_label_in_every_message()
    {
        Assert.Equal("Full name is required.", PersonNameValidator.Validate("", "Full name"));
        Assert.Equal("Full name cannot contain emoji or symbols.",
            PersonNameValidator.Validate("\U0001F604", "Full name"));
    }
}
