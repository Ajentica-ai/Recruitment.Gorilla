namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// A grant that lets one named user read a candidate's SUBMITTED interview evaluations when their
/// role or assignment would not otherwise allow it (#182). Nothing reads grants in this phase; the
/// grantee read path arrives with #184.
///
/// <see cref="InterviewId"/> null means every round of the candidate, future rounds included.
/// A grant is active when it is not revoked and has not expired (<see cref="IsActive"/>). Revoking is
/// soft: the row stays for audit.
/// </summary>
public class EvaluationAccessGrant
{
    public const string ManualSource = "Manual";
    public const string PanelAutoShareSource = "PanelAutoShare";

    public int Id { get; set; }

    public int CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    /// <summary>The one interview this grant covers; null = all rounds of the candidate, including future ones.</summary>
    public int? InterviewId { get; set; }
    public Interview? Interview { get; set; }

    public int GranteeUserId { get; set; }
    public User GranteeUser { get; set; } = null!;

    /// <summary>Who granted it (SetNull on user delete).</summary>
    public int? GrantedByUserId { get; set; }
    public User? GrantedByUser { get; set; }

    /// <summary>Manual | PanelAutoShare (the latter is created by #187).</summary>
    public string Source { get; set; } = ManualSource;

    /// <summary>
    /// Set only by the panel auto-share (#187), so a later panel change can revoke exactly the
    /// auto-share it created (SetNull when that interview goes).
    /// </summary>
    public int? CreatedForInterviewId { get; set; }
    public Interview? CreatedForInterview { get; set; }

    /// <summary>An optional reason shown to the grantee.</summary>
    public string? Note { get; set; }

    /// <summary>Optional, UTC. A grant stops counting at this moment.</summary>
    public DateTime? ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    /// <summary>Who revoked it (SetNull on user delete).</summary>
    public int? RevokedByUserId { get; set; }
    public User? RevokedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Not revoked and not expired at <paramref name="now"/>.</summary>
    public bool IsActive(DateTime now) => RevokedAt is null && (ExpiresAt is null || ExpiresAt > now);
}
