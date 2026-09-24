import type { Place } from 'src/api/clustering';
import ClusterCard from 'src/components/ClusterCard';
import type { ClustersAt } from 'src/dendrogram';
import type { Units } from 'src/format';
import { loneColor, swatch } from 'src/palette';

interface Props {
  at: ClustersAt;
  places: Place[];
  theme: 'dark' | 'light';
  units: Units;
  selectedId: null | number;
  onSelect: (clusterId: null | number) => void;
}

/**
 * Every group, largest first, then the places left on their own. This is the
 * text version of the map — everything the map shows is here too, which is
 * what makes the page usable without seeing it.
 */
export default function ClusterList({ at, onSelect, places, selectedId, theme, units }: Props) {
  return (
    <div className={'flex flex-col gap-3'}>
      {at.groups.length > 0 && (
        <ol aria-label={'Groups'} className={'flex flex-col gap-2'}>
          {at.groups.map((group) => (
            <ClusterCard
              group={group}
              isSelected={selectedId === group.cluster.id}
              key={group.cluster.id}
              onToggle={() => {
                onSelect(selectedId === group.cluster.id ? null : group.cluster.id);
              }}
              places={places}
              swatch={swatch(group.colorSlot, theme)}
              units={units}
            />
          ))}
        </ol>
      )}
      {at.lone.length > 0 && (
        <section aria-labelledby={'lone-heading'}>
          <h3 className={'mb-1 text-xs font-medium text-ink-muted'} id={'lone-heading'}>
            On their own ({at.lone.length})
          </h3>
          <ul className={'flex flex-col text-xs leading-5'}>
            {at.lone.map((cluster) => (
              <li className={'flex items-center gap-2 truncate'} key={cluster.id}>
                <span
                  aria-hidden={'true'}
                  className={'h-2 w-2 shrink-0 rounded-full'}
                  style={{ backgroundColor: loneColor(theme) }}
                />
                {places[cluster.placeIds[0] ?? -1]?.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
