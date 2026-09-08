namespace Recruitment.Gorilla.API.Models;

public class CandidateDraft
{
    public int Id { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? CurrentTitle { get; set; }
    public string? RelevantExperience { get; set; }
    public string? Skills { get; set; }
    public string? Summary { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GithubUrl { get; set; }
    public string? PortfolioUrl { get; set; }
    public string? Location { get; set; }
    public string? LeetCodeUrl { get; set; }
    public string? CodeforcesUrl { get; set; }
    public string? HackerRankUrl { get; set; }
    public string? GitLabUrl { get; set; }
    public string? EducationJson { get; set; }
    public string? ExperienceJson { get; set; }

    public int? RoleAppliedOptionId { get; set; }
    public RoleAppliedOption? RoleAppliedOption { get; set; }

    public int? SourceOptionId { get; set; }
    public CandidateSourceOption? SourceOption { get; set; }

    public string? SourceDetail { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string FileType { get; set; } = "PDF";
    public long FileSizeBytes { get; set; }

    /// <summary>Status of the draft: "Pending", "Approved", "Discarded"</summary>
    public string Status { get; set; } = "Pending";

    public string? BatchId { get; set; }
    public string? BatchName { get; set; }

    public int? UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
