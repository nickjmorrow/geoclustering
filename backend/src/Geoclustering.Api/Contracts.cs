using Geoclustering.Clustering;

namespace Geoclustering.Api;

/// <summary>A clustered set of places: the whole dendrogram, plus what the client needs to label it.</summary>
/// <param name="Name">What to call it: the file's own title, or its filename.</param>
/// <param name="Skipped">Entries in the file that weren't a single point, so weren't clustered.</param>
public sealed record ClusteringResponse(
    string Name,
    IReadOnlyList<Place> Places,
    IReadOnlyList<Cluster> Clusters,
    IReadOnlyList<Merge> Merges,
    int Skipped)
{
    public static ClusteringResponse From(string name, Dendrogram dendrogram, int skipped) =>
        new(name, dendrogram.Places, dendrogram.Clusters, dendrogram.Merges, skipped);
}

public sealed record SampleSummary(string Id, string Name, string Description, int PlaceCount);

public sealed record Health(string Status);
