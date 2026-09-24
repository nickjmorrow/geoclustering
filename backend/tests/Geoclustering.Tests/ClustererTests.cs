using Geoclustering.Clustering;

namespace Geoclustering.Tests;

public class ClustererTests
{
    private static Place[] Places(params (double Lat, double Lng)[] points) =>
        [.. points.Select((p, i) => new Place(i, $"Place {i}", p.Lat, p.Lng))];

    /// <summary>The clusters that exist once the first <c>n - k</c> merges have happened.</summary>
    private static List<HashSet<int>> ClustersAt(Dendrogram dendrogram, int k)
    {
        var active = Enumerable.Range(0, dendrogram.Places.Count).ToHashSet();
        foreach (var merge in dendrogram.Merges.Take(dendrogram.Places.Count - k))
        {
            active.Remove(merge.A);
            active.Remove(merge.B);
            active.Add(merge.Into);
        }

        return [.. active.Select(id => dendrogram.Clusters[id].PlaceIds.ToHashSet())];
    }

    [Fact]
    public void A_single_place_is_a_single_cluster_with_nothing_to_merge()
    {
        var dendrogram = HierarchicalClusterer.Cluster(Places((40.7, -74.0)));

        Assert.Empty(dendrogram.Merges);
        var cluster = Assert.Single(dendrogram.Clusters);
        Assert.Equal([0], cluster.PlaceIds);
        Assert.Equal(0, cluster.SpreadMeters);
    }

    [Fact]
    public void Every_place_ends_up_in_one_root_after_n_minus_one_merges()
    {
        var dendrogram = HierarchicalClusterer.Cluster(Places((0, 0), (0, 0.01), (0, 0.02), (1, 1), (1, 1.01)));

        Assert.Equal(4, dendrogram.Merges.Count);
        Assert.Equal(9, dendrogram.Clusters.Count);
        Assert.Equal([0, 1, 2, 3, 4], dendrogram.Clusters[^1].PlaceIds.Order());
        Assert.Equal(Enumerable.Range(5, 4), dendrogram.Merges.Select(m => m.Into));
    }

    [Fact]
    public void Two_distant_neighbourhoods_separate_at_two_clusters()
    {
        // Three places in lower Manhattan, two in Queens.
        var dendrogram = HierarchicalClusterer.Cluster(Places(
            (40.7033, -74.0170), (40.7056, -74.0134), (40.7115, -74.0134),
            (40.7466, -73.8448), (40.7458, -73.8467)));

        var clusters = ClustersAt(dendrogram, 2);

        Assert.Contains(clusters, c => c.SetEquals([0, 1, 2]));
        Assert.Contains(clusters, c => c.SetEquals([3, 4]));
    }

    [Fact]
    public void Merges_happen_closest_first_so_distances_mostly_increase()
    {
        // Centroid linkage can produce the odd inversion, but on well-separated
        // groups the first merges must be the within-group ones.
        var dendrogram = HierarchicalClusterer.Cluster(Places((0, 0), (0, 0.001), (5, 5), (5, 5.001)));

        Assert.True(dendrogram.Merges[0].DistanceMeters < 200);
        Assert.True(dendrogram.Merges[1].DistanceMeters < 200);
        Assert.True(dendrogram.Merges[2].DistanceMeters > 500_000);
    }

    [Fact]
    public void The_same_input_always_clusters_the_same_way()
    {
        var places = Places((0, 0), (0, 1), (1, 0), (1, 1), (0.5, 0.5));

        Assert.Equal(HierarchicalClusterer.Cluster(places).Merges, HierarchicalClusterer.Cluster(places).Merges);
    }

    [Fact]
    public void A_cluster_lists_its_places_in_the_order_to_walk_them()
    {
        // On a line, but not listed in line order.
        var dendrogram = HierarchicalClusterer.Cluster(Places((0, 0.03), (0, 0), (0, 0.02), (0, 0.01)));

        var root = dendrogram.Clusters[^1];
        Assert.True(root.PlaceIds.SequenceEqual([1, 3, 2, 0]) || root.PlaceIds.SequenceEqual([0, 2, 3, 1]));
        Assert.Equal(Geo.DistanceMeters(new(0, 0), new(0, 0.03)), root.RouteMeters!.Value, 3);
    }

    [Fact]
    public void Too_many_places_is_refused()
    {
        var places = Enumerable.Range(0, HierarchicalClusterer.MaxPlaces + 1).Select(i => new Place(i, "p", 0, i * 0.001)).ToArray();

        Assert.Throws<ArgumentException>(() => HierarchicalClusterer.Cluster(places));
    }

    [Fact]
    public void The_largest_allowed_input_clusters_quickly()
    {
        var random = new Random(7);
        var places = Enumerable.Range(0, HierarchicalClusterer.MaxPlaces)
            .Select(i => new Place(i, "p", 40.6 + (random.NextDouble() * 0.3), -74.05 + (random.NextDouble() * 0.3)))
            .ToArray();

        var started = System.Diagnostics.Stopwatch.StartNew();
        var dendrogram = HierarchicalClusterer.Cluster(places);

        Assert.Equal(HierarchicalClusterer.MaxPlaces - 1, dendrogram.Merges.Count);
        Assert.True(started.Elapsed < TimeSpan.FromSeconds(10), $"took {started.Elapsed}");
    }
}
