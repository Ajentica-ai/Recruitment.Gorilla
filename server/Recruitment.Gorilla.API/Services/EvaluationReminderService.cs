using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>Settings for the overdue-evaluation reminder job (#202), bound from <c>EvaluationReminders</c>.</summary>
public class EvaluationReminderOptions
{
    public const string Section = "EvaluationReminders";

    /// <summary>Master switch. Off means the worker idles and nothing is sent.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Hours after an interview ends before its panel is first reminded.</summary>
    public int AfterHours { get; set; } = 24;

    /// <summary>Hours between reminders to the same interviewer for the same interview.</summary>
    public int IntervalHours { get; set; } = 24;

    /// <summary>The most reminders one interviewer gets for one interview.</summary>
    public int MaxReminders { get; set; } = 3;

    /// <summary>How often the worker looks for due reminders.</summary>
    public int PollMinutes { get; set; } = 15;
}

/// <summary>
/// Reminds interviewers whose evaluation is overdue (#202). An interviewer on a non-cancelled interview that ended at
/// least <see cref="EvaluationReminderOptions.AfterHours"/> ago, with no submitted evaluation (a draft does not count),
/// gets an in-app reminder, then another every <see cref="EvaluationReminderOptions.IntervalHours"/>, up to
/// <see cref="EvaluationReminderOptions.MaxReminders"/>. What has been sent is kept in <c>EvaluationReminders</c>, so
/// the interval and the maximum survive a restart. The clock is a parameter so the rules can be tested.
/// </summary>
public class EvaluationReminderService(
    AppDbContext db,
    NotificationService notificationService,
    IOptions<EvaluationReminderOptions> options)
{
    /// <summary>
    /// Interviews older than this are left alone. With the default three reminders a day apart the maximum is reached
    /// within a few days, and a short window keeps both each pass and the first run after deployment small (the first
    /// run reminds everyone already overdue within it).
    /// </summary>
    private const int LookbackDays = 14;

    /// <summary>Sends every reminder that is due at <paramref name="now"/>. Returns how many were sent.</summary>
    public async Task<int> SendDueAsync(DateTime now)
    {
        var settings = options.Value;
        if (!settings.Enabled || settings.MaxReminders <= 0) return 0;

        // A mistyped setting must not turn into a reminder before the interview happened, or one per poll.
        var afterHours = Math.Max(0, settings.AfterHours);
        var intervalHours = Math.Max(1, settings.IntervalHours);
        var maxReminders = Math.Min(settings.MaxReminders, 20);

        // The end time is start plus duration, which the database cannot add up in a query (the UTC converter stops
        // member access on date columns), so the query only bounds the start and the end is checked below.
        var latestStart = now.AddHours(-afterHours);
        var earliestStart = now.AddDays(-LookbackDays);

        var interviews = await db.Interviews
            .AsNoTracking()
            .Where(i => i.Status != InterviewStatuses.Cancelled && i.ScheduledAt <= latestStart && i.ScheduledAt >= earliestStart)
            .Select(i => new
            {
                i.Id,
                i.ScheduledAt,
                i.DurationMinutes,
                CandidateName = i.Candidate.FullName,
                Panel = i.Interviewers.Where(ii => ii.User.IsActive).Select(ii => ii.UserId).ToList(),
                Submitted = i.Evaluations.Where(e => e.IsSubmitted).Select(e => e.InterviewerUserId).ToList(),
            })
            .AsSplitQuery()
            .ToListAsync();

        var due = interviews.Where(i => i.ScheduledAt.AddMinutes(i.DurationMinutes).AddHours(afterHours) <= now).ToList();
        if (due.Count == 0) return 0;

        var interviewIds = due.Select(i => i.Id).ToList();
        var history = (await db.EvaluationReminders
                .Where(r => interviewIds.Contains(r.InterviewId))
                .ToListAsync())
            .ToDictionary(r => (r.InterviewId, r.UserId));

        var sent = 0;
        foreach (var interview in due)
        {
            foreach (var userId in interview.Panel.Except(interview.Submitted))
            {
                history.TryGetValue((interview.Id, userId), out var row);
                if (row is not null &&
                    (row.Count >= maxReminders || row.LastSentAt.AddHours(intervalHours) > now))
                    continue;

                // One interviewer's failure (a bad row, a transient database error) must not stop the others from being
                // reminded on this pass, so each is handled on its own and the next pass tries again.
                try
                {
                    if (row is null)
                    {
                        row = new EvaluationReminder { InterviewId = interview.Id, UserId = userId };
                        db.EvaluationReminders.Add(row);
                        history[(interview.Id, userId)] = row;
                    }
                    row.Count++;
                    row.LastSentAt = now;
                    // Saved before the notification: a failure after this point leaves the count behind, so the worst
                    // case is one reminder fewer, never a reminder that goes out twice.
                    await db.SaveChangesAsync();

                    await notificationService.NotifyAsync(
                        userId,
                        "Evaluation reminder",
                        $"Your evaluation for {interview.CandidateName} is still outstanding. Please complete it.",
                        $"/interviews/{interview.Id}",
                        category: NotificationCategories.EvaluationReminder);
                    sent++;
                }
                catch (DbUpdateException)
                {
                    db.ChangeTracker.Clear();
                    history.Remove((interview.Id, userId));
                }
            }
        }

        return sent;
    }
}
