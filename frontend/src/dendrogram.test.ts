import { describe, expect, it } from 'vitest';
import { activeIds, buildHierarchy, clampCount, clustersAt, suggestClusterCount } from 'src/dendrogram';
import { makeClustering } from 'src/testing';

// Five places: 0+1 → 5, 2+3 → 6, 5+6 → 7, 7+4 → 8.
const tree = () =>
  makeClustering(
    [
      [0, 0],
      [0, 0],
      [1, 1],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 1],
      [2, 3],
      [5, 6],
      [7, 4],
    ],
    { 5: 100, 6: 300, 7: 2000, 8: 5000 },
  );

describe('activeIds', () => {
  it('is every place when k is the number of places, and the root at 1', () => {
    expect([...activeIds(tree(), 5)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    expect([...activeIds(tree(), 1)]).toEqual([8]);
  });

  it('applies the first n - k merges', () => {
    expect([...activeIds(tree(), 3)].sort((a, b) => a - b)).toEqual([4, 5, 6]);
  });
});

describe('clustersAt', () => {
  it('lists groups largest first, numbered from 1, and lone places separately', () => {
    const at = clustersAt(buildHierarchy(tree()), 2);

    expect(at.groups.map((g) => [g.cluster.id, g.number])).toEqual([[7, 1]]);
    expect(at.lone.map((c) => c.id)).toEqual([4]);
  });
});

describe('levels', () => {
  it('weights the distance to center by how many places each cluster holds', () => {
    const { levels } = buildHierarchy(tree());

    // k = 3: clusters 5 (2 places, 100 m) and 6 (2 places, 300 m), 4 alone.
    expect(levels[2]?.meanDistanceToCenterMeters).toBeCloseTo((2 * 100 + 2 * 300) / 5);
    expect(levels[2]?.loneCount).toBe(1);
    expect(levels[4]?.meanDistanceToCenterMeters).toBe(0);
    expect(levels[4]?.loneCount).toBe(5);
  });

  it('reports the gap to the next merge, and none at one cluster', () => {
    const { levels } = buildHierarchy(tree());

    expect(levels[4]?.closestClustersMeters).toBe(100);
    expect(levels[0]?.closestClustersMeters).toBeNull();
  });
});

const level = (clusterCount: number, longestWalkMeters: null | number) => ({
  closestClustersMeters: null,
  clusterCount,
  loneCount: 0,
  longestWalkMeters,
  meanDistanceToCenterMeters: 0,
});

describe('suggestClusterCount', () => {
  it('is the fewest clusters where every walk is a day out', () => {
    expect(suggestClusterCount([level(1, null), level(2, 20_000), level(3, 7000), level(4, 3000)])).toBe(3);
  });

  it('falls back to every place on its own when no grouping is walkable', () => {
    expect(suggestClusterCount([level(1, null), level(2, 50_000)])).toBe(2);
  });
});

describe('longest walk', () => {
  it('is the longest route among the groups at each level, and unknown once a group has none', () => {
    const clustering = tree();
    const root = clustering.clusters[8];
    if (root) root.routeMeters = null;
    const { levels } = buildHierarchy(clustering);

    expect(levels[4]?.longestWalkMeters).toBe(0);
    expect(levels[3]?.longestWalkMeters).toBe(1000);
    expect(levels[0]?.longestWalkMeters).toBeNull();
  });
});

describe('color slots', () => {
  it('keeps a cluster’s color as the slider moves', () => {
    const hierarchy = buildHierarchy(tree());
    const colorOf = (k: number, id: number) =>
      clustersAt(hierarchy, k).groups.find((g) => g.cluster.id === id)?.colorSlot;

    // Cluster 5 exists from k = 4 down to k = 3; its color doesn't change.
    expect(colorOf(4, 5)).toBe(colorOf(3, 5));
  });

  it('gives the two halves of a split different colors', () => {
    const at = clustersAt(buildHierarchy(tree()), 3);

    expect(at.groups[0]?.colorSlot).not.toBe(at.groups[1]?.colorSlot);
  });

  it('gives places on their own no color', () => {
    expect(buildHierarchy(tree()).colorSlots.slice(0, 5)).toEqual([null, null, null, null, null]);
  });
});

describe('clampCount', () => {
  it('keeps k between 1 and the number of places', () => {
    expect(clampCount(0, 5)).toBe(1);
    expect(clampCount(9, 5)).toBe(5);
    expect(clampCount(2.6, 5)).toBe(3);
    expect(clampCount(NaN, 5)).toBe(1);
  });
});
