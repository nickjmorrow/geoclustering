import type { Cluster, Clustering, Merge, Place } from 'src/api/clustering';

/**
 * A clustering built the way the server builds one, from a list of places and
 * the merges between them — so tests can describe a tree in a line and let
 * this fill in members, centers and spreads.
 */
export function makeClustering(
  points: [number, number][],
  merges: [number, number][],
  spreads: Record<number, number> = {},
): Clustering {
  const places: Place[] = points.map(([lat, lng], id) => ({
    id,
    lat,
    lng,
    name: `Place ${String(id)}`,
  }));
  const members: number[][] = places.map((p) => [p.id]);
  const merged: Merge[] = merges.map(([a, b], i) => {
    const into = places.length + i;
    members[into] = [...(members[a] ?? []), ...(members[b] ?? [])];
    return { a, b, distanceMeters: (i + 1) * 100, into };
  });
  const clusters: Cluster[] = members.map((placeIds, id) => ({
    center: { lat: 0, lng: 0 },
    id,
    placeIds,
    routeMeters: placeIds.length > 1 ? 1000 : 0,
    spreadMeters: spreads[id] ?? 0,
  }));
  return { clusters, merges: merged, name: 'Test', places, skipped: 0 };
}
