namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The rules offer terms must meet before they are saved (#197). The column limits mirror <c>AppDbContext</c>:
/// without them an overlong value was a <c>DbUpdateException</c> (a 500), and a negative bonus or an expiry in the
/// past was stored and printed on the letter. A broken rule throws <see cref="OfferRuleException"/>, a 400 with the
/// reason; the first one found is reported.
/// </summary>
public static class OfferInputValidator
{
    public const int MaxJobTitleLength = 200;
    public const int MaxEquityLength = 200;
    public const int MaxNotesLength = 2000;

    /// <summary>Salary and bonus are stored as DECIMAL(18,2); this keeps them far inside it.</summary>
    public const decimal MaxAmount = 1_000_000_000_000m;

    /// <summary>The currency as it will be stored: trimmed and upper-case, or null when none was given.</summary>
    public static string? NormaliseCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency) ? null : currency.Trim().ToUpperInvariant();

    public static void Validate(
        string? jobTitle, decimal baseSalary, string? currency, decimal? bonus, string? equity,
        DateTime? startDate, DateTime? expirationDate, string? notes)
    {
        if (baseSalary <= 0)
            throw new OfferRuleException("Base salary must be greater than zero.");
        if (baseSalary > MaxAmount)
            throw new OfferRuleException($"Base salary cannot be more than {MaxAmount:N0}.");

        if (bonus is decimal b)
        {
            if (b < 0) throw new OfferRuleException("Bonus cannot be negative.");
            if (b > MaxAmount) throw new OfferRuleException($"Bonus cannot be more than {MaxAmount:N0}.");
        }

        if (NormaliseCurrency(currency) is string code && !(code.Length == 3 && code.All(c => c is >= 'A' and <= 'Z')))
            throw new OfferRuleException("Currency must be a 3-letter ISO 4217 code such as USD.");

        TooLong(jobTitle, MaxJobTitleLength, "Job title");
        TooLong(equity, MaxEquityLength, "Equity");
        TooLong(notes, MaxNotesLength, "Notes");

        if (expirationDate is DateTime expiry)
        {
            if (expiry.Date < DateTime.UtcNow.Date)
                throw new OfferRuleException("The offer expiry date cannot be in the past.");
            if (startDate is DateTime start && expiry.Date < start.Date)
                throw new OfferRuleException("The offer expiry date cannot be before the start date.");
        }
    }

    private static void TooLong(string? value, int max, string label)
    {
        if (value is not null && value.Trim().Length > max)
            throw new OfferRuleException($"{label} cannot be longer than {max} characters.");
    }
}
