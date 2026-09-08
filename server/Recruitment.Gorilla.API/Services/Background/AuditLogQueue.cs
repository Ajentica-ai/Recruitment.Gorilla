using System.Threading.Channels;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services.Background;

public interface IAuditLogQueue
{
    ValueTask QueueAsync(AuditLog entry, CancellationToken ct = default);
    bool TryRead(out AuditLog entry);
    ValueTask<bool> WaitToReadAsync(CancellationToken ct = default);
    IAsyncEnumerable<AuditLog> ReadAllAsync(CancellationToken ct = default);
}

public class AuditLogQueue : IAuditLogQueue
{
    private readonly Channel<AuditLog> _channel;

    public AuditLogQueue(int capacity = 5000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        };
        _channel = Channel.CreateBounded<AuditLog>(options);
    }

    public ValueTask QueueAsync(AuditLog entry, CancellationToken ct = default) =>
        _channel.Writer.WriteAsync(entry, ct);

    public bool TryRead(out AuditLog entry) =>
        _channel.Reader.TryRead(out entry!);

    public ValueTask<bool> WaitToReadAsync(CancellationToken ct = default) =>
        _channel.Reader.WaitToReadAsync(ct);

    public IAsyncEnumerable<AuditLog> ReadAllAsync(CancellationToken ct = default) =>
        _channel.Reader.ReadAllAsync(ct);
}
