import { describe, expect, it } from 'vitest';
import { buildHierarchy, clustersAt } from 'src/dendrogram';
import { boundsOf, buildMapData } from 'src/mapData';
import { loneColor } from 'src/palette';
import { makeClustering } from 'src/testing';

const clustering = makeClustering(
  [
    [40, -74],
    [40.01, -74.01],
    [41, -73],
  ],
  [
    [0, 1],
    [3, 2],
  ],
);

describe('buildMapData', () => {
  const at = clustersAt(buildHierarchy(clustering), 2);

  it('numbers grouped places and leaves lone places unnumbered and gray', () => {
    const { places } = buildMapData(clustering.places, at, 'light', null);
    const byName = Object.fromEntries(places.features.map((f) => [f.properties.name, f.properties]));

    expect(byName['Place 0']?.label).toBe('1');
    expect(byName['Place 2']?.label).toBe('');
    expect(byName['Place 2']?.color).toBe(loneColor('light'));
  });

  it('draws lone places underneath the groups', () => {
    const { places } = buildMapData(clustering.places, at, 'light', null);

    expect(places.features[0]?.properties.label).toBe('');
  });

  it('dims everything but the focused cluster', () => {
    const { places, routes } = buildMapData(clustering.places, at, 'light', 3);

    expect(places.features.filter((f) => !f.properties.dimmed).map((f) => f.properties.name)).toEqual([
      'Place 0',
      'Place 1',
    ]);
    expect(routes.features.every((f) => !f.properties.dimmed)).toBe(true);
  });

  it('draws a route through each group in walking order, as [lng, lat]', () => {
    const { routes } = buildMapData(clustering.places, at, 'light', null);

    expect(routes.features[0]?.geometry.coordinates).toEqual([
      [-74, 40],
      [-74.01, 40.01],
    ]);
  });
});

describe('boundsOf', () => {
  it('is west-south, east-north', () => {
    expect(boundsOf(clustering.places)).toEqual([
      [-74.01, 40],
      [-73, 41],
    ]);
    expect(boundsOf([])).toBeNull();
  });
});
