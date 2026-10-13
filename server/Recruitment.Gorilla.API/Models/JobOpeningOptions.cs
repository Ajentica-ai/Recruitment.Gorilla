namespace Recruitment.Gorilla.API.Models;

/// <summary>The kinds of admin-managed value lists a job opening draws its Location,
/// Department and Priority fields from.</summary>
public static class JobOpeningOptionKinds
{
    public const string Location = "Location";
    public const string Department = "Department";
    public const string Priority = "Priority";

    public static readonly IReadOnlyList<string> All = [Location, Department, Priority];

    /// <summary>Maps a route segment (location, department, priority) to its kind, or null.</summary>
    public static string? FromRoute(string segment) =>
        All.FirstOrDefault(k => string.Equals(k, segment, StringComparison.OrdinalIgnoreCase));
}

/// <summary>One value in a job-opening field list (e.g. Location = "Remote"). Job openings store the
/// value as text, so renaming one cascades to the openings that use it.</summary>
public class JobOpeningOption
{
    public int Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
