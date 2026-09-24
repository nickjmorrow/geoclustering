using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Geoclustering.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Geoclustering.Tests;

public class ApiTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static MultipartFormDataContent Upload(string content, string fileName)
    {
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(content));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    [Fact]
    public async Task Health_says_ok()
    {
        var health = await _client.GetFromJsonAsync<Health>("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal("ok", health!.Status);
    }

    [Fact]
    public async Task Every_listed_sample_can_be_fetched_and_downloaded()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var samples = await _client.GetFromJsonAsync<SampleSummary[]>("/api/samples", cancellationToken);

        Assert.NotEmpty(samples!);
        foreach (var sample in samples!)
        {
            var clustering = await _client.GetFromJsonAsync<ClusteringResponse>($"/api/samples/{sample.Id}", cancellationToken);
            Assert.Equal(sample.PlaceCount, clustering!.Places.Count);
            Assert.Equal(sample.PlaceCount - 1, clustering.Merges.Count);

            var file = await _client.GetAsync(new Uri($"/api/samples/{sample.Id}/file", UriKind.Relative), cancellationToken);
            Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        }
    }

    [Fact]
    public async Task An_unknown_sample_is_a_404_problem()
    {
        var response = await _client.GetAsync(new Uri("/api/samples/atlantis", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task An_uploaded_KML_file_comes_back_clustered_and_named_after_its_document()
    {
        const string Kml = """
            <kml><Document><name>Two spots</name>
              <Placemark><name>A</name><Point><coordinates>-74.0,40.7</coordinates></Point></Placemark>
              <Placemark><name>B</name><Point><coordinates>-74.01,40.71</coordinates></Point></Placemark>
            </Document></kml>
            """;

        var response = await _client.PostAsync(new Uri("/api/clusterings", UriKind.Relative), Upload(Kml, "spots.kml"), TestContext.Current.CancellationToken);

        response.EnsureSuccessStatusCode();
        var clustering = await response.Content.ReadFromJsonAsync<ClusteringResponse>(TestContext.Current.CancellationToken);
        Assert.Equal("Two spots", clustering!.Name);
        Assert.Equal(3, clustering.Clusters.Count);
    }

    [Fact]
    public async Task A_bad_upload_is_a_400_problem_with_a_readable_reason()
    {
        var response = await _client.PostAsync(new Uri("/api/clusterings", UriKind.Relative), Upload("<kml></kml>", "empty.kml"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestContext.Current.CancellationToken);
        Assert.Equal("No places were found in this file.", problem!.Detail);
    }

    [Fact]
    public async Task An_upload_without_a_file_is_a_400_problem()
    {
        var response = await _client.PostAsync(new Uri("/api/clusterings", UriKind.Relative), new MultipartFormDataContent(), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_file_over_the_size_limit_is_a_413_problem()
    {
        var huge = new string('x', 6 * 1024 * 1024);

        var response = await _client.PostAsync(new Uri("/api/clusterings", UriKind.Relative), Upload(huge, "huge.kml"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task The_API_documents_itself()
    {
        var response = await _client.GetAsync(new Uri("/api/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);

        response.EnsureSuccessStatusCode();
        Assert.Contains("/api/clusterings", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
    }
}
