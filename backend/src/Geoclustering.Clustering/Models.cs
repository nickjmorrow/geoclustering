namespace Geoclustering.Clustering;

/// <summary>One place to visit. <see cref="Id"/> is its index in the input.</summary>
public sealed record Place(int Id, string Name, double Lat, double Lng)
{
    public LatLng Position => new(Lat, Lng);
}

/// <summary>
/// A node in the dendrogram: a single place (ids <c>0..n-1</c>) or the union of
/// two earlier nodes (ids <c>n..2n-2</c>).
/// </summary>
/// <param name="PlaceIds">
/// The members, in the order to visit them when <paramref name="RouteMeters"/>
/// is set; in input order when it is not.
/// </param>
/// <param name="SpreadMeters">Mean distance from a member to <paramref name="Center"/>.</param>
/// <param name="RouteMeters">
/// Length of the shortest walk found through every member, or null when the
/// cluster is too large for a route to mean anything.
/// </param>
public sealed record Cluster(
    int Id,
    IReadOnlyList<int> PlaceIds,
    LatLng Center,
    double SpreadMeters,
    double? RouteMeters);

/// <summary>Clusters <paramref name="A"/> and <paramref name="B"/> became <paramref name="Into"/>.</summary>
/// <param name="DistanceMeters">How far apart their centers were when they merged.</param>
public sealed record Merge(int A, int B, int Into, double DistanceMeters);

/// <summary>
/// The whole hierarchy, computed once. Applying the first <c>n - k</c> merges
/// to the <c>n</c> single-place clusters gives the <c>k</c>-cluster answer, for
/// every <c>k</c> — so the client can move between cluster counts without
/// asking the server again.
/// </summary>
public sealed record Dendrogram(
    IReadOnlyList<Place> Places,
    IReadOnlyList<Cluster> Clusters,
    IReadOnlyList<Merge> Merges);
