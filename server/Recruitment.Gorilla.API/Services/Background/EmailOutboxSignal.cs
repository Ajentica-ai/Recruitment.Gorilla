using System.Threading.Channels;

namespace Recruitment.Gorilla.API.Services.Background;

/// <summary>
/// A "there's work to do" signal for the email outbox, not a queue of the emails themselves (those
/// live in the <c>OutboundEmails</c> table, written by <see cref="EmailService.SendAsync"/>). A bounded
/// channel of capacity 1 that drops instead of blocking: if the worker hasn't caught up to the last
/// nudge yet, a second one before it does carries no new information over the first, and it will see
/// every due row regardless once it wakes.
/// </summary>
public interface IEmailOutboxSignal
{
    void Notify();
    ValueTask<bool> WaitAsync(CancellationToken ct = default);
}

public class EmailOutboxSignal : IEmailOutboxSignal
{
    private readonly Channel<byte> _channel = Channel.CreateBounded<byte>(
        new BoundedChannelOptions(1)
        {
            FullMode = BoundedChannelFullMode.DropWrite,
            SingleReader = true,
            SingleWriter = false,
        });

    public void Notify() => _channel.Writer.TryWrite(0);

    public async ValueTask<bool> WaitAsync(CancellationToken ct = default)
    {
        if (!await _channel.Reader.WaitToReadAsync(ct)) return false;
        _channel.Reader.TryRead(out _);
        return true;
    }
}
