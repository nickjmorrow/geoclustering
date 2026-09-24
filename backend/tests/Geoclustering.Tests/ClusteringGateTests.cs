using Geoclustering.Api;

namespace Geoclustering.Tests;

public class ClusteringGateTests
{
    [Fact]
    public async Task Admits_up_to_the_limit_then_turns_the_next_away()
    {
        using var gate = new ClusteringGate(2, TimeSpan.FromMilliseconds(50));
        var cancellationToken = TestContext.Current.CancellationToken;

        using var first = await gate.TryEnterAsync(cancellationToken);
        using var second = await gate.TryEnterAsync(cancellationToken);
        var third = await gate.TryEnterAsync(cancellationToken);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Null(third);
    }

    [Fact]
    public async Task A_released_slot_can_be_taken_again_and_releasing_twice_frees_only_one()
    {
        using var gate = new ClusteringGate(1, TimeSpan.FromMilliseconds(50));
        var cancellationToken = TestContext.Current.CancellationToken;

        var slot = await gate.TryEnterAsync(cancellationToken);
        slot!.Dispose();
        slot.Dispose();

        using var again = await gate.TryEnterAsync(cancellationToken);
        Assert.NotNull(again);
        Assert.Null(await gate.TryEnterAsync(cancellationToken));
    }
}
