# Three stages: the SDK for building, a dev stage with hot reload, and the
# runtime image. `production` is last, so a bare `docker build` gives you the
# deployable image; docker-compose.yml asks for `dev` explicitly.
#
# Alpine for both halves: small, and — unlike the Debian runtime image — it
# has busybox `wget` for the healthcheck without installing anything.

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Restore as its own layer, keyed on the project files only, so a source edit
# doesn't re-download every package.
COPY global.json Directory.Build.props Geoclustering.slnx ./
COPY src/Geoclustering.Api/Geoclustering.Api.csproj src/Geoclustering.Api/
COPY src/Geoclustering.Clustering/Geoclustering.Clustering.csproj src/Geoclustering.Clustering/
RUN dotnet restore src/Geoclustering.Api/Geoclustering.Api.csproj

COPY .editorconfig ./
COPY src/ src/
RUN dotnet publish src/Geoclustering.Api/Geoclustering.Api.csproj -c Release -o /app --no-restore


# ---------------------------------------------------------------------- dev
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS dev
WORKDIR /src
ENV DOTNET_USE_POLLING_FILE_WATCHER=true \
    ASPNETCORE_ENVIRONMENT=Development \
    ASPNETCORE_HTTP_PORTS=8000
COPY . .
RUN dotnet restore src/Geoclustering.Api/Geoclustering.Api.csproj
EXPOSE 8000
CMD ["dotnet", "watch", "--project", "src/Geoclustering.Api", "run", "--no-launch-profile"]


# --------------------------------------------------------------- production
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS production
WORKDIR /app
COPY --from=build /app .

# The image ships a non-root `app` user; run as it. Port 8000 to match every
# other backend on the demo server, so nginx configs read the same.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8000
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8000/api/health >/dev/null || exit 1

ENTRYPOINT ["dotnet", "Geoclustering.Api.dll"]
