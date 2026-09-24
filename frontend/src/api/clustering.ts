import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from 'src/api/client';

/**
 * Wire shapes, field for field with `backend/src/Geoclustering.Api/Contracts.cs`
 * and `backend/src/Geoclustering.Clustering/Models.cs`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

/**
 * A node in the dendrogram. Ids `0..n-1` are the single places; `n..2n-2` are
 * merges. `placeIds` is in walking order whenever `routeMeters` is set.
 */
export interface Cluster {
  id: number;
  placeIds: number[];
  center: LatLng;
  spreadMeters: number;
  routeMeters: null | number;
}

export interface Merge {
  a: number;
  b: number;
  into: number;
  distanceMeters: number;
}

export interface Clustering {
  name: string;
  places: Place[];
  clusters: Cluster[];
  merges: Merge[];
  skipped: number;
}

export interface SampleSummary {
  id: string;
  name: string;
  description: string;
  placeCount: number;
}

export const samplesQuery = queryOptions({
  queryFn: ({ signal }) => apiFetch<SampleSummary[]>('/api/samples', { signal }),
  queryKey: ['samples'],
  // The samples are baked into the API image; they change with a deploy.
  staleTime: Infinity,
});

export const sampleQuery = (id: string) =>
  queryOptions({
    queryFn: ({ signal }) =>
      apiFetch<Clustering>(`/api/samples/${encodeURIComponent(id)}`, {
        signal,
      }),
    queryKey: ['samples', id],
    staleTime: Infinity,
  });

export function sampleFileUrl(id: string): string {
  return `/api/samples/${encodeURIComponent(id)}/file`;
}

export function uploadPlaces(file: File): Promise<Clustering> {
  const body = new FormData();
  body.append('file', file);
  return apiFetch<Clustering>('/api/clusterings', { body, method: 'POST' });
}
