using System.Threading.RateLimiting;
using Geoclustering.Api;
using Geoclustering.Api.PlaceFiles;
using Geoclustering.Api.Samples;
using Geoclustering.Clustering;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;

const long MaxUploadBytes = 5 * 1024 * 1024;
const string UploadPolicy = "uploads";

var builder = WebApplication.CreateBuilder(args);

// The only settings this app has, read in one place. Everything else is a
// constant next to the code it governs.
var logFormat = builder.Configuration["LOG_FORMAT"] ?? "console";
var uploadsPerMinute = builder.Configuration.GetValue("UPLOADS_PER_MINUTE", 20);

if (logFormat == "json")
{
    builder.Logging.ClearProviders().AddJsonConsole();
}

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<SampleCatalog>();

builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = MaxUploadBytes);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = MaxUploadBytes + (64 * 1024));

// Behind Caddy and nginx, the connection comes from nginx. The client's
// address is in X-Forwarded-For, and the rate limit below is only per-visitor
// if it reads that. Trusting any proxy is safe here because the API port is
// never published: nothing but nginx, on the Compose network, can reach it.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// Clustering is CPU work on the request thread. A public demo with no
// accounts needs something between it and a loop of uploads.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(UploadPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = uploadsPerMinute, Window = TimeSpan.FromMinutes(1) }));
    o.OnRejected = async (context, cancellationToken) =>
    {
        var problems = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context.HttpContext,
            ProblemDetails =
            {
                Title = "Too many uploads",
                Detail = "You've uploaded a lot of files in the last minute. Wait a moment and try again.",
                Status = StatusCodes.Status429TooManyRequests,
            },
        });
    };
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRateLimiter();

// Everything lives under /api: nginx forwards exactly that prefix, so the
// docs are reachable on the public demo without a second proxy rule.
app.MapOpenApi("/api/openapi/{documentName}.json");
app.MapScalarApiReference("/api/docs", o => o
    .WithTitle("Geoclustering API")
    .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));

var api = app.MapGroup("/api");

api.MapGet("/health", () => new Health("ok"))
    .WithSummary("Liveness check");

api.MapGet("/samples", (SampleCatalog samples) => samples.List())
    .WithSummary("The demo datasets");

api.MapGet("/samples/{id}", (string id, SampleCatalog samples) =>
        samples.Clustering(id) is { } clustering
            ? Results.Ok(clustering)
            : Results.Problem(title: "No such sample", detail: $"There is no sample called '{id}'.", statusCode: 404))
    .WithSummary("A demo dataset, clustered")
    .Produces<ClusteringResponse>();

api.MapGet("/samples/{id}/file", (string id, SampleCatalog samples) =>
        samples.File(id) is { } file
            ? Results.File(file, "application/vnd.google-earth.kml+xml", $"{id}.kml")
            : Results.Problem(title: "No such sample", detail: $"There is no sample called '{id}'.", statusCode: 404))
    .WithSummary("A demo dataset's KML file, to see what an upload looks like");

api.MapPost("/clusterings", async (HttpRequest request, ILogger<Program> logger) =>
    {
        // The form is read here rather than bound as a parameter, so that a
        // malformed or oversized body is this endpoint's 400 or 413 with a
        // sentence attached, not model binding's bare 500.
        IFormFile? file;
        try
        {
            file = request.HasFormContentType ? (await request.ReadFormAsync()).Files.GetFile("file") : null;
        }
        catch (Exception caught) when (caught is InvalidDataException or IOException or BadHttpRequestException)
        {
            return caught is BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge }
                || caught is InvalidDataException && caught.Message.Contains("limit", StringComparison.OrdinalIgnoreCase)
                ? Results.Problem(title: "File too large", detail: "That file is larger than the 5 MB limit.", statusCode: 413)
                : Results.Problem(title: "Unreadable upload", detail: "The upload couldn't be read. Try choosing the file again.", statusCode: 400);
        }

        if (file is null || file.Length == 0)
        {
            return Results.Problem(title: "No file", detail: "Choose a KML, KMZ or GeoJSON file to upload.", statusCode: 400);
        }

        try
        {
            using var stream = file.OpenReadStream();
            var parsed = PlaceFileReader.Read(stream, file.FileName);
            var name = parsed.Name ?? Path.GetFileNameWithoutExtension(file.FileName);
            var clustering = ClusteringResponse.From(name, HierarchicalClusterer.Cluster(parsed.Places), parsed.Skipped);
            Log.Clustered(logger, parsed.Places.Count, parsed.Skipped);
            return Results.Ok(clustering);
        }
        catch (PlaceFileException caught)
        {
            return Results.Problem(title: "That file couldn't be clustered", detail: caught.Message, statusCode: 400);
        }
    })
    .Accepts<IFormFile>("multipart/form-data")
    .DisableAntiforgery()
    .RequireRateLimiting(UploadPolicy)
    .WithSummary("Cluster the places in an uploaded KML, KMZ or GeoJSON file")
    .Produces<ClusteringResponse>();

// Built eagerly, so a broken sample fails the deploy rather than a visitor.
app.Services.GetRequiredService<SampleCatalog>();

app.Run();

/// <summary>Visible to the integration tests' WebApplicationFactory.</summary>
public partial class Program;

internal static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Clustered {PlaceCount} places ({Skipped} skipped)")]
    public static partial void Clustered(ILogger logger, int placeCount, int skipped);
}
