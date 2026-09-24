# Geoclustering

[![CI](https://github.com/nickjmorrow/geoclustering/actions/workflows/ci.yml/badge.svg)](https://github.com/nickjmorrow/geoclustering/actions/workflows/ci.yml)

Upload the places you've saved in Google Maps, and Geoclustering groups them
into clusters you can visit in a day, each with the shortest walk through it.

**[Live demo](https://geoclustering.204-168-227-216.sslip.io)**: pick Tokyo,
drag the slider, and click a group to see its route. No sign-up needed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/desktop-dark.png">
  <img alt="Tokyo's 34 places grouped into 8 clusters: a sidebar with the cluster count slider, three summary numbers and the list of groups, beside a map with each group's markers and walking route in its own color" src="docs/screenshots/desktop-light.png">
</picture>

I built this after moving to New York with a much longer list of places to
see than weekends to see them in. I wanted to answer one question: which of
these places should I visit on the same day?

## How it works

1. **Parse.** The API reads KML and KMZ exported from Google My Maps, or the
   GeoJSON that Google Takeout produces for saved places.
2. **Cluster.** I use agglomerative hierarchical clustering with centroid
   linkage. It starts with every place on its own and repeatedly merges the
   two closest clusters until one is left. The record of those merges answers
   "what are the best *k* groups?" for every *k* at once.
3. **Route.** For each cluster, I compute the shortest walk that visits every
   place once. It's exact (Held–Karp dynamic programming) up to 10 places, a
   nearest-neighbour + 2-opt heuristic up to 60, and skipped above that.
4. **Explore.** The browser receives the whole merge tree, so the slider can
   move between 1 and *n* clusters instantly, with no further requests. It
   starts at a suggested count: the fewest clusters where no day's walk is
   longer than 8 km (5 mi).

## Design decisions and trade-offs

- **Compute the hierarchy once, explore it for free.** Returning the full
  dendrogram costs a larger response, but it makes the slider instant and the
  UI much more exploratory than re-clustering per request. I cap uploads at
  500 places to keep the response and the O(n³) merge loop well under a
  second.
- **Hierarchical clustering over k-means.** k-means makes you choose *k* before
  you've seen any results, and random initialisation means the same file can
  cluster differently each time. Hierarchical clustering is deterministic and
  gives every *k* at once. The cost is worse asymptotic complexity, which
  doesn't matter at this scale.
- **Open paths, not round trips.** A day out starts at one place and ends at
  another, so I solve for the shortest Hamiltonian path rather than a tour.
  Distances are great-circle rather than along streets: good enough to rank
  what's near what, without needing a routing engine.
- **A suggestion you can reason about.** Rather than an "elbow" heuristic, the
  default cluster count is defined in terms the user cares about: the longest
  walk in any group. It assumes walking, so for a city you'd cross by train
  you'd drag the slider toward fewer, bigger clusters.
- **A stateless API.** There are no accounts, so the server clusters what it's
  sent and forgets it; uploads are kept in the visitor's browser. That means
  no database to run and nothing to clean up, at the cost of uploads not
  following you between devices.
- **No API keys.** The map uses MapLibre GL with OpenFreeMap tiles, which are
  free and have matching light and dark styles, so the map follows the theme.
- **Built for a public demo.** Uploads are treated as untrusted: XML DTDs are
  refused, KMZ files are unzipped with a hard size cap, and files are limited
  to 5 MB. Load is bounded per visitor (20 uploads a minute), across all
  visitors (two clusterings at a time, then a 503), and per container (CPU and
  memory caps), so a flood of uploads can't take down the other apps on the
  same server.
- **Color follows the cluster, not its rank.** When a cluster splits, the
  larger half keeps its color, so moving the slider one step recolors at most
  one group. Every group is also numbered on the map and in the list, so
  color is never the only cue.

## Screenshots

<table>
  <tr>
    <td width="68%"><img alt="New York at 14 clusters with group 1 focused: the map zoomed to lower Manhattan and the Brooklyn waterfront, showing the walking route through its twelve places" src="docs/screenshots/focus.png"></td>
    <td width="32%"><img alt="The app on a phone in the dark theme: the map above, the controls below" src="docs/screenshots/phone.png"></td>
  </tr>
  <tr>
    <td>Click a group to zoom to it. Its places are listed in the order to walk
    them.</td>
    <td>Phone layout, dark theme.</td>
  </tr>
</table>

## Try it with your own places

- **Google My Maps:** open a map, choose **⋮ → Export to KML/KMZ**, and upload
  the file.
- **Saved places:** at [takeout.google.com](https://takeout.google.com), export
  **Saved**, unzip it, and upload **Saved Places.json**.
- Any other KML, KMZ or GeoJSON file with points works too. Lines and shapes
  are skipped.

## Stack

| Layer | Choice |
| --- | --- |
| Backend | C# on .NET 10, ASP.NET Core minimal APIs |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query |
| Map | MapLibre GL JS on OpenFreeMap vector tiles |
| API docs | OpenAPI, with an interactive reference at `/api/docs` |
| Tests | xUnit (backend), Vitest (frontend) |
| Tooling | ESLint, Prettier, `dotnet format`, warnings as errors |
| CI | GitHub Actions |
| Hosting | Docker Compose behind Caddy on a small VM |

## Running it locally

Needs Docker.

```bash
docker compose up
```

Then open <http://localhost:3003>. The API is on <http://localhost:8003>, with
its reference at <http://localhost:8003/api/docs>.

To run every check CI runs (format, lint, types, tests and build):

```bash
scripts/setup.sh    # once: dependencies and the pre-commit hook
scripts/check.sh
```

If .NET isn't installed, `check.sh` runs the backend checks in Docker instead.

## Deployment

The production stack is two containers: the API, and nginx serving the built
frontend and proxying `/api` to it. `scripts/deploy.sh` provisions a fresh
Ubuntu server over SSH, builds and starts the stack, and puts Caddy in front
for HTTPS. It's idempotent and namespaces everything by app name, so this
demo shares a server with my other projects without interfering with them.

## Project layout

```
backend/src/Geoclustering.Clustering/   Clustering, routing and distances: pure code, no I/O
backend/src/Geoclustering.Api/          HTTP API, file parsing, and the sample datasets
backend/tests/Geoclustering.Tests/      Algorithm, parser and API tests
frontend/src/dendrogram.ts              Derives the clusters, stats and colors for any k
frontend/src/components/ClusterMap.tsx  The map, and the only code that talks to MapLibre
scripts/                                setup, check and deploy scripts
```

[AGENTS.md](./AGENTS.md) documents the codebase's conventions and the reasoning
behind them.

## What I'd add next

- **Street-network distances**, from a routing engine, for more realistic
  walks.
- **Transit-aware suggestions**, for cities where a day out isn't on foot.
- **Accounts**, if uploads ever need to follow someone between devices.

## Contact

Nicholas Morrow: [nickjmorrow.com](https://nickjmorrow.com) ·
[GitHub](https://github.com/nickjmorrow). MIT licensed; see [LICENSE](./LICENSE).
