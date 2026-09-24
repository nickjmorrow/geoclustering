namespace Geoclustering.Api;

/// <summary>
/// At most <see cref="Limit"/> clusterings run at once, across every visitor.
///
/// The per-visitor rate limit stops one address from looping uploads; this
/// stops many addresses together from keeping every core busy. Clustering is
/// synchronous CPU work, so a request past the limit waits briefly for a slot
/// and is then turned away with a 503, rather than piling up threads.
/// </summary>
public sealed class ClusteringGate(int limit, TimeSpan wait) : IDisposable
{
    private readonly SemaphoreSlim _slots = new(limit, limit);

    public int Limit { get; } = limit;

    /// <summary>A slot to release when done, or null if none freed up in time.</summary>
    public async Task<IDisposable?> TryEnterAsync(CancellationToken cancellationToken) =>
        await _slots.WaitAsync(wait, cancellationToken) ? new Slot(_slots) : null;

    public void Dispose() => _slots.Dispose();

    private sealed class Slot(SemaphoreSlim slots) : IDisposable
    {
        private int _released;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _released, 1) == 0)
            {
                slots.Release();
            }
        }
    }
}
