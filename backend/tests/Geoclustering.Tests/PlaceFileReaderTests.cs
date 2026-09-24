using System.IO.Compression;
using System.Text;
using Geoclustering.Api.PlaceFiles;

namespace Geoclustering.Tests;

public class PlaceFileReaderTests
{
    private const string MyMapsKml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>Weekend in Lisbon</name>
            <Folder>
              <name>Sights</name>
              <Placemark><name>Belém Tower</name><Point><coordinates>
                -9.2160,38.6916,0
              </coordinates></Point></Placemark>
              <Placemark><name>A walking route</name><LineString><coordinates>-9.1,38.7,0 -9.2,38.7,0</coordinates></LineString></Placemark>
            </Folder>
            <Folder>
              <name>Food</name>
              <Placemark><name>Time Out Market</name><Point><coordinates>-9.1459,38.7069</coordinates></Point></Placemark>
            </Folder>
          </Document>
        </kml>
        """;

    private static PlaceFile Read(string content, string fileName) =>
        PlaceFileReader.Read(new MemoryStream(Encoding.UTF8.GetBytes(content)), fileName);

    [Fact]
    public void Reads_points_from_nested_My_Maps_folders_and_skips_lines()
    {
        var file = Read(MyMapsKml, "lisbon.kml");

        Assert.Equal("Weekend in Lisbon", file.Name);
        Assert.Equal(1, file.Skipped);
        Assert.Collection(file.Places,
            p =>
            {
                Assert.Equal((0, "Belém Tower", 38.6916, -9.2160), (p.Id, p.Name, p.Lat, p.Lng));
            },
            p => Assert.Equal((1, "Time Out Market"), (p.Id, p.Name)));
    }

    [Fact]
    public void Reads_KML_without_a_namespace_or_names()
    {
        var file = Read("<kml><Placemark><Point><coordinates>1,2</coordinates></Point></Placemark></kml>", "x.kml");

        var place = Assert.Single(file.Places);
        Assert.Equal(("Untitled place 1", 2.0, 1.0), (place.Name, place.Lat, place.Lng));
        Assert.Null(file.Name);
    }

    [Fact]
    public void Reads_a_KMZ_from_its_doc_kml()
    {
        using var zip = new MemoryStream();
        using (var archive = new ZipArchive(zip, ZipArchiveMode.Create, leaveOpen: true))
        {
            using var writer = new StreamWriter(archive.CreateEntry("doc.kml").Open());
            writer.Write(MyMapsKml);
        }

        var file = PlaceFileReader.Read(new MemoryStream(zip.ToArray()), "lisbon.kmz");

        Assert.Equal(2, file.Places.Count);
    }

    [Fact]
    public void Recognises_the_format_from_content_when_the_extension_says_nothing()
    {
        Assert.Equal(2, Read(MyMapsKml, "download").Places.Count);
        Assert.Single(Read("""{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]}}]}""", "download").Places);
    }

    [Fact]
    public void Reads_Google_Takeout_saved_places()
    {
        var file = Read("""
            {
              "type": "FeatureCollection",
              "features": [
                { "geometry": { "coordinates": [-73.9857, 40.7484], "type": "Point" },
                  "properties": { "date": "2019-01-01T00:00:00Z", "location": { "name": "Empire State Building", "address": "20 W 34th St" } },
                  "type": "Feature" },
                { "geometry": { "coordinates": [-73.99, 40.73], "type": "Point" },
                  "properties": { "Title": "Somewhere" }, "type": "Feature" },
                { "geometry": { "coordinates": [0, 0], "type": "Point" },
                  "properties": { "location": { "name": "No location recorded" } }, "type": "Feature" }
              ]
            }
            """, "Saved Places.json");

        Assert.Equal(["Empire State Building", "Somewhere"], file.Places.Select(p => p.Name));
        Assert.Equal(1, file.Skipped);
    }

    [Fact]
    public void A_file_with_no_points_says_so()
    {
        var caught = Assert.Throws<PlaceFileException>(() =>
            Read("<kml><Placemark><LineString><coordinates>1,2 3,4</coordinates></LineString></Placemark></kml>", "x.kml"));

        Assert.Contains("none is a single point", caught.Message);
    }

    [Theory]
    [InlineData("not xml at all", "x.kml")]
    [InlineData("{ nope", "x.json")]
    [InlineData("""{"type":"Topology"}""", "x.json")]
    [InlineData("PK not really a zip", "x.kmz")]
    public void Unreadable_files_are_refused_with_a_message(string content, string fileName)
    {
        var caught = Assert.Throws<PlaceFileException>(() => Read(content, fileName));

        Assert.False(string.IsNullOrWhiteSpace(caught.Message));
    }

    [Fact]
    public void Coordinates_out_of_range_are_skipped()
    {
        var file = Read("""
            <kml>
              <Placemark><Point><coordinates>200,10</coordinates></Point></Placemark>
              <Placemark><Point><coordinates>10,10</coordinates></Point></Placemark>
            </kml>
            """, "x.kml");

        Assert.Single(file.Places);
        Assert.Equal(1, file.Skipped);
    }

    [Fact]
    public void Document_type_definitions_are_refused()
    {
        // An entity-expansion payload. It must not be parsed, let alone expanded.
        const string Payload = """
            <?xml version="1.0"?>
            <!DOCTYPE kml [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>
            <kml><Placemark><name>&b;</name><Point><coordinates>1,2</coordinates></Point></Placemark></kml>
            """;

        Assert.Throws<PlaceFileException>(() => Read(Payload, "x.kml"));
    }

    [Fact]
    public void More_than_the_limit_is_refused()
    {
        var placemarks = string.Concat(Enumerable.Range(0, 501).Select(i => $"<Placemark><Point><coordinates>{i * 0.001},1</coordinates></Point></Placemark>"));

        var caught = Assert.Throws<PlaceFileException>(() => Read($"<kml>{placemarks}</kml>", "x.kml"));

        Assert.Contains("501 places", caught.Message);
    }
}
