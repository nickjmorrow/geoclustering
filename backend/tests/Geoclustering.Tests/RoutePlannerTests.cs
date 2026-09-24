using Geoclustering.Clustering;

namespace Geoclustering.Tests;

public class RoutePlannerTests
{
    private static LatLng[] Line(params int[] positions) => [.. positions.Select(p => new LatLng(0, p * 0.001))];

    [Fact]
    public void Nothing_to_plan_for_no_places()
    {
        Assert.Null(RoutePlanner.Plan([]));
    }

    [Fact]
    public void One_place_is_a_route_of_length_zero()
    {
        var route = RoutePlanner.Plan([new LatLng(1, 1)])!;

        Assert.Equal([0], route.Order);
        Assert.Equal(0, route.LengthMeters);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(RoutePlanner.MaxExactPlaces)]
    [InlineData(RoutePlanner.MaxExactPlaces + 1)]
    [InlineData(RoutePlanner.MaxRoutePlaces)]
    public void Places_on_a_line_are_walked_end_to_end(int count)
    {
        // Shuffled, so the answer can't come from the input order.
        var positions = Enumerable.Range(0, count).OrderBy(i => (i * 7919) % count).ToArray();
        var points = Line(positions);

        var route = RoutePlanner.Plan(points)!;

        var visited = route.Order.Select(i => positions[i]).ToArray();
        Assert.True(visited.SequenceEqual(visited.Order()) || visited.SequenceEqual(visited.OrderDescending()));
        Assert.Equal(Geo.DistanceMeters(new(0, 0), new(0, (count - 1) * 0.001)), route.LengthMeters, 3);
    }

    [Fact]
    public void Too_many_places_get_no_route()
    {
        Assert.Null(RoutePlanner.Plan(Line([.. Enumerable.Range(0, RoutePlanner.MaxRoutePlaces + 1)])));
    }

    [Fact]
    public void Held_Karp_matches_brute_force()
    {
        var random = new Random(42);
        for (var trial = 0; trial < 20; trial++)
        {
            var points = Enumerable.Range(0, 7).Select(_ => new LatLng(random.NextDouble(), random.NextDouble())).ToArray();

            var route = RoutePlanner.Plan(points)!;

            Assert.Equal(BruteForce(points), route.LengthMeters, 6);
        }
    }

    [Fact]
    public void The_heuristic_stays_close_to_optimal_on_a_grid()
    {
        // A 4×4 grid: the best open path is a serpentine of 15 unit steps.
        var points = (from row in Enumerable.Range(0, 4) from col in Enumerable.Range(0, 4) select new LatLng(row * 0.001, col * 0.001)).ToArray();
        var step = Geo.DistanceMeters(new(0, 0), new(0, 0.001));

        var route = RoutePlanner.Plan(points)!;

        Assert.Equal(16, route.Order.Distinct().Count());
        Assert.True(route.LengthMeters <= 15 * step * 1.05, $"{route.LengthMeters} vs optimal {15 * step}");
    }

    private static double BruteForce(LatLng[] points)
    {
        var best = double.PositiveInfinity;
        foreach (var order in Permutations([.. Enumerable.Range(0, points.Length)]))
        {
            var length = 0.0;
            for (var i = 1; i < order.Length; i++)
            {
                length += Geo.DistanceMeters(points[order[i - 1]], points[order[i]]);
            }

            best = Math.Min(best, length);
        }

        return best;
    }

    private static IEnumerable<int[]> Permutations(int[] items)
    {
        if (items.Length <= 1)
        {
            yield return items;
            yield break;
        }

        for (var i = 0; i < items.Length; i++)
        {
            var rest = items.Where((_, j) => j != i).ToArray();
            foreach (var tail in Permutations(rest))
            {
                yield return [items[i], .. tail];
            }
        }
    }
}
