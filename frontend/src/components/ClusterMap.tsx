import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type LngLatBoundsLike,
  Map as MapLibre,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import useShouldReduceMotion from 'src/hooks/useShouldReduceMotion';
import type { MapData } from 'src/mapData';

/**
 * Basemaps from OpenFreeMap: free, no API key, no account, and a light and a
 * dark style from the same data, so the map follows the theme.
 */
const STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

const NO_WEBGL =
  "The map couldn't start in this browser — it needs WebGL, which is turned off or unsupported here. Everything the map shows is in the list.";

const EMPTY: MapData = {
  places: { features: [], type: 'FeatureCollection' },
  routes: { features: [], type: 'FeatureCollection' },
};

interface Props {
  data: MapData | null;
  theme: 'dark' | 'light';
  /** What to fit the camera to. A new value moves the camera; the same one doesn't. */
  focus: LngLatBoundsLike | null;
  onSelectCluster: (clusterId: number) => void;
  /** Shown over the map while there is nothing to draw yet. */
  overlay: React.ReactNode;
}

/**
 * The map. MapLibre is imperative, so this is the one component that reaches
 * outside React: it creates the map once and then feeds it data, style and
 * camera changes from effects.
 *
 * What gets drawn — colors, numbers, dimming — is decided in `mapData.ts`;
 * this only paints it. The cluster list next to it carries the same
 * information as text, which is the accessible version of everything here.
 */
export default function ClusterMap({ data, focus, onSelectCluster, overlay, theme }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const styleTheme = useRef(theme);
  // Checked up front so the common failure renders its message on the first
  // pass instead of flashing an empty map.
  const [failure, setFailure] = useState<null | string>(() => (canUseWebGL() ? null : NO_WEBGL));
  const [tilesFailed, setTilesFailed] = useState(false);
  const shouldReduceMotion = useShouldReduceMotion();

  // Handlers the map calls long after the effect that registered them ran.
  // Effect Events always see the latest props without re-creating the map.
  const onStyleLoad = useEffectEvent((instance: MapLibre) => {
    addLayers(instance, theme);
    setData(instance, data ?? EMPTY);
  });
  const onPlaceClick = useEffectEvent((clusterId: number) => {
    onSelectCluster(clusterId);
  });

  // Create the map once. The initial style is whatever the theme is now;
  // the effect below swaps it when the theme changes.
  useEffect(() => {
    if (!container.current || failure !== null) return;
    // Bundled by Vite as a worker entry, so MapLibre loads it from this origin
    // rather than guessing a path relative to wherever its own chunk ended up.
    setWorkerUrl(workerUrl);
    let instance: MapLibre;
    try {
      instance = new MapLibre({
        attributionControl: { compact: true },
        center: [0, 20],
        container: container.current,
        style: STYLES[theme],
        zoom: 1,
      });
    } catch {
      // WebGL was reported available but the context still couldn't be made
      // (a blocklisted GPU, say). Rare, and only knowable by trying.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailure(NO_WEBGL);
      return;
    }
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.keyboard.enable();

    // Layers are part of the style, so a style swap removes them. Adding them
    // on every `style.load` covers the first load and every theme change.
    instance.on('style.load', () => {
      onStyleLoad(instance);
    });

    instance.on('error', (event) => {
      // A tile or a font failed. The markers still draw on a blank
      // background, so say so rather than failing the whole map.
      if ('sourceId' in event || 'tile' in event) setTilesFailed(true);
    });

    const hover = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    instance.on('mousemove', 'places', (event) => {
      const feature = event.features?.[0];
      if (feature?.geometry.type !== 'Point') return;
      instance.getCanvas().style.cursor = 'pointer';
      hover
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setText(String(feature.properties.name))
        .addTo(instance);
    });
    instance.on('mouseleave', 'places', () => {
      instance.getCanvas().style.cursor = '';
      hover.remove();
    });
    instance.on('click', 'places', (event) => {
      const clusterId = event.features?.[0]?.properties.clusterId as number | undefined;
      if (clusterId !== undefined) onPlaceClick(clusterId);
    });

    return () => {
      hover.remove();
      instance.remove();
      map.current = null;
    };
    // Created once, on purpose: theme and data have effects of their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The map was created with a style already; only a change needs a swap.
    if (styleTheme.current === theme) return;
    styleTheme.current = theme;
    map.current?.setStyle(STYLES[theme]);
  }, [theme]);

  useEffect(() => {
    // Not `isStyleLoaded()`: that is false whenever any tile is still loading,
    // which is most of the time during a camera move, and the update would be
    // dropped. If our sources exist, they take data; if they don't yet, the
    // `style.load` handler will set it when they do.
    const instance = map.current;
    if (instance?.getSource('places')) setData(instance, data ?? EMPTY);
  }, [data]);

  useEffect(() => {
    if (!focus) return;
    map.current?.fitBounds(focus, {
      duration: shouldReduceMotion ? 0 : 800,
      maxZoom: 15,
      padding: 48,
    });
  }, [focus, shouldReduceMotion]);

  if (failure !== null) {
    return (
      <div
        className={'grid h-full place-items-center bg-surface-raised p-6 text-center text-sm text-ink-muted'}
      >
        <p className={'max-w-sm'} role={'status'}>
          {failure}
        </p>
      </div>
    );
  }

  return (
    <div className={'relative h-full'}>
      <div
        aria-label={'Map of the clusters. The list beside it has the same information.'}
        className={'h-full'}
        ref={container}
        role={'region'}
      />
      {overlay !== null && (
        <div
          className={
            'absolute inset-0 grid place-items-center bg-surface/60 p-6 text-center backdrop-blur-[1px]'
          }
        >
          {overlay}
        </div>
      )}
      {tilesFailed && (
        <p
          className={
            'absolute bottom-8 left-2 rounded-md bg-surface-raised px-2 py-1 text-xs text-ink-muted shadow'
          }
          role={'status'}
        >
          Some map tiles didn&apos;t load. The places are still shown.
        </p>
      )}
    </div>
  );
}

