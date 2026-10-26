namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The pipeline buckets the dashboard KPI tiles count, shared with the candidate
/// list so a tile and the list it links to can never disagree.
///
/// This exists because the two were computed in different places: the dashboard
/// summed <see cref="NegativeTerminal"/> for its "Rejected" figure, while the
/// list could only filter on a single status, so the tile had no destination
/// that reproduced its own number. Both now resolve a bucket through here.
///
/// The status strings are the exact seeded values, historical typos included —
/// see the AppDbContext seed.
/// </summary>
public static class CandidateBuckets
{
    /// <summary>Terminal statuses meaning the candidate was taken forward or hired.</summary>
    public static readonly HashSet<string> PositiveTerminal =
        ["Recommended", "Offer Preparation", "Offer Extended", "Offer Accepted", "Hired"];

    /// <summary>Terminal statuses meaning the candidate did not proceed.</summary>
    public static readonly HashSet<string> NegativeTerminal =
        ["Reject", "Not Recommended", "Discontinued", "Not Available", "Offer Declined"];

    /// <summary>The "hired" bucket: candidates whose current status is Hired (#195).</summary>
    public static readonly HashSet<string> HiredStatuses = ["Hired"];

    /// <summary>The "offers" bucket: candidates in the offer stages. Offer Declined is not here, it is already
    /// counted as Rejected, and Hired has its own bucket (#195).</summary>
    public static readonly HashSet<string> OfferStatuses = ["Offer Preparation", "Offer Extended", "Offer Accepted"];

    /// <summary>How far back "new this week" reaches.</summary>
    public const int NewWindowDays = 7;

    /// <summary>Bucket names accepted by <c>GET /api/candidates?bucket=</c>.</summary>
    public const string Recommended = "recommended";
    public const string Rejected = "rejected";
    public const string InProcess = "in-process";
    public const string NewThisWeek = "new-this-week";
    public const string Hired = "hired";
    public const string Offers = "offers";

    /// <summary>True when <paramref name="bucket"/> is one this app understands.</summary>
    public static bool IsKnown(string? bucket) =>
        bucket is Recommended or Rejected or InProcess or NewThisWeek or Hired or Offers;
}
