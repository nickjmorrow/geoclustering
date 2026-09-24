export type Units = 'imperial' | 'metric';

/**
 * Miles for the few places that walk in miles, kilometers everywhere else.
 * Read from the browser's language, e.g. `en-US`, because that is the best
 * signal a page without accounts has.
 */
export function preferredUnits(locale: string): Units {
  const region = locale.split('-', 2)[1]?.toUpperCase() ?? '';
  return ['LR', 'MM', 'US'].includes(region) ? 'imperial' : 'metric';
}

const FEET_PER_METER = 3.28084;
const METERS_PER_MILE = 1609.344;

/** A distance at the precision a walk is planned at: "850 m", "2.3 km", "0.4 mi". */
export function formatDistance(meters: number, units: Units): string {
  if (units === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    if (miles < 0.1) return `${String(roundTo(meters * FEET_PER_METER, 50))} ft`;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${String(Math.round(miles))} mi`;
  }
  if (meters < 1000) return `${String(roundTo(meters, 10))} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${String(Math.round(km))} km`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}