function addLayers(map: MapLibre, theme: 'dark' | 'light') {
  if (map.getSource('routes')) return;
  map.addSource('routes', { data: EMPTY.routes, type: 'geojson' });
  map.addSource('places', { data: EMPTY.places, type: 'geojson' });
  // The numbers get a source of their own, holding the same features. A
  // source's tiles are built for all of its layers at once, so sharing one
  // would hold every marker back until the label font had downloaded.
  map.addSource('place-labels', { data: EMPTY.places, type: 'geojson' });

  const dimmed = (faint: number, full: number): ExpressionSpecification => [
    'case',
    ['get', 'dimmed'],
    faint,
    full,
  ];
  const loneCondition: ExpressionSpecification = ['==', ['get', 'label'], ''];

  map.addLayer({
    id: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-opacity': dimmed(0.12, 0.7),
      'line-width': 3,
    },
    source: 'routes',
    type: 'line',
  });
  map.addLayer({
    id: 'places',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': dimmed(0.2, 1),
      // Small at city scale, where a hundred full-size markers would be one
      // blob; full size, with room for the number, once zoomed in.
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        9,
        ['case', loneCondition, 2.5, 4],
        12.5,
        ['case', loneCondition, 5, 9],
      ],
      // A ring in the surface color keeps overlapping markers apart.
      'circle-stroke-color': theme === 'dark' ? '#1a1a19' : '#ffffff',
      'circle-stroke-opacity': dimmed(0.2, 1),
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 12.5, 2],
    },
    source: 'places',
    type: 'circle',
  });
  map.addLayer({
    id: 'place-labels',
    layout: {
      'text-allow-overlap': true,
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-ignore-placement': true,
      'text-size': 11,
    },
    paint: {
      'text-color': ['get', 'textColor'],
      // Numbers appear when the markers are big enough to hold them.
      'text-opacity': ['step', ['zoom'], 0, 12, dimmed(0.2, 1)],
    },
    source: 'place-labels',
    type: 'symbol',
  });
}

function setData(map: MapLibre, data: MapData) {
  // Resolves once the worker has indexed the data; nothing waits on that.
  void map.getSource<GeoJSONSource>('routes')?.setData(data.routes);
  void map.getSource<GeoJSONSource>('places')?.setData(data.places);
  void map.getSource<GeoJSONSource>('place-labels')?.setData(data.places);
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
