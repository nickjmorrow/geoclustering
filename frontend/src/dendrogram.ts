import type { Cluster, Clustering } from 'src/api/clustering';

/**
 * Everything the UI derives from a clustering, computed once per dataset.
 *
 * The server sends the whole merge history; this turns it into "the clusters
 * at k" for any k without asking again, which is what lets the slider move
 * freely. It is also where each cluster gets its color, because that needs
 * the whole tree rather than one level of it.
 */
export interface Hierarchy {
  clustering: Clustering;
  /** Per cluster id: how many places it holds. */
  sizes: number[];
  /** Per cluster id: its palette slot, or null for a place on its own. */
  colorSlots: (null | number)[];
  /** Per k (index k - 1): summary numbers for that level. */
  levels: Level[];
  /** A good starting k — see `suggestClusterCount`. */
  suggested: number;
}

export interface Level {
  clusterCount: number;
  /** Mean distance from each place to the center of its cluster. */
  meanDistanceToCenterMeters: number;
  /** Clusters of exactly one place. */
  loneCount: number;
  /** How far apart the two closest clusters are; null when there is only one. */
  closestClustersMeters: null | number;
  /**
   * The longest walk through any one group. Null when a group is too large for
   * the server to have planned a route through it — longer than any day out.
   */
  longestWalkMeters: null | number;
}

export interface ActiveCluster {
  cluster: Cluster;
  /** 1-based, by size, largest first — the number shown on the map and list. */
  number: number;
  colorSlot: number;
}

export interface ClustersAt {
  /** Clusters of two or more places, largest first. */
  groups: ActiveCluster[];
  /** Places that are a cluster by themselves, in input order. */
  lone: Cluster[];
}

/** How many palette slots there are. Matches `PALETTE` in `palette.ts`. */
export const PALETTE_SIZE = 8;

/**
 * A day out on foot: about five miles of walking between places, which leaves
 * time to see them. The suggested cluster count is the fewest that keep every
 * group's walk within this.
 */
export const DAY_WALK_METERS = 8000;

export function buildHierarchy(clustering: Clustering): Hierarchy {
  const sizes = clustering.clusters.map((c) => c.placeIds.length);
  const levels = computeLevels(clustering, sizes);
  return {
    clustering,
    colorSlots: assignColorSlots(clustering, sizes),
    levels,
    sizes,
    suggested: suggestClusterCount(levels),
  };
}

/** Ids of the clusters that exist at `k`: the first `n - k` merges applied. */
export function activeIds(clustering: Clustering, k: number): Set<number> {
  const n = clustering.places.length;
  const active = new Set(clustering.places.map((p) => p.id));
  const applied = clustering.merges.slice(0, n - clampCount(k, n));
  for (const merge of applied) {
    active.delete(merge.a);
    active.delete(merge.b);
    active.add(merge.into);
  }
  return active;
}

export function clustersAt(hierarchy: Hierarchy, k: number): ClustersAt {
  const { clustering, colorSlots, sizes } = hierarchy;
  const all = [...activeIds(clustering, k)].map((id) => clustering.clusters[id]).filter(isDefined);

  const groups = all
    .filter((c) => (sizes[c.id] ?? 0) > 1)
    .sort((a, b) => (sizes[b.id] ?? 0) - (sizes[a.id] ?? 0) || a.id - b.id)
    .map((cluster, index) => ({
      cluster,
      colorSlot: colorSlots[cluster.id] ?? 0,
      number: index + 1,
    }));
  const lone = all.filter((c) => sizes[c.id] === 1).sort((a, b) => a.id - b.id);

  return { groups, lone };
}

export function clampCount(k: number, placeCount: number): number {
  if (!Number.isFinite(k)) return Math.min(placeCount, 1);
  return Math.min(Math.max(Math.round(k), 1), placeCount);
}

/**
 * The summary numbers for every k, in one pass from k = n down to 1. Each
 * merge changes the totals by exactly the two clusters it removes and the one
 * it adds, so no level needs its clusters listed to be summarised.
 */
function computeLevels(clustering: Clustering, sizes: number[]): Level[] {
  const n = clustering.places.length;
  const spreadTotal = (id: number) => (clustering.clusters[id]?.spreadMeters ?? 0) * (sizes[id] ?? 0);

  const levels: Level[] = [];
  let distanceSum = 0;
  let loneCount = n;
  // A running maximum is enough: a merged group's shortest walk is at least as
  // long as either half's, since it visits every place they do. And once some
  // group is too big for a route, every coarser level has one too.
  let longestWalk: null | number = 0;
  for (let k = n; k >= 1; k--) {
    const next = clustering.merges[n - k];
    levels.push({
      closestClustersMeters: next?.distanceMeters ?? null,
      clusterCount: k,
      loneCount,
      longestWalkMeters: longestWalk,
      meanDistanceToCenterMeters: distanceSum / n,
    });
    if (!next) break;
    distanceSum += spreadTotal(next.into) - spreadTotal(next.a) - spreadTotal(next.b);
    loneCount -= (sizes[next.a] === 1 ? 1 : 0) + (sizes[next.b] === 1 ? 1 : 0);
    const walk = clustering.clusters[next.into]?.routeMeters ?? null;
    longestWalk = longestWalk === null || walk === null ? null : Math.max(longestWalk, walk);
  }
  return levels.toReversed();
}

/**
 * The fewest clusters in which every group is still a day out: no walk longer
 * than `DAY_WALK_METERS`. Fewer clusters means more places per day, which is
 * the point; this is where that stops being walkable.
 */
export function suggestClusterCount(levels: Level[]): number {
  return (
    levels.find((level) => level.longestWalkMeters !== null && level.longestWalkMeters <= DAY_WALK_METERS)
      ?.clusterCount ?? levels.length
  );
}

/**
 * A palette slot for every cluster, fixed for the life of the dataset, so a
 * cluster keeps its color as the slider moves: color follows the cluster,
 * never its rank.
 *
 * Walks the tree from the root down, undoing merges in reverse. When a cluster
 * splits, the larger half keeps its color and the smaller takes the least-used
 * slot among the clusters that exist at that moment — so moving the slider one
 * step recolors at most one cluster. Places on their own get no slot; they are
 * drawn in a neutral gray, which keeps the palette for groups.
 */
function assignColorSlots(clustering: Clustering, sizes: number[]): (null | number)[] {
  const slots: (null | number)[] = clustering.clusters.map(() => null);
  const usage: number[] = Array.from({ length: PALETTE_SIZE }, () => 0);
  const root = clustering.clusters.length - 1;
  if ((sizes[root] ?? 0) > 1) {
    slots[root] = 0;
    usage[0] = 1;
  }

  const leastUsed = () => usage.indexOf(Math.min(...usage));

  for (let i = clustering.merges.length - 1; i >= 0; i--) {
    const merge = clustering.merges[i];
    if (!merge) continue;
    const parentSlot = slots[merge.into] ?? null;
    if (parentSlot !== null) usage[parentSlot] = (usage[parentSlot] ?? 1) - 1;

    const [larger, smaller] =
      (sizes[merge.b] ?? 0) > (sizes[merge.a] ?? 0) ? [merge.b, merge.a] : [merge.a, merge.b];
    const children = [
      [larger, parentSlot],
      [smaller, null],
    ] as const;
    for (const [child, inherited] of children) {
      if ((sizes[child] ?? 0) < 2) continue;
      const slot = inherited ?? leastUsed();
      slots[child] = slot;
      usage[slot] = (usage[slot] ?? 0) + 1;
    }
  }
  return slots;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
