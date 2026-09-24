namespace Geoclustering.Clustering;

/// <summary>An order to visit points in, as indexes into the input, and its length.</summary>
public sealed record Route(IReadOnlyList<int> Order, double LengthMeters);

/// <summary>
/// The shortest walk that visits every place in a cluster once.
///
/// An open path, not a round trip: you start at one place and finish at
/// another, which is what a day out looks like. Small clusters are solved
/// exactly; mid-sized ones get a good heuristic answer; big ones get none,
/// because a "route" through eighty places is not something anyone will walk.
/// </summary>
public static class RoutePlanner
{
    /// <summary>At or below this, Held–Karp: exact, O(n² · 2ⁿ).</summary>
    public const int MaxExactPlaces = 10;

    /// <summary>Above this, no route at all.</summary>
    public const int MaxRoutePlaces = 60;

    public static Route? Plan(IReadOnlyList<LatLng> points)
    {
        var n = points.Count;
        if (n == 0 || n > MaxRoutePlaces)
        {
            return null;
        }

        if (n == 1)
        {
            return new Route([0], 0);
        }

        var distance = new double[n, n];
        for (var i = 0; i < n; i++)
        {
            for (var j = i + 1; j < n; j++)
            {
                distance[i, j] = distance[j, i] = Geo.DistanceMeters(points[i], points[j]);
            }
        }

        var order = n <= MaxExactPlaces ? HeldKarp(distance, n) : Heuristic(distance, n);
        return new Route(order, Length(order, distance));
    }

    internal static double Length(IReadOnlyList<int> order, double[,] distance)
    {
        var total = 0.0;
        for (var i = 1; i < order.Count; i++)
        {
            total += distance[order[i - 1], order[i]];
        }

        return total;
    }

    /// <summary>
    /// Dynamic programming over subsets. <c>cost[mask, j]</c> is the shortest
    /// path that visits exactly the points in <c>mask</c> and ends at
    /// <c>j</c>; every point may start, since the path is open.
    /// </summary>
    private static int[] HeldKarp(double[,] distance, int n)
    {
        var full = (1 << n) - 1;
        var cost = new double[1 << n, n];
        var previous = new int[1 << n, n];
        for (var mask = 0; mask <= full; mask++)
        {
            for (var j = 0; j < n; j++)
            {
                cost[mask, j] = double.PositiveInfinity;
                previous[mask, j] = -1;
            }
        }

        for (var j = 0; j < n; j++)
        {
            cost[1 << j, j] = 0;
        }

        for (var mask = 1; mask <= full; mask++)
        {
            for (var j = 0; j < n; j++)
            {
                if ((mask & (1 << j)) == 0 || double.IsPositiveInfinity(cost[mask, j]))
                {
                    continue;
                }

                for (var next = 0; next < n; next++)
                {
                    if ((mask & (1 << next)) != 0)
                    {
                        continue;
                    }

                    var nextMask = mask | (1 << next);
                    var candidate = cost[mask, j] + distance[j, next];
                    if (candidate < cost[nextMask, next])
                    {
                        cost[nextMask, next] = candidate;
                        previous[nextMask, next] = j;
                    }
                }
            }
        }

        var end = 0;
        for (var j = 1; j < n; j++)
        {
            if (cost[full, j] < cost[full, end])
            {
                end = j;
            }
        }

        var order = new int[n];
        var current = end;
        var currentMask = full;
        for (var i = n - 1; i >= 0; i--)
        {
            order[i] = current;
            var before = previous[currentMask, current];
            currentMask &= ~(1 << current);
            current = before;
        }

        return order;
    }

    /// <summary>
    /// Nearest neighbour from every starting point, keep the shortest, then
    /// improve it with 2-opt until no single segment reversal helps. Not
    /// optimal, but within a few percent of it for points on a city map.
    /// </summary>
    private static int[] Heuristic(double[,] distance, int n)
    {
        int[]? best = null;
        var bestLength = double.PositiveInfinity;
        for (var start = 0; start < n; start++)
        {
            var candidate = NearestNeighbour(distance, n, start);
            var length = Length(candidate, distance);
            if (length < bestLength)
            {
                best = candidate;
                bestLength = length;
            }
        }

        TwoOpt(best!, distance);
        return best!;
    }

    private static int[] NearestNeighbour(double[,] distance, int n, int start)
    {
        var visited = new bool[n];
        var order = new int[n];
        order[0] = start;
        visited[start] = true;
        for (var i = 1; i < n; i++)
        {
            var from = order[i - 1];
            var nearest = -1;
            for (var j = 0; j < n; j++)
            {
                if (!visited[j] && (nearest < 0 || distance[from, j] < distance[from, nearest]))
                {
                    nearest = j;
                }
            }

            order[i] = nearest;
            visited[nearest] = true;
        }

        return order;
    }

    /// <summary>
    /// Reverse <c>order[i..j]</c> whenever that shortens the path. The ends of
    /// an open path have no neighbour beyond them, so an edge that would
    /// connect to one costs nothing — which is what lets 2-opt move the
    /// endpoints, not just the middle.
    /// </summary>
    private static void TwoOpt(int[] order, double[,] distance)
    {
        var n = order.Length;
        var improved = true;
        while (improved)
        {
            improved = false;
            for (var i = 0; i < n - 1; i++)
            {
                for (var j = i + 1; j < n; j++)
                {
                    var before = (i > 0 ? distance[order[i - 1], order[i]] : 0)
                        + (j < n - 1 ? distance[order[j], order[j + 1]] : 0);
                    var after = (i > 0 ? distance[order[i - 1], order[j]] : 0)
                        + (j < n - 1 ? distance[order[i], order[j + 1]] : 0);
                    if (after < before - 1e-9)
                    {
                        Array.Reverse(order, i, j - i + 1);
                        improved = true;
                    }
                }
            }
        }
    }
}
