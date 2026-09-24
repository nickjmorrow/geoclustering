/**
 * Which dataset is showing, and at how many clusters — the page's only state
 * worth putting in the URL, so a link to "Tokyo at 12 clusters" opens exactly
 * that. Uploads are deliberately not linkable: they live in this browser only,
 * and a link to one would open nothing anywhere else.
 */
export type Selection = { id: string; kind: 'sample' } | { id: string; kind: 'upload' };

export interface UrlState {
  sample: null | string;
  clusters: null | number;
}

export function readUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const clusters = Number(params.get('clusters') ?? '');
  return {
    clusters: Number.isSafeInteger(clusters) && clusters > 0 ? clusters : null,
    sample: params.get('sample'),
  };
}

export function writeUrlState(selection: null | Selection, clusters: null | number): string {
  if (selection?.kind !== 'sample') return '';
  const params = new URLSearchParams({ sample: selection.id });
  if (clusters !== null) params.set('clusters', String(clusters));
  return `?${params.toString()}`;
}

export function selectionKey(selection: Selection): string {
  return `${selection.kind}:${selection.id}`;
}
