import type { Level } from 'src/dendrogram';
import { formatDistance, type Units } from 'src/format';

interface Props {
  level: Level;
  groupCount: number;
  units: Units;
}

/**
 * Three numbers that say how good this cluster count is: how many days it
 * makes, how many places it leaves out of any group, and whether the hardest
 * day is still a walk.
 */
export default function LevelSummary({ groupCount, level, units }: Props) {
  const stats = [
    { label: 'Groups', value: String(groupCount) },
    { label: 'On their own', value: String(level.loneCount) },
    {
      label: 'Longest walk',
      value: level.longestWalkMeters === null ? 'Too far' : formatDistance(level.longestWalkMeters, units),
    },
  ];

  return (
    <dl className={'grid grid-cols-3 gap-2'}>
      {stats.map((stat) => (
        <div className={'rounded-lg bg-surface-raised px-2.5 py-2'} key={stat.label}>
          <dt className={'text-[11px] leading-4 text-ink-muted'}>{stat.label}</dt>
          <dd className={'text-base font-semibold tabular-nums'}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
