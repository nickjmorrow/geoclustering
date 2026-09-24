import type { Clustering } from 'src/api/clustering';

/**
 * Uploaded files live in this browser, not on the server. The API is
 * stateless on purpose — there are no accounts, so there is nobody to save a
 * file *for* — and the browser is the one place that knows whose file it is.
 */
export interface Upload {
  id: string;
  savedAt: string;
  clustering: Clustering;
}

const STORAGE_KEY = 'geoclustering.uploads';

/** Enough to come back to, few enough to stay well inside localStorage's ~5 MB. */
export const MAX_UPLOADS = 5;

export function readUploads(storage: Pick<Storage, 'getItem'>): Upload[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isUpload) : [];
  } catch {
    // Blocked storage throws on access; corrupt JSON throws on parse. Either
    // way this visit starts with no uploads rather than not starting.
    return [];
  }
}

/**
 * Save the list, dropping the oldest uploads until it fits. Returns what was
 * actually kept, which is shorter than what was asked for when storage is
 * full — the caller says so rather than pretending the upload was saved.
 */
export function writeUploads(storage: Pick<Storage, 'removeItem' | 'setItem'>, uploads: Upload[]): Upload[] {
  let kept = uploads.slice(0, MAX_UPLOADS);
  while (kept.length > 0) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(kept));
      return kept;
    } catch {
      kept = kept.slice(0, -1);
    }
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing more to do: this browser won't store anything.
  }
  return [];
}

export function newUploadId(): string {
  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isUpload(value: unknown): value is Upload {
  const upload = value as Partial<Upload> | null;
  return (
    typeof upload?.id === 'string' &&
    typeof upload.savedAt === 'string' &&
    Array.isArray(upload.clustering?.places) &&
    Array.isArray(upload.clustering.clusters) &&
    Array.isArray(upload.clustering.merges)
  );
}

/** Accepted before upload, so an obviously wrong file fails instantly and locally. */
export const ACCEPTED_EXTENSIONS = ['.kml', '.kmz', '.geojson', '.json'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function checkFile(file: Pick<File, 'name' | 'size'>): null | string {
  const name = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.every((extension) => !name.endsWith(extension))) {
    return `“${file.name}” isn't a KML, KMZ or GeoJSON file.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return `“${file.name}” is larger than the 5 MB limit.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}
