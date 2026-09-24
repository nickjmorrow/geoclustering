import { describe, expect, it } from 'vitest';
import { formatDistance, plural, preferredUnits } from 'src/format';

describe('formatDistance', () => {
  it.each([
    [5, 'metric', '10 m'],
    [847, 'metric', '850 m'],
    [2349, 'metric', '2.3 km'],
    [12_600, 'metric', '13 km'],
    [60, 'imperial', '200 ft'],
    [2349, 'imperial', '1.5 mi'],
    [40_000, 'imperial', '25 mi'],
  ] as const)('%d m in %s is %s', (meters, units, expected) => {
    expect(formatDistance(meters, units)).toBe(expected);
  });
});

describe('preferredUnits', () => {
  it('is miles for the US and kilometers elsewhere', () => {
    expect(preferredUnits('en-US')).toBe('imperial');
    expect(preferredUnits('en-GB')).toBe('metric');
    expect(preferredUnits('ja')).toBe('metric');
  });
});

describe('plural', () => {
  it('counts', () => {
    expect(plural(1, 'place')).toBe('1 place');
    expect(plural(2, 'place')).toBe('2 places');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
  });
});
