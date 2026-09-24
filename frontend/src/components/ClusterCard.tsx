import type { Place } from 'src/api/clustering';
import type { ActiveCluster } from 'src/dendrogram';
import { formatDistance, plural, type Units } from 'src/format';
import type { Swatch } from 'src/palette';

interface Props {
  group: ActiveCluster;
  places: Place[];
  swatch: Swatch;
  units: Units;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * One group: its number and color (the same as its markers on the map), how
 * many places and how far the walk is, and the places in the order to walk
 * them. The header is the control — pressing it focuses the map on this group.
 */
export default function ClusterCard({ group, isSelected, onToggle, places, swatch, units }: Props) {
  const { cluster, number } = group;
  const walk = cluster.routeMeters === null ? null : formatDistance(cluster.routeMeters, units);

  return (
    <li
      className={[
        'overflow-hidden rounded-lg border-l-4 bg-surface-raised transition',
        isSelected ? 'ring-2 ring-accent' : '',
      ].join(' ')}
      style={{ borderLeftColor: swatch.fill }}
    >
      <button
        aria-pressed={isSelected}
        className={'flex w-full items-center gap-2 px-2.5 pt-2 pb-1 text-left'}
        onClick={onToggle}
        type={'button'}
      >
        <span
          aria-hidden={'true'}
          className={
            'grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums'
          }
          style={{ backgroundColor: swatch.fill, color: swatch.onFill }}
        >
          {number}
        </span>
        <span className={'min-w-0 flex-1 text-sm font-medium'}>
          <span className={'sr-only'}>Group {number}: </span>
          {plural(cluster.placeIds.length, 'place')}
          {walk !== null && <span className={'font-normal text-ink-muted'}> · {walk} walk</span>}
        </span>
        <span className={'text-xs text-ink-muted'}>{isSelected ? 'Show all' : 'Focus'}</span>
      </button>
      <ol className={'px-2.5 pb-2 pl-10 text-xs leading-5 text-ink-muted'}>
        {cluster.placeIds.map((id) => (
          <li className={'truncate'} key={id}>
            {places[id]?.name}
          </li>
        ))}
      </ol>
    </li>
  );
}
