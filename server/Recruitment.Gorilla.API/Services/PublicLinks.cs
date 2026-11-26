using System.Net;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The public base URL for absolute links put into emails and Slack messages (#327).
/// <para>
/// Production runs on the committed compose defaults, where <c>App:ClientBaseUrl</c> falls back to
/// <c>http://localhost:8090</c>, and the nginx in front of the API rewrites <c>Host</c> and
/// <c>X-Forwarded-Proto</c> (TLS ends one proxy earlier, so the API only ever sees <c>http</c>).
/// Neither the configuration nor the proxy headers can be trusted to name the public address.
/// The browser's own <c>Origin</c> header can: browsers send it on every POST, PUT, PATCH and
/// DELETE, the proxies pass it through untouched, and every link is built while handling such a
/// request (assigning an interviewer, rescheduling, sharing evaluations).
/// </para>
/// Resolution order:
/// <list type="number">
/// <item>A configured <c>App:ClientBaseUrl</c> that is a real, non-loopback http(s) URL.</item>
/// <item>The <c>Origin</c> of the request being handled.</item>
/// <item>The last <c>Origin</c> seen on a signed-in request, for background work such as
/// evaluation reminders, which runs outside any request.</item>
/// <item>None: callers leave the link out rather than send a localhost one.</item>
/// </list>
/// </summary>
public static class PublicLinks
{
    private static readonly AsyncLocal<string?> CurrentRequestOrigin = new();
    private static volatile string? _lastSignedInOrigin;

    /// <summary>The base URL to put in front of a client route, without a trailing slash, or null.</summary>
    public static string? BaseUrl(IConfiguration config) =>
        ConfiguredBaseUrl(config["App:ClientBaseUrl"]) ?? CurrentRequestOrigin.Value ?? _lastSignedInOrigin;

    /// <summary>
    /// The configured base URL when it is an absolute http(s) URL whose host is not a loopback or
    /// unspecified address. A localhost value is the shipped default, never a deployment's real
    /// address, so it counts as not configured. A path (a sub-path deployment) is kept.
    /// </summary>
    public static string? ConfiguredBaseUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || IsLocalHost(uri.Host))
            return null;
        return uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
    }

    /// <summary>
    /// A browser <c>Origin</c> header value reduced to <c>scheme://host[:port]</c>, or null when it
    /// is missing, <c>null</c> (sandboxed or privacy-sensitive contexts), or anything other than a
    /// bare http(s) origin.
    /// </summary>
    public static string? ParseOrigin(string? header)
    {
        if (string.IsNullOrWhiteSpace(header)
            || !Uri.TryCreate(header.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || uri.AbsolutePath != "/" || uri.Query.Length > 0 || uri.Fragment.Length > 0
            || uri.UserInfo.Length > 0 || uri.Host.Length == 0)
            return null;
        return uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>
    /// Middleware body: makes the request's <c>Origin</c> available to link builders for the rest
    /// of the request, and remembers it for background work when the caller is signed in (so an
    /// anonymous request can't choose the links sent to other users). Runs after authentication.
    /// </summary>
    public static async Task TrackRequestOriginAsync(HttpContext context, Func<Task> next)
    {
        var origin = ParseOrigin(context.Request.Headers.Origin);
        if (origin is not null && context.User.Identity?.IsAuthenticated == true)
            _lastSignedInOrigin = origin;

        using (UseRequestOrigin(origin))
            await next();
    }

    /// <summary>Sets the current request's origin until disposed. Used by the middleware and by tests.</summary>
    public static IDisposable UseRequestOrigin(string? origin)
    {
        var previous = CurrentRequestOrigin.Value;
        CurrentRequestOrigin.Value = origin;
        return new Restore(() => CurrentRequestOrigin.Value = previous);
    }

    /// <summary>Test hook: forget the origin remembered from signed-in requests.</summary>
    public static void ForgetLastSignedInOrigin() => _lastSignedInOrigin = null;

    private static bool IsLocalHost(string host)
    {
        host = host.Trim('[', ']');
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase))
            return true;
        return IPAddress.TryParse(host, out var ip)
               && (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any));
    }

    private sealed class Restore(Action restore) : IDisposable
    {
        public void Dispose() => restore();
    }
}
