import { useCallback, useState } from 'react';
import type { Clustering } from 'src/api/clustering';
import { newUploadId, readUploads, type Upload, writeUploads } from 'src/uploads';

/**
 * The files this browser has uploaded, newest first, kept in localStorage.
 *
 * `notice` is set when storage refused to keep everything — full, or blocked
 * outright — so the page can say an upload will not survive a reload rather
 * than letting it vanish without a word.
 */
export default function useUploads() {
  const [uploads, setUploads] = useState<Upload[]>(() => readUploads(localStorageOrNull()));
  const [notice, setNotice] = useState<null | string>(null);

  const persist = useCallback((next: Upload[]) => {
    const storage = localStorageOrNull();
    const kept = writeUploads(storage, next);
    setNotice(
      kept.length < next.length
        ? kept.length === 0
          ? "This browser isn't letting the page save uploads, so they'll be gone when you leave."
          : 'Browser storage is full, so older uploads were dropped to make room.'
        : null,
    );
    // Keep the full list for this visit either way; storage only decides what
    // comes back next time.
    setUploads(next);
  }, []);

  const add = useCallback(
    (clustering: Clustering): Upload => {
      const upload = {
        clustering,
        id: newUploadId(),
        savedAt: new Date().toISOString(),
      };
      persist([upload, ...uploads]);
      return upload;
    },
    [persist, uploads],
  );

  const remove = useCallback(
    (id: string) => {
      persist(uploads.filter((upload) => upload.id !== id));
    },
    [persist, uploads],
  );

  return { add, notice, remove, uploads };
}

/** localStorage, or a stand-in that stores nothing when the browser blocks it. */
function localStorageOrNull(): Storage {
  try {
    return window.localStorage;
  } catch {
    return {
      clear: () => {
        // Nothing is ever stored.
      },
      getItem: () => null,
      key: () => null,
      length: 0,
      removeItem: () => {
        // Nothing is ever stored.
      },
      setItem: () => {
        throw new Error('storage unavailable');
      },
    };
  }
}
