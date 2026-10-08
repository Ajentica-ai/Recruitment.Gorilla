using System.Threading.Channels;

namespace Recruitment.Gorilla.API.Services.Background;

/// <summary><paramref name="Text"/> is the fully rendered Slack mrkdwn message, ready to post as-is.</summary>
public record SlackJob(string ToEmail, string Text, int RetryCount = 0);

public interface ISlackQueue
{
    ValueTask QueueAsync(SlackJob job, CancellationToken ct = default);
    IAsyncEnumerable<SlackJob> ReadAllAsync(CancellationToken ct = default);
}

public class SlackQueue : ISlackQueue
{
    private readonly Channel<SlackJob> _channel;

    public SlackQueue(int capacity = 1000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false,
        };
        _channel = Channel.CreateBounded<SlackJob>(options);
    }

    public ValueTask QueueAsync(SlackJob job, CancellationToken ct = default) =>
        _channel.Writer.WriteAsync(job, ct);

    public IAsyncEnumerable<SlackJob> ReadAllAsync(CancellationToken ct = default) =>
        _channel.Reader.ReadAllAsync(ct);
}
