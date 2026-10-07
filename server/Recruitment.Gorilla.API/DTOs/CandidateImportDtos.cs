using System.Text.Json;
using System.Text.Json.Serialization;

namespace Recruitment.Gorilla.API.DTOs;

/// <summary>
/// One candidate from a JSON import file, as the template documents it. Every field is nullable here so a
/// missing value reaches validation as a readable error rather than a deserialization failure. Keys the
/// template doesn't define land in <see cref="UnknownKeys"/> and are reported back as a warning.
/// </summary>
public record ImportCandidateEntryDto
{
    public string? CvFileName { get; init; }
    public string? FullName { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? CurrentTitle { get; init; }
    public string? RelevantExperience { get; init; }
    public string? Location { get; init; }
    public string? Role { get; init; }
    public string? Source { get; init; }
    public string? SourceDetail { get; init; }

    /// <summary>A string, or an array of strings joined with ", ".</summary>
    [JsonConverter(typeof(StringOrArrayConverter))]
    public string? Skills { get; init; }

    public string? Summary { get; init; }
    public string? LinkedInUrl { get; init; }
    public string? GithubUrl { get; init; }
    public string? GitLabUrl { get; init; }
    public string? PortfolioUrl { get; init; }
    public string? LeetCodeUrl { get; init; }
    public string? CodeforcesUrl { get; init; }
    public string? HackerRankUrl { get; init; }
    public List<ImportEducationDto>? Educations { get; init; }
    public List<ImportExperienceDto>? Experiences { get; init; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? UnknownKeys { get; init; }
}

public record ImportEducationDto(string? Degree, string? Institution, string? GraduationYear, string? Cgpa);

public record ImportExperienceDto(string? JobTitle, string? Company, string? Duration, string? Description);

/// <summary>The draft an imported entry became, plus anything the reviewer should look at.</summary>
public record ImportCandidateResultDto(CVDraftDto Draft, List<string> Warnings);

/// <summary>
/// Reads a string field that a person or an AI may have written as a number or a boolean
/// (<c>"cgpa": 3.7</c>, <c>"graduationYear": 2020</c>) as its literal text.
/// </summary>
public class LenientStringConverter : JsonConverter<string>
{
    public override bool HandleNull => false;

    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => System.Text.Encoding.UTF8.GetString(reader.ValueSpan),
            JsonTokenType.True => "true",
            JsonTokenType.False => "false",
            _ => throw new JsonException($"Expected text but found {reader.TokenType}."),
        };

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);
}

/// <summary>Reads a skills value given either as one string or as an array of strings.</summary>
public class StringOrArrayConverter : JsonConverter<string?>
{
    public override bool HandleNull => true;

    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        if (reader.TokenType != JsonTokenType.StartArray)
            return new LenientStringConverter().Read(ref reader, typeof(string), options);

        var items = new List<string>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            var item = new LenientStringConverter().Read(ref reader, typeof(string), options);
            if (!string.IsNullOrWhiteSpace(item)) items.Add(item.Trim());
        }
        return items.Count > 0 ? string.Join(", ", items) : null;
    }

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(value);
    }
}
