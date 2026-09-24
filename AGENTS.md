# AGENTS.md

How this codebase is put together, and why. Written for whoever changes it
next, human or not. The README says what the app is; this says what to keep
true while changing it.

## Layout

```
backend/
  Geoclustering.slnx
  Directory.Build.props         nullable, warnings-as-errors, analyzers: one place
  global.json                   the SDK version CI and the Dockerfile agree on
  src/Geoclustering.Clustering/ the algorithm
  src/Geoclustering.Api/        HTTP, file formats, samples
  tests/Geoclustering.Tests/
frontend/
  src/api/                      the HTTP boundary and the wire types
  src/components/               one component per file
  src/hooks/
  src/*.ts                      the logic, as pure modules with tests beside them
scripts/                        setup.sh, check.sh, deploy.sh
```

## The two rules holding it up

1. **`Geoclustering.Clustering` is pure.** Places in, a dendrogram out. It
   references nothing from ASP.NET and does no I/O, which is why every
   property of the algorithm can be tested directly and fast. File formats,
   limits that are about HTTP, and anything that talks to the outside belong
   in `Geoclustering.Api`.
2. **The server computes; the browser derives.** Anything that needs the
   whole tree or real distances (merging, routes, spreads) is done once on
   the server. Anything that is a *view* of the tree at one level (which
   clusters exist, their numbers and colors, the summary numbers, the
   suggested count) is derived in `frontend/src/dendrogram.ts`, so the slider
   never makes a request.

## The dendrogram is the contract

`POST /api/clusterings` and `GET /api/samples/{id}` return the same shape
(`ClusteringResponse` in `Contracts.cs`, `Clustering` in
`frontend/src/api/clustering.ts`):

- `places`: id = index in the file.
- `clusters`: ids `0..n-1` are the single places; `n..2n-2` are merges, in
  merge order. Each has its members (in walking order when it has a route),
  center, mean distance to center, and route length (or null).
- `merges`: `{a, b, into, distanceMeters}`. **Applying the first `n - k`
  merges gives the `k`-cluster answer.** That one sentence is the whole
  protocol; `activeIds` in `dendrogram.ts` is its implementation.

The field order of the TypeScript interfaces mirrors the C# records, so the
two can be read side by side. Change them together.

Limits that shape the contract, all constants beside the code they govern:
`HierarchicalClusterer.MaxPlaces` (500), `RoutePlanner.MaxExactPlaces` (10),
`RoutePlanner.MaxRoutePlaces` (60), the 5 MB upload cap in `Program.cs` (and
`MAX_UPLOAD_BYTES` in `uploads.ts`, which checks it before sending), and
`DAY_WALK_METERS` in `dendrogram.ts`.

## Backend

- **Minimal APIs in `Program.cs`**, which is also the only place that reads
  configuration (`LOG_FORMAT`, `UPLOADS_PER_MINUTE`). Everything else is a
  constant next to the code it governs.
