using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>HttpEmailApiTransport: the HR notification API's response mapping, against a stub HttpMessageHandler.</summary>
public class EmailApiClientTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest;
        public string? LastBody;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastRequest = request;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            return respond(request);
        }
    }

    private static HttpEmailApiTransport Transport(StubHandler handler) => new(new HttpClient(handler));

    private static EmailApiOptions Options(string baseUrl = "https://notify.example.com") =>
        new() { BaseUrl = baseUrl, ApiKey = "test-key", FromName = "Recruitment Gorilla" };

    private static EmailApiSendRequest Request() =>
        new("jane@ajentica.ai", "Hello", "plain text body", "<p>Hello</p>", "Recruitment Gorilla", "ref-123");

    [Fact]
    public async Task SendAsync_posts_the_expected_body_and_headers()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"status":"sent","message_id":"m-1"}"""),
        });

        var messageId = await Transport(handler).SendAsync(Request(), Options(), CancellationToken.None);

        Assert.Equal("m-1", messageId);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Equal("https://notify.example.com/send-email", handler.LastRequest.RequestUri!.ToString());
        Assert.Equal("test-key", handler.LastRequest.Headers.GetValues("X-API-Key").Single());
        Assert.Equal("ref-123", handler.LastRequest.Headers.GetValues("Idempotency-Key").Single());

        using var body = JsonDocument.Parse(handler.LastBody!);
        Assert.Equal("jane@ajentica.ai", body.RootElement.GetProperty("to").GetString());
        Assert.Equal("Hello", body.RootElement.GetProperty("subject").GetString());
        Assert.Equal("plain text body", body.RootElement.GetProperty("body").GetString());
        Assert.Equal("<p>Hello</p>", body.RootElement.GetProperty("html").GetString());
        Assert.Equal("Recruitment Gorilla", body.RootElement.GetProperty("from_name").GetString());
    }

    [Fact]
    public async Task SendAsync_joins_a_base_url_with_a_trailing_slash_correctly()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"status":"sent","message_id":"m-1"}"""),
        });

        await Transport(handler).SendAsync(Request(), Options("https://notify.example.com/"), CancellationToken.None);

        Assert.Equal("https://notify.example.com/send-email", handler.LastRequest!.RequestUri!.ToString());
    }

    [Fact]
    public async Task SendAsync_throws_permanent_on_401()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal("invalid_api_key", ex.Code);
        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_throws_retry_with_retry_after_on_429()
    {
        var handler = new StubHandler(_ =>
        {
            var response = new HttpResponseMessage((HttpStatusCode)429);
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30));
            return response;
        });

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal("rate_limited", ex.Code);
        Assert.Equal(EmailOutcome.Retry, ex.Outcome);
        Assert.Equal(TimeSpan.FromSeconds(30), ex.RetryAfter);
    }

    [Fact]
    public async Task SendAsync_caps_an_excessive_retry_after_value()
    {
        var handler = new StubHandler(_ =>
        {
            var response = new HttpResponseMessage((HttpStatusCode)429);
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromDays(400));
            return response;
        });

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        // A buggy, malicious, or redirected Retry-After must not leave a row "Pending" for that long
        // with no visible failure.
        Assert.True(ex.RetryAfter <= TimeSpan.FromHours(1));
    }

    [Fact]
    public async Task SendAsync_throws_retry_on_5xx()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.BadGateway));
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal("http_502", ex.Code);
        Assert.Equal(EmailOutcome.Retry, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_throws_permanent_on_other_4xx()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("""{"status":"error","error":"invalid_request","message":"to is required"}"""),
        });

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal("http_400", ex.Code);
        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
        Assert.Contains("to is required", ex.Message);
    }

    [Fact]
    public async Task SendAsync_throws_permanent_when_the_recipient_is_rejected()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"status":"error","error":"recipient_not_allowed"}"""),
        });

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal("recipient_not_allowed", ex.Code);
        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_treats_an_unrecognised_200_response_as_ambiguous()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"status":"queued"}"""),
        });

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() => Transport(handler).SendAsync(Request(), Options()));

        Assert.Equal(EmailOutcome.Ambiguous, ex.Outcome);
    }

    [Fact]
    public async Task GetStatusAsync_returns_sent_with_the_message_id()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"status":"sent","message_id":"m-1"}"""),
        });

        var result = await Transport(handler).GetStatusAsync("ref-123", Options());

        Assert.Equal(EmailApiDeliveryStatus.Sent, result.Status);
        Assert.Equal("m-1", result.MessageId);
    }

    [Fact]
    public async Task GetStatusAsync_maps_the_documented_not_found_body_to_NotFound()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound)
        {
            Content = new StringContent("""{"status":"not_found"}"""),
        });

        var result = await Transport(handler).GetStatusAsync("ref-123", Options());

        Assert.Equal(EmailApiDeliveryStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetStatusAsync_treats_a_plain_404_as_unsupported_not_not_found()
    {
        // No status-check endpoint exists yet on the real service, so every reference 404s with no
        // body — that must not be read as "we checked and it wasn't sent", which would trigger an
        // automatic resend the service was never asked to deduplicate.
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var result = await Transport(handler).GetStatusAsync("ref-123", Options());

        Assert.Equal(EmailApiDeliveryStatus.Unsupported, result.Status);
    }

    [Fact]
    public async Task GetStatusAsync_returns_unsupported_on_a_network_failure_rather_than_throw()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("connection refused"));

        var result = await Transport(handler).GetStatusAsync("ref-123", Options());

        Assert.Equal(EmailApiDeliveryStatus.Unsupported, result.Status);
    }
}
