namespace Recruitment.Gorilla.API.Models;

public class CandidateEducation
{
    public int Id { get; set; }

    public int CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    public string Degree { get; set; } = string.Empty;
    public string Institution { get; set; } = string.Empty;
    public string? GraduationYear { get; set; }
    public string? Cgpa { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
