namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// An offer action the candidate's own state does not allow (#193): the job opening has ended, or the candidate's
/// status cannot take an offer or the status move the action makes. The message is safe to show.
/// <c>OffersController</c> turns it into a 400, the same answer a refused status change gives; any other exception
/// stays a 500.
/// </summary>
public sealed class OfferRuleException(string message) : InvalidOperationException(message);