- **Errors are problem details with a sentence in `detail`**, written for the
  person who uploaded the file ("This file has 812 places; the limit is 500.
  Split it into smaller maps…"). The frontend shows `detail` verbatim, so
  never put a stack trace or an exception message from a library there.
  `PlaceFileException` is the type for "the file is the problem".
- **Uploaded files are hostile.** DTDs prohibited and no XML resolver; KMZ
  entries copied with a hard cap rather than trusting the declared size; the
  form is read explicitly so a malformed body is a 400, not a 500. Keep the
  tests in `PlaceFileReaderTests` that pin each of these.
- **Deterministic output.** Ties in the merge loop go to the lowest index, and
  nothing is random. The same file must always produce the same clusters,
  colors and routes; tests rely on it and so do shared links.
- **Logging** uses `[LoggerMessage]` source generation (the analyzers insist).
- Warnings are errors, `AnalysisLevel` is `latest-recommended`, and
  `dotnet format --verify-no-changes` runs in CI. Tests may use
  `Underscored_sentence_names`; `.editorconfig` allows it there only.

## Frontend

- **Absolute imports only** (`src/api/client`), enforced by ESLint.
- **One component per file**, default export, named like the file. A helper a
  second file needs goes in a `.ts` module.
- **Logic lives in `.ts` modules with tests beside them**: `dendrogram.ts`,
  `mapData.ts`, `format.ts`, `uploads.ts`, `selection.ts`. Components arrange;
  they don't compute. Vitest runs in Node with no DOM, on purpose: if a test
  seems to need one, the logic probably belongs in a module.
- **Server state is TanStack Query**; there is no other store. Samples never
  go stale (they change with a deploy). Uploads are a mutation whose result
  goes to localStorage via `useUploads`, which reports when storage refused
  to keep something rather than losing it silently.
- **Every async surface has three states** (loading, failed with a way out,
  and done), and a failure says what happened in a sentence, not a status
  code. `errorMessage` in `api/client.ts` is where that sentence comes from.
- **Place names are text.** They come from uploaded files; never render them
  as HTML (`react/no-danger` is on).
- **The URL holds the sample and cluster count**, so links are shareable.
  Uploads never go in the URL: they would open nothing anywhere else.

### The map

`ClusterMap.tsx` is the only component that touches MapLibre. It creates the
map once and feeds it data, style and camera changes from effects; handlers
the map calls later are `useEffectEvent`s so they see current props. What gets
drawn is decided in `mapData.ts` and tested there.

Things that look simplifiable and aren't:

- Layers are re-added on every `style.load`, because switching the theme swaps
  the style, and a style swap deletes custom layers.
- Data updates check for the source, not `isStyleLoaded()`, which is false
  whenever any tile is loading, i.e. during every camera move.
- The number labels have their own GeoJSON source. A source's tiles are built
  for all its layers at once, so sharing one makes every marker wait for the
  label font to download.
- The worker URL is set explicitly from a Vite `?worker&url` import.

### Color

Eight categorical hues in a fixed, color-vision-checked order (`palette.ts`),
stepped separately for light and dark. **Color follows the cluster, never its
rank**: `assignColorSlots` walks the tree from the root, and when a cluster
splits the larger half keeps its color. Places on their own are neutral gray.
Because a map can show more groups than there are hues, every group also
carries its number on the map and in the list, so color is never the only
cue.

### Accessibility

The cluster list is the text version of the map; anything the map shows must
be in the list too. Controls are native elements (`input type=range`, buttons
with `aria-pressed`) rather than ARIA re-implementations. The cluster count is
announced through a polite live region, the camera jumps instead of flying
under `prefers-reduced-motion`, and the theme follows the OS until someone
chooses.

## Checks

`scripts/check.sh` is the one definition of "passing", run by hand, by the
pre-commit hook (`--fast`, touched halves only) and by CI:

| Half | Steps |
| --- | --- |
| backend | `dotnet format --verify-no-changes`, `dotnet build` (warnings are errors), `dotnet test` |
| frontend | `eslint`, `prettier --check`, `tsc`, `vitest`, `vite build` |

Without a .NET SDK on the machine, the backend steps run in the SDK's Docker
image.

## Deploying

`scripts/deploy.sh user@host [domain]` is idempotent and shares a server with
other projects deployed the same way: everything it creates (directory,
Compose project, local port, Caddy site file) is named after the app. The
production nginx proxies `/api`, including `/api/docs`, which gets a looser CSP
of its own because the Scalar reference loads from a CDN. The app's own CSP
allows exactly one outside origin, `tiles.openfreemap.org`.

## What is deliberately missing

| Missing | Add it when |
| --- | --- |
| Accounts and server-side saving | Someone needs their uploads on a second device. The seam is `useUploads`; it would become a query and a mutation against a new endpoint. |
| Street-network walking distances | The straight-line suggestion starts giving visibly wrong days. Swap the distance matrix in `RoutePlanner.Plan`; nothing else needs to know. |
| More than 500 places | Someone has that many. Past it, the O(n³) merge loop and the response size both need rethinking (nearest-neighbour chains; sending merges only and deriving members in the browser). |
| A database | Never, for what this does today. |
