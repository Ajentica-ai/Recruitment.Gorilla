using System.Threading.Channels;

namespace Recruitment.Gorilla.API.Services.Background;

public record EmailJob(
    string ToEmail,
    string ToName,
    string Subject,
    string HtmlBody,
    CalendarAttachment? Calendar = null,
    int RetryCount = 0
);

public interface IEmailQueue
{
    ValueTask QueueAsync(EmailJob job, CancellationToken ct = default);
    IAsyncEnumerable<EmailJob> ReadAllAsync(CancellationToken ct = default);
}

public class EmailQueue : IEmailQueue
{
    private readonly Channel<EmailJob> _channel;

    public EmailQueue(int capacity = 1000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false,
        };
        _channel = Channel.CreateBounded<EmailJob>(options);
    }

    public ValueTask QueueAsync(EmailJob job, CancellationToken ct = default) =>
        _channel.Writer.WriteAsync(job, ct);

    public IAsyncEnumerable<EmailJob> ReadAllAsync(CancellationToken ct = default) =>
        _channel.Reader.ReadAllAsync(ct);
}
