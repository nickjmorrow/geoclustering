import { describe, expect, it } from 'vitest';
import { readUrlState, writeUrlState } from 'src/selection';

describe('URL state', () => {
  it('round-trips a sample and its cluster count', () => {
    const search = writeUrlState({ id: 'tokyo', kind: 'sample' }, 12);

    expect(search).toBe('?sample=tokyo&clusters=12');
    expect(readUrlState(search)).toEqual({ clusters: 12, sample: 'tokyo' });
  });

  it('never puts an upload in the URL: it would open nothing anywhere else', () => {
    expect(writeUrlState({ id: 'upload-1', kind: 'upload' }, 4)).toBe('');
  });

  it('ignores a cluster count that is not a positive number', () => {
    expect(readUrlState('?sample=x&clusters=-3').clusters).toBeNull();
    expect(readUrlState('?clusters=abc').clusters).toBeNull();
  });
});
