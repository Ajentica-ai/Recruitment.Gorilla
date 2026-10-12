using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>NotificationService.NotifyAsync: the shared in-app + email + Slack dispatch path.</summary>
public class NotificationServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
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
    public async Task NotifyAsync_writes_the_in_app_notification_and_queues_the_email()
    {
        var user = Data.AddUser("Interviewer", name: "Ivy Interviewer");

        await new NotificationService(Db, TestEmail(), TestSlack()).NotifyAsync(
            user.Id, "Interview assigned", "You have been assigned.", "/interviews/1",
            "Interview assigned: Jane Doe", "<p>body</p>");

        var notification = await Db.Notifications.SingleAsync(n => n.UserId == user.Id);
        Assert.Equal("Interview assigned", notification.Title);
        Assert.Equal("/interviews/1", notification.LinkUrl);

        // The email isn't sent inline: it's durably queued for the outbox worker to pick up.
        var queued = await Db.OutboundEmails.SingleAsync(e => e.ToEmail == user.Email);
        Assert.Equal("Interview assigned: Jane Doe", queued.Subject);
        Assert.Equal(OutboundEmailStatus.Pending, queued.Status);
    }

    [Fact]
    public async Task NotifyAsync_writes_the_notification_without_an_email_when_none_is_supplied()
    {
        var user = Data.AddUser("Interviewer");

        await new NotificationService(Db, TestEmail(), TestSlack()).NotifyAsync(
            user.Id, "Title", "Message", null);

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
        Assert.False(await Db.OutboundEmails.AnyAsync(e => e.ToEmail == user.Email));
    }

    [Fact]
    public async Task NotifyAsync_queues_the_email_without_waiting_on_delivery()
    {
        var user = Data.AddUser("Interviewer");

        // A transport that would fail every send proves NotifyAsync never tries to deliver inline:
        // queuing only ever touches the database, so this never gets a chance to throw here.
        await new NotificationService(Db, TestEmail(new ThrowingTransport()), TestSlack()).NotifyAsync(
            user.Id, "Title", "Message", null, "Subject", "<p>x</p>");

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
        Assert.True(await Db.OutboundEmails.AnyAsync(e => e.ToEmail == user.Email && e.Status == OutboundEmailStatus.Pending));
    }

    [Fact]
    public async Task The_in_app_notification_survives_even_when_the_queued_email_later_fails_for_good()
    {
        var user = Data.AddUser("Interviewer");

        await new NotificationService(Db, TestEmail(), TestSlack()).NotifyAsync(
            user.Id, "Title", "Message", null, "Subject", "<p>x</p>");

        // The outbox worker picks this up later and the send turns out to be permanently broken.
        await OutboxProcessor(new ThrowingDispatcher(EmailOutcome.Permanent)).ProcessDueAsync();

        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == user.Id));
        var email = await Db.OutboundEmails.SingleAsync(e => e.ToEmail == user.Email);
        Assert.Equal(OutboundEmailStatus.Failed, email.Status);
    }

    private sealed class ThrowingDispatcher(EmailOutcome outcome) : IEmailDispatcher
    {
        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default) =>
            throw new EmailDeliveryException("test_failure", outcome);

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported));
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
