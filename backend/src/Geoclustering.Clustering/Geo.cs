namespace Geoclustering.Clustering;

/// <summary>A point on the Earth, in degrees.</summary>
public readonly record struct LatLng(double Lat, double Lng);

/// <summary>Distances on the Earth's surface, in meters.</summary>
public static class Geo
{
    private const double EarthRadiusMeters = 6_371_008.8;

    /// <summary>
    /// Great-circle distance by the haversine formula. Accurate to a fraction
    /// of a percent at city scale, which is several orders of magnitude better
    /// than the question ("which places are near each other") needs.
    /// </summary>
    public static double DistanceMeters(LatLng a, LatLng b)
    {
        var lat1 = ToRadians(a.Lat);
        var lat2 = ToRadians(b.Lat);
        var dLat = lat2 - lat1;
        var dLng = ToRadians(b.Lng - a.Lng);

        var h = (Math.Sin(dLat / 2) * Math.Sin(dLat / 2))
            + (Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2));
        return 2 * EarthRadiusMeters * Math.Asin(Math.Min(1, Math.Sqrt(h)));
    }

    /// <summary>
    /// The mean of the coordinates. Not the true spherical centroid, and wrong
    /// for a set of points straddling the antimeridian — both acceptable for
    /// places someone plans to visit in the same trip.
    /// </summary>
    public static LatLng Centroid(IEnumerable<LatLng> points)
    {
        double lat = 0, lng = 0;
        var count = 0;
        foreach (var point in points)
        {
            lat += point.Lat;
            lng += point.Lng;
            count++;
        }

        if (count == 0)
        {
            throw new ArgumentException("A centroid needs at least one point.", nameof(points));
        }

        return new LatLng(lat / count, lng / count);
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
