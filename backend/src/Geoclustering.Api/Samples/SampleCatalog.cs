using Geoclustering.Api.PlaceFiles;
using Geoclustering.Clustering;

namespace Geoclustering.Api.Samples;

/// <summary>
/// The demo datasets. Each is a real KML file, read by the same parser as an
/// upload, so the samples double as a check that the upload path works.
/// Clustered once at startup: a broken sample stops the app from starting
/// rather than failing the first visitor who clicks it.
/// </summary>
public sealed class SampleCatalog
{
    private static readonly (string Id, string Description)[] Definitions =
    [
        ("new-york", "The list that started this project: sights, museums and food across five boroughs."),
        ("tokyo", "A week's worth of Tokyo, from Asakusa to Kichijōji — a much bigger city to spread out over."),
    ];

    private readonly Dictionary<string, (SampleSummary Summary, ClusteringResponse Clustering, byte[] File)> _samples;

    public SampleCatalog()
    {
        _samples = Definitions.ToDictionary(d => d.Id, d =>
        {
            var file = ReadResource($"Samples.{d.Id}.kml");
            var parsed = PlaceFileReader.Read(new MemoryStream(file), $"{d.Id}.kml");
            var name = parsed.Name ?? d.Id;
            var clustering = ClusteringResponse.From(name, HierarchicalClusterer.Cluster(parsed.Places), parsed.Skipped);
            return (new SampleSummary(d.Id, name, d.Description, parsed.Places.Count), clustering, file);
        });
    }

    public IReadOnlyList<SampleSummary> List() => [.. Definitions.Select(d => _samples[d.Id].Summary)];

    public ClusteringResponse? Clustering(string id) => _samples.TryGetValue(id, out var sample) ? sample.Clustering : null;

    public byte[]? File(string id) => _samples.TryGetValue(id, out var sample) ? sample.File : null;

    private static byte[] ReadResource(string name)
    {
        using var stream = typeof(SampleCatalog).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded sample '{name}' is missing.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
