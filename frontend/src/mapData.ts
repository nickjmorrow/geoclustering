import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Place } from 'src/api/clustering';
import type { ClustersAt } from 'src/dendrogram';
import { loneColor, swatch } from 'src/palette';

/**
 * The map's data, as GeoJSON the map styles by property. Kept out of the map
 * component so what is drawn — which color, which number, what is dimmed — is
 * a function that can be tested without a WebGL context.
 */

export interface PlaceProperties {
  name: string;
  /** The active cluster this place belongs to. */
  clusterId: number;
  color: string;
  textColor: string;
  /** The group's number, or '' for a place on its own. */
  label: string;
  /** Drawn faintly because another cluster is selected. */
  dimmed: boolean;
}

export interface RouteProperties {
  clusterId: number;
  color: string;
  dimmed: boolean;
}

type PointFeature = Feature<Point, PlaceProperties>;
type LineFeature = Feature<LineString, RouteProperties>;

export interface MapData {
  places: FeatureCollection<Point, PlaceProperties>;
  routes: FeatureCollection<LineString, RouteProperties>;
}

export function buildMapData(
  places: Place[],
  at: ClustersAt,
  theme: 'dark' | 'light',
  selectedId: null | number,
): MapData {
  const isDimmed = (clusterId: number) => selectedId !== null && selectedId !== clusterId;
  const point = (placeId: number, properties: PlaceProperties): PointFeature[] => {
    const place = places[placeId];
    if (!place) return [];
    return [
      {
        geometry: { coordinates: [place.lng, place.lat], type: 'Point' },
        properties: { ...properties, name: place.name },
        type: 'Feature',
      },
    ];
  };

  const groupPoints = at.groups.flatMap(({ cluster, colorSlot, number }) => {
    const { fill, onFill } = swatch(colorSlot, theme);
    return cluster.placeIds.flatMap((placeId) =>
      point(placeId, {
        clusterId: cluster.id,
        color: fill,
        dimmed: isDimmed(cluster.id),
        label: String(number),
        name: '',
        textColor: onFill,
      }),
    );
  });

  const lonePoints = at.lone.flatMap((cluster) =>
    cluster.placeIds.flatMap((placeId) =>
      point(placeId, {
        clusterId: cluster.id,
        color: loneColor(theme),
        dimmed: isDimmed(cluster.id),
        label: '',
        name: '',
        textColor: loneColor(theme),
      }),
    ),
  );

  const routes: LineFeature[] = at.groups
    .filter(({ cluster }) => cluster.routeMeters !== null)
    .map(({ cluster, colorSlot }) => ({
      geometry: {
        coordinates: cluster.placeIds
          .map((id) => places[id])
          .filter((place) => place !== undefined)
          .map((place) => [place.lng, place.lat]),
        type: 'LineString',
      },
      properties: {
        clusterId: cluster.id,
        color: swatch(colorSlot, theme).fill,
        dimmed: isDimmed(cluster.id),
      },
      type: 'Feature',
    }));

  return {
    // Lone places first, so the groups draw on top of them.
    places: {
      features: [...lonePoints, ...groupPoints],
      type: 'FeatureCollection',
    },
    routes: { features: routes, type: 'FeatureCollection' },
  };
}

/** [[west, south], [east, north]] around the given places. */
export function boundsOf(points: Pick<Place, 'lat' | 'lng'>[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const { lat, lng } of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
