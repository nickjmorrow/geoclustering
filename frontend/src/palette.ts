import { PALETTE_SIZE } from 'src/dendrogram';

export interface Swatch {
  /** The mark: circle fill, route line, list stripe. */
  fill: string;
  /** Text drawn on the fill — the cluster number inside its marker. */
  onFill: string;
}

/**
 * Eight categorical hues, in a fixed order that keeps neighbours
 * distinguishable under the common color-vision deficiencies. The dark column
 * is the same hues stepped for a dark surface, not a separate palette.
 *
 * Color is never the only cue: every group also carries its number, on the
 * map and in the list, which matters here more than on most charts because a
 * map can show more clusters than there are hues.
 */
const LIGHT: Swatch[] = [
  { fill: '#2a78d6', onFill: '#ffffff' },
  { fill: '#eb6834', onFill: '#0b0b0b' },
  { fill: '#1baf7a', onFill: '#0b0b0b' },
  { fill: '#eda100', onFill: '#0b0b0b' },
  { fill: '#e87ba4', onFill: '#0b0b0b' },
  { fill: '#008300', onFill: '#ffffff' },
  { fill: '#4a3aa7', onFill: '#ffffff' },
  { fill: '#e34948', onFill: '#0b0b0b' },
];

const DARK: Swatch[] = [
  { fill: '#3987e5', onFill: '#0b0b0b' },
  { fill: '#d95926', onFill: '#0b0b0b' },
  { fill: '#199e70', onFill: '#0b0b0b' },
  { fill: '#c98500', onFill: '#0b0b0b' },
  { fill: '#d55181', onFill: '#0b0b0b' },
  { fill: '#008300', onFill: '#ffffff' },
  { fill: '#9085e9', onFill: '#0b0b0b' },
  { fill: '#e66767', onFill: '#0b0b0b' },
];

/** Places on their own: present, but not competing with the groups. */
const LONE = { dark: '#898781', light: '#898781' };

export function swatch(slot: number, theme: 'dark' | 'light'): Swatch {
  const palette = theme === 'dark' ? DARK : LIGHT;
  return (
    palette[((slot % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE] ?? { fill: '#2a78d6', onFill: '#ffffff' }
  );
}

export function loneColor(theme: 'dark' | 'light'): string {
  return LONE[theme];
}
