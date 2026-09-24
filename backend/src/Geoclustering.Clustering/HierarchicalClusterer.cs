namespace Geoclustering.Clustering;

/// <summary>
/// Agglomerative hierarchical clustering with centroid linkage: start with one
/// cluster per place, then repeatedly merge the two clusters whose centers are
/// closest until one remains. The record of those merges is the answer for
/// every cluster count at once.
/// </summary>
public static class HierarchicalClusterer
{
    /// <summary>
    /// The largest input accepted. The merge loop is O(n³) in the worst case
    /// and the response grows with the depth of the tree; 500 places cluster in
    /// well under a second, which keeps an upload feeling immediate.
    /// </summary>
    public const int MaxPlaces = 500;

    public static Dendrogram Cluster(IReadOnlyList<Place> places)
    {
        var n = places.Count;
        if (n == 0)
        {
            throw new ArgumentException("There must be at least one place to cluster.", nameof(places));
        }

        if (n > MaxPlaces)
        {
            throw new ArgumentException($"At most {MaxPlaces} places can be clustered; got {n}.", nameof(places));
        }

        for (var i = 0; i < n; i++)
        {
            if (places[i].Id != i)
            {
                throw new ArgumentException("Place ids must be their index in the list.", nameof(places));
            }
        }

        var members = new List<int>[(2 * n) - 1];
        for (var i = 0; i < n; i++)
        {
            members[i] = [i];
        }

        // One slot per starting cluster. A merge writes the union into the
        // lower slot and retires the higher one, so the distance matrix never
        // grows and a slot's row is only ever recomputed, never appended.
        var slotCluster = new int[n];
        var sumLat = new double[n];
        var sumLng = new double[n];
        var count = new int[n];
        var active = new bool[n];
        for (var i = 0; i < n; i++)
        {
            slotCluster[i] = i;
            sumLat[i] = places[i].Lat;
            sumLng[i] = places[i].Lng;
            count[i] = 1;
            active[i] = true;
        }

        LatLng CenterOf(int slot) => new(sumLat[slot] / count[slot], sumLng[slot] / count[slot]);

        var distance = new double[n, n];
        for (var i = 0; i < n; i++)
        {
            for (var j = i + 1; j < n; j++)
            {
                distance[i, j] = Geo.DistanceMeters(places[i].Position, places[j].Position);
            }
        }

        var merges = new List<Merge>(n - 1);
        for (var step = 0; step < n - 1; step++)
        {
            // Closest pair, ties to the lowest (i, j) so the output is
            // deterministic — the same file always clusters the same way.
            int bestI = -1, bestJ = -1;
            var best = double.PositiveInfinity;
            for (var i = 0; i < n; i++)
            {
                if (!active[i])
                {
                    continue;
                }

                for (var j = i + 1; j < n; j++)
                {
                    if (active[j] && distance[i, j] < best)
                    {
                        best = distance[i, j];
                        bestI = i;
                        bestJ = j;
                    }
                }
            }

            var into = n + step;
            var a = slotCluster[bestI];
            var b = slotCluster[bestJ];
            members[into] = [.. members[a], .. members[b]];
            merges.Add(new Merge(a, b, into, best));

            slotCluster[bestI] = into;
            sumLat[bestI] += sumLat[bestJ];
            sumLng[bestI] += sumLng[bestJ];
            count[bestI] += count[bestJ];
            active[bestJ] = false;

            var center = CenterOf(bestI);
            for (var k = 0; k < n; k++)
            {
                if (!active[k] || k == bestI)
                {
                    continue;
                }

                var d = Geo.DistanceMeters(center, CenterOf(k));
                if (k < bestI)
                {
                    distance[k, bestI] = d;
                }
                else
                {
                    distance[bestI, k] = d;
                }
            }
        }

        var clusters = new Cluster[members.Length];
        for (var id = 0; id < members.Length; id++)
        {
            clusters[id] = Describe(id, members[id], places);
        }

        return new Dendrogram(places, clusters, merges);
    }

    private static Cluster Describe(int id, List<int> placeIds, IReadOnlyList<Place> places)
    {
        var positions = placeIds.Select(p => places[p].Position).ToArray();
        var center = Geo.Centroid(positions);
        var spread = positions.Average(p => Geo.DistanceMeters(p, center));

        var route = RoutePlanner.Plan(positions);
        if (route is null)
        {
            return new Cluster(id, [.. placeIds.Order()], center, spread, null);
        }

        return new Cluster(id, [.. route.Order.Select(i => placeIds[i])], center, spread, route.LengthMeters);
    }
}
