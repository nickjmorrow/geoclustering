import { describe, expect, it } from 'vitest';
import { makeClustering } from 'src/testing';
import { checkFile, MAX_UPLOADS, readUploads, type Upload, writeUploads } from 'src/uploads';

function memoryStorage(quota = Infinity) {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    items,
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      if (value.length > quota) throw new DOMException('full', 'QuotaExceededError');
      items.set(key, value);
    },
  };
}

const upload = (id: string): Upload => ({
  clustering: makeClustering([[0, 0]], []),
  id,
  savedAt: '2026-01-01T00:00:00Z',
});

describe('uploads in storage', () => {
  it('round-trips', () => {
    const storage = memoryStorage();
    writeUploads(storage, [upload('a'), upload('b')]);

    expect(readUploads(storage).map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('keeps at most the newest few', () => {
    const storage = memoryStorage();
    const kept = writeUploads(
      storage,
      Array.from({ length: MAX_UPLOADS + 2 }, (_, i) => upload(String(i))),
    );

    expect(kept).toHaveLength(MAX_UPLOADS);
    expect(kept[0]?.id).toBe('0');
  });

  it('drops the oldest until the list fits, and says what it kept', () => {
    const one = JSON.stringify([upload('a')]).length;
    const kept = writeUploads(memoryStorage(one + 10), [upload('a'), upload('b'), upload('c')]);

    expect(kept.map((u) => u.id)).toEqual(['a']);
  });

  it('reads nothing, rather than throwing, from corrupt or foreign data', () => {
    const storage = memoryStorage();
    storage.items.set('geoclustering.uploads', '{not json');
    expect(readUploads(storage)).toEqual([]);

    storage.items.set('geoclustering.uploads', JSON.stringify([{ id: 1 }, upload('ok')]));
    expect(readUploads(storage).map((u) => u.id)).toEqual(['ok']);
  });
});

describe('checkFile', () => {
  it('accepts the three formats, case-insensitively', () => {
    expect(checkFile({ name: 'map.KMZ', size: 10 })).toBeNull();
    expect(checkFile({ name: 'Saved Places.json', size: 10 })).toBeNull();
  });

  it('refuses the wrong type, an empty file and an oversized one before uploading', () => {
    expect(checkFile({ name: 'photo.jpg', size: 10 })).toMatch(/isn't a KML/);
    expect(checkFile({ name: 'map.kml', size: 0 })).toMatch(/empty/);
    expect(checkFile({ name: 'map.kml', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
