namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The offer's current state does not allow the action (#192). The message is safe to show: it names the offer
/// and its status, nothing else. <c>OffersController</c> turns it into a 409; any other exception stays a 500.
/// </summary>
public sealed class OfferStateException(string message) : InvalidOperationException(message);
