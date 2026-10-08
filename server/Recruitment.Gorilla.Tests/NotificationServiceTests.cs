using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>NotificationService.NotifyAsync: the shared in-app + email + Slack dispatch path.</summary>
public class NotificationServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private sealed class RecordingTransport : ISmtpTransport
    {
        public MimeMessage? Sent;
        public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default)
        {
            Sent = message;
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingTransport : ISmtpTransport
    {
        public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default) =>
            throw new InvalidOperationException("connection refused");
    }

    private sealed class RecordingSlackTransport : ISlackTransport
    {
        public readonly List<string> Methods = [];

        public Task<JsonElement> CallAsync(
            string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default)
        {
            Methods.Add(method);
            var json = method == "users.lookupByEmail" ? """{"ok":true,"user":{"id":"U123"}}""" : """{"ok":true}""";
            return Task.FromResult(JsonDocument.Parse(json).RootElement);
        }
    }

    [Fact]
    public async Task NotifyAsync_writes_the_in_app_notification_and_sends_the_email()
    {
        var user = Data.AddUser("Interviewer", name: "Ivy Interviewer");
        var transport = new RecordingTransport();

        await new NotificationService(Db, TestEmail(transport), TestSlack()).NotifyAsync(
            user.Id, "Interview assigned", "You have been assigned.", "/interviews/1",
            "Interview assigned: Jane Doe", "<p>body</p>");

        var notification = await Db.Notifications.SingleAsync(n => n.UserId == user.Id);
        Assert.Equal("Interview assigned", notification.Title);
        Assert.Equal("/interviews/1", notification.LinkUrl);

        Assert.NotNull(transport.Sent);
        Assert.Equal(user.Email, transport.Sent!.To.Mailboxes.Single().Address);
        Assert.Equal("Interview assigned: Jane Doe", transport.Sent.Subject);
    }

    [Fact]
    public async Task NotifyAsync_writes_the_notification_without_an_email_when_none_is_supplied()
    {
        var user = Data.AddUser("Interviewer");
        var transport = new RecordingTransport();

        await new NotificationService(Db, TestEmail(transport), TestSlack()).NotifyAsync(
            user.Id, "Title", "Message", null);

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
        Assert.Null(transport.Sent);
    }

    [Fact]
    public async Task NotifyAsync_still_records_the_notification_when_the_email_send_fails()
    {
        var user = Data.AddUser("Interviewer");

        await new NotificationService(Db, TestEmail(new ThrowingTransport()), TestSlack()).NotifyAsync(
            user.Id, "Title", "Message", null, "Subject", "<p>x</p>");

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
    }

    [Fact]
    public async Task NotifyAsync_sends_a_slack_dm_when_the_category_is_routed_to_slack()
    {
        var user = Data.AddUser("Interviewer");
        var slackTransport = new RecordingSlackTransport();
        var slackResolver = new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned);

        await new NotificationService(Db, TestEmail(), TestSlack(slackTransport, slackResolver)).NotifyAsync(
            user.Id, "Interview assigned", "You have been assigned.", "/interviews/1",
            category: NotificationCategories.InterviewAssigned);

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
        Assert.Contains("users.lookupByEmail", slackTransport.Methods);
        Assert.Contains("chat.postMessage", slackTransport.Methods);
    }

    [Fact]
    public async Task NotifyAsync_does_not_send_slack_when_no_category_is_given()
    {
        var user = Data.AddUser("Interviewer");
        var slackTransport = new RecordingSlackTransport();
        // Slack is fully enabled for InterviewAssigned, but this call (like the offer-approval
        // notification) passes no category at all, so it must stay in-app only.
        var slackResolver = new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned);

        await new NotificationService(Db, TestEmail(), TestSlack(slackTransport, slackResolver)).NotifyAsync(
            user.Id, "Offer Approval Requested", "message", "/candidates/1");

        Assert.Empty(slackTransport.Methods);
    }

    [Fact]
    public async Task NotifyAsync_does_not_send_slack_when_the_category_is_not_routed_to_slack()
    {
        var user = Data.AddUser("Interviewer");
        var slackTransport = new RecordingSlackTransport();
        // Token is configured, but EvaluationSubmitted specifically isn't in the enabled set.
        var slackResolver = new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned);

        await new NotificationService(Db, TestEmail(), TestSlack(slackTransport, slackResolver)).NotifyAsync(
            user.Id, "Evaluation submitted", "message", "/candidates/1",
            category: NotificationCategories.EvaluationSubmitted);

        Assert.Empty(slackTransport.Methods);
    }
}
