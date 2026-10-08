using System.Net;
using System.Net.Http.Headers;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>HttpSlackTransport: the Slack Web API error mapping, against a stub HttpMessageHandler.</summary>
public class HttpSlackTransportTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastRequest = request;
            return Task.FromResult(respond(request));
        }
    }

    private static HttpSlackTransport Transport(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://slack.com/api/") });

    private static Task<System.Text.Json.JsonElement> Call(HttpSlackTransport transport, string method = "chat.postMessage") =>
        transport.CallAsync("xoxb-test", method, new Dictionary<string, string>());

    [Fact]
    public async Task CallAsync_returns_the_parsed_body_and_sends_a_bearer_token_on_ok_true()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"ok":true,"user":{"id":"U1"}}"""),
        });

        var result = await Call(Transport(handler), "users.lookupByEmail");

        Assert.Equal("U1", result.GetProperty("user").GetProperty("id").GetString());
        Assert.Equal("Bearer", handler.LastRequest!.Headers.Authorization!.Scheme);
        Assert.Equal("xoxb-test", handler.LastRequest.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task CallAsync_throws_ratelimited_with_retry_after_on_429()
    {
        var handler = new StubHandler(_ =>
        {
            var response = new HttpResponseMessage((HttpStatusCode)429);
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(7));
            return response;
        });

        var ex = await Assert.ThrowsAsync<SlackApiException>(() => Call(Transport(handler)));

        Assert.Equal("ratelimited", ex.Code);
        Assert.True(ex.IsTransient);
        Assert.Equal(TimeSpan.FromSeconds(7), ex.RetryAfter);
    }

    [Fact]
    public async Task CallAsync_throws_a_transient_error_on_5xx()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var ex = await Assert.ThrowsAsync<SlackApiException>(() => Call(Transport(handler)));

        Assert.Equal("http_500", ex.Code);
        Assert.True(ex.IsTransient);
    }

    [Fact]
    public async Task CallAsync_throws_a_non_transient_error_on_other_4xx()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var ex = await Assert.ThrowsAsync<SlackApiException>(() => Call(Transport(handler)));

        Assert.Equal("http_404", ex.Code);
        Assert.False(ex.IsTransient);
    }

    [Fact]
    public async Task CallAsync_throws_the_slack_error_code_on_ok_false()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"ok":false,"error":"invalid_auth"}"""),
        });

        var ex = await Assert.ThrowsAsync<SlackApiException>(() => Call(Transport(handler)));

        Assert.Equal("invalid_auth", ex.Code);
        Assert.False(ex.IsTransient);
        Assert.Null(ex.NeededScope);
    }

    [Fact]
    public async Task CallAsync_captures_the_needed_scope_on_missing_scope()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"ok":false,"error":"missing_scope","needed":"users:read.email"}"""),
        });

        var ex = await Assert.ThrowsAsync<SlackApiException>(() => Call(Transport(handler), "users.lookupByEmail"));

        Assert.Equal("missing_scope", ex.Code);
        Assert.Equal("users:read.email", ex.NeededScope);
        Assert.False(ex.IsTransient);
    }
}
