using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Geoclustering.Clustering;

namespace Geoclustering.Api.PlaceFiles;

/// <summary>A problem with the uploaded file, worded for the person who uploaded it.</summary>
public sealed class PlaceFileException(string message) : Exception(message);

/// <summary>The places found in a file, and how many entries could not be used.</summary>
/// <param name="Name">The file's own title (a KML document name), when it has one.</param>
/// <param name="Skipped">Entries that were not a single point: lines, shapes, or bad coordinates.</param>
public sealed record PlaceFile(string? Name, IReadOnlyList<Place> Places, int Skipped);

/// <summary>
/// Reads the three formats Google hands your places out in: KML and KMZ from
/// Google My Maps ("Export to KML/KMZ"), and GeoJSON from Google Takeout
/// ("Saved Places.json"). Any other KML or GeoJSON with point features works
/// too.
/// </summary>
public static class PlaceFileReader
{
    /// <summary>Upper bound on a KML document unzipped from a KMZ.</summary>
    private const long MaxUnzippedBytes = 20 * 1024 * 1024;

    private const int MaxNameLength = 200;

    public static PlaceFile Read(Stream stream, string fileName)
    {
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        var bytes = buffer.ToArray();

        var parsed = DetectFormat(bytes, fileName) switch
        {
            Format.Kmz => ReadKml(Unzip(bytes)),
            Format.GeoJson => ReadGeoJson(bytes),
            _ => ReadKml(bytes),
        };

        if (parsed.Places.Count == 0)
        {
            var skipped = parsed.Skipped > 0
                ? $" It has {parsed.Skipped} {Plural(parsed.Skipped, "entry", "entries")}, but none is a single point — lines and shapes can't be clustered."
                : "";
            throw new PlaceFileException($"No places were found in this file.{skipped}");
        }

        if (parsed.Places.Count > HierarchicalClusterer.MaxPlaces)
        {
            throw new PlaceFileException(
                $"This file has {parsed.Places.Count} places; the limit is {HierarchicalClusterer.MaxPlaces}. Split it into smaller maps and upload each one.");
        }

        return parsed;
    }

    private enum Format
    {
        Kml,
        Kmz,
        GeoJson,
    }

    private static Format DetectFormat(byte[] bytes, string fileName)
    {
        var extension = Path.GetExtension(fileName).ToUpperInvariant();
        switch (extension)
        {
            case ".KMZ":
                return Format.Kmz;
            case ".KML":
                return Format.Kml;
            case ".JSON" or ".GEOJSON":
                return Format.GeoJson;
        }

        // No useful extension: look at the content. A zip starts "PK", JSON
        // with a brace, and anything else is given to the XML parser, which
        // will say clearly if it is not XML either.
        if (bytes.Length >= 2 && bytes[0] == 'P' && bytes[1] == 'K')
        {
            return Format.Kmz;
        }

        var first = bytes.Select(b => (char)b).FirstOrDefault(c => !char.IsWhiteSpace(c) && c != '﻿' && c < 128);
        return first is '{' or '[' ? Format.GeoJson : Format.Kml;
    }

    private static byte[] Unzip(byte[] bytes)
    {
        try
        {
            using var archive = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);

            // Google My Maps names it doc.kml; the KMZ spec only says "the
            // first .kml file". Prefer the conventional name, then fall back.
            var entry = archive.Entries.FirstOrDefault(e => e.FullName.Equals("doc.kml", StringComparison.OrdinalIgnoreCase))
                ?? archive.Entries.FirstOrDefault(e => e.FullName.EndsWith(".kml", StringComparison.OrdinalIgnoreCase))
                ?? throw new PlaceFileException("This KMZ file doesn't contain a KML document.");

            // Copied with a hard cap rather than trusting the entry's declared
            // size, which is just a number in a header the uploader wrote.
            using var source = entry.Open();
            using var target = new MemoryStream();
            var chunk = new byte[81920];
            int read;
            while ((read = source.Read(chunk)) > 0)
            {
                if (target.Length + read > MaxUnzippedBytes)
                {
                    throw new PlaceFileException("The KML inside this KMZ file is too large.");
                }

                target.Write(chunk, 0, read);
            }

            return target.ToArray();
        }
        catch (InvalidDataException)
        {
            throw new PlaceFileException("This file looks like a KMZ, but it couldn't be unzipped.");
        }
    }

    private static PlaceFile ReadKml(byte[] bytes)
    {
        XDocument document;
        try
        {
            // DTDs off and no resolver: an uploaded XML file must not be able
            // to make the server fetch URLs or expand entities.
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
            using var reader = XmlReader.Create(new MemoryStream(bytes), settings);
            document = XDocument.Load(reader);
        }
        catch (XmlException)
        {
            throw new PlaceFileException("This file couldn't be read. Upload a KML or KMZ file exported from Google My Maps, or a GeoJSON file.");
        }

        // Namespace-blind throughout: KML in the wild uses the 2.0, 2.1 and
        // 2.2 namespaces, the Google extension namespace, and sometimes none.
        var documentName = document.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "Document")
            ?.Elements().FirstOrDefault(e => e.Name.LocalName == "name")?.Value;

        var places = new List<Place>();
        var skipped = 0;
        foreach (var placemark in document.Descendants().Where(e => e.Name.LocalName == "Placemark"))
        {
            var coordinates = placemark.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "Point")
                ?.Elements().FirstOrDefault(e => e.Name.LocalName == "coordinates")?.Value;
            var name = placemark.Elements().FirstOrDefault(e => e.Name.LocalName == "name")?.Value;

            if (coordinates is null || !TryParseKmlCoordinates(coordinates, out var lng, out var lat))
            {
                skipped++;
                continue;
            }

            places.Add(new Place(places.Count, CleanName(name, places.Count), lat, lng));
        }

        return new PlaceFile(CleanTitle(documentName), places, skipped);
    }

    /// <summary>KML writes "longitude,latitude[,altitude]" — longitude first.</summary>
    private static bool TryParseKmlCoordinates(string text, out double lng, out double lat)
    {
        lng = lat = 0;
        var first = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        var parts = first?.Split(',');
        return parts is { Length: >= 2 }
            && double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out lng)
            && double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out lat)
            && IsValid(lat, lng);
    }

    private static PlaceFile ReadGeoJson(byte[] bytes)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(bytes, new JsonDocumentOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip });
        }
        catch (JsonException)
        {
            throw new PlaceFileException("This file isn't valid JSON. Upload a GeoJSON file, such as “Saved Places.json” from Google Takeout.");
        }

        using (document)
        {
            var root = document.RootElement;
            IEnumerable<JsonElement> features = root.ValueKind switch
            {
                JsonValueKind.Object when GetString(root, "type") == "FeatureCollection"
                    && root.TryGetProperty("features", out var list) && list.ValueKind == JsonValueKind.Array => list.EnumerateArray(),
                JsonValueKind.Object when GetString(root, "type") == "Feature" => [root],
                _ => throw new PlaceFileException("This JSON file isn't GeoJSON. Expected a FeatureCollection of points, like “Saved Places.json” from Google Takeout."),
            };

            var places = new List<Place>();
            var skipped = 0;
            foreach (var feature in features)
            {
                if (!TryReadGeoJsonPoint(feature, out var lng, out var lat))
                {
                    skipped++;
                    continue;
                }

                places.Add(new Place(places.Count, CleanName(GeoJsonName(feature), places.Count), lat, lng));
            }

            return new PlaceFile(CleanTitle(GetString(root, "name")), places, skipped);
        }
    }

    private static bool TryReadGeoJsonPoint(JsonElement feature, out double lng, out double lat)
    {
        lng = lat = 0;
        if (feature.ValueKind != JsonValueKind.Object
            || !feature.TryGetProperty("geometry", out var geometry)
            || geometry.ValueKind != JsonValueKind.Object
            || GetString(geometry, "type") != "Point"
            || !geometry.TryGetProperty("coordinates", out var coordinates)
            || coordinates.ValueKind != JsonValueKind.Array
            || coordinates.GetArrayLength() < 2
            || !coordinates[0].TryGetDouble(out lng)
            || !coordinates[1].TryGetDouble(out lat))
        {
            return false;
        }

        // Google Takeout writes [0, 0] for a saved place it has no location
        // for. Null Island is not on anyone's list.
        return IsValid(lat, lng) && !(lat == 0 && lng == 0);
    }

    /// <summary>
    /// Wherever the file keeps a name. Takeout has used <c>properties.name</c>,
    /// <c>properties.Title</c> and <c>properties.location.name</c> over the
    /// years, falling back to an address when there is no name at all.
    /// </summary>
    private static string? GeoJsonName(JsonElement feature)
    {
        if (!feature.TryGetProperty("properties", out var properties) || properties.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var location = properties.TryGetProperty("location", out var l) && l.ValueKind == JsonValueKind.Object ? l : (JsonElement?)null;
        return GetString(properties, "name")
            ?? GetString(properties, "Name")
            ?? GetString(properties, "title")
            ?? GetString(properties, "Title")
            ?? (location is { } loc ? GetString(loc, "name") ?? GetString(loc, "Business Name") ?? GetString(loc, "address") ?? GetString(loc, "Address") : null);
    }

    private static string? GetString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static bool IsValid(double lat, double lng) =>
        double.IsFinite(lat) && double.IsFinite(lng) && lat is >= -90 and <= 90 && lng is >= -180 and <= 180;

    private static string CleanName(string? name, int index)
    {
        var cleaned = Truncate(name);
        return string.IsNullOrEmpty(cleaned) ? $"Untitled place {index + 1}" : cleaned;
    }

    private static string? CleanTitle(string? title)
    {
        var cleaned = Truncate(title);
        return string.IsNullOrEmpty(cleaned) ? null : cleaned;
    }

    private static string? Truncate(string? text)
    {
        var collapsed = text is null ? null : string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return collapsed is { Length: > MaxNameLength } ? collapsed[..MaxNameLength].TrimEnd() + "…" : collapsed;
    }

    private static string Plural(int count, string one, string many) => count == 1 ? one : many;
}
