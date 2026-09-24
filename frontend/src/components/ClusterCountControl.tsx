import { useId } from 'react';
import { DAY_WALK_METERS } from 'src/dendrogram';
import { formatDistance, plural, type Units } from 'src/format';

interface Props {
  value: number;
  max: number;
  suggested: number;
  units: Units;
  onChange: (value: number) => void;
}

const STEP =
  'grid h-7 w-7 place-items-center rounded-md border border-ink/10 text-sm text-ink transition hover:border-ink/25 disabled:opacity-30';

/**
 * How many clusters. A native range input, so keyboard, touch and screen
 * readers all work without any code here — plus − and + for exact steps,
 * which a slider across 50 values makes fiddly on a phone.
 *
 * Every position is already computed, so moving it is instant: nothing is
 * sent to the server.
 */
export default function ClusterCountControl({ max, onChange, suggested, units, value }: Props) {
  const id = useId();
  const hintId = useId();
  const set = (next: number) => {
    onChange(Math.min(Math.max(next, 1), max));
  };

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'flex items-baseline justify-between gap-2'}>
        <label className={'text-sm font-medium'} htmlFor={id}>
          Clusters
        </label>
        <output className={'text-sm tabular-nums'} htmlFor={id}>
          {value} <span className={'text-ink-muted'}>of {max}</span>
        </output>
      </div>
      <div className={'flex items-center gap-2'}>
        <button
          aria-label={'Fewer clusters'}
          className={STEP}
          disabled={value <= 1}
          onClick={() => {
            set(value - 1);
          }}
          type={'button'}
        >
          −
        </button>
        <input
          aria-describedby={hintId}
          aria-valuetext={plural(value, 'cluster')}
          className={'min-w-0 flex-1'}
          id={id}
          max={max}
          min={1}
          onChange={(event) => {
            set(Number(event.target.value));
          }}
          step={1}
          type={'range'}
          value={value}
        />
        <button
          aria-label={'More clusters'}
          className={STEP}
          disabled={value >= max}
          onClick={() => {
            set(value + 1);
          }}
          type={'button'}
        >
          +
        </button>
      </div>
      <p className={'text-xs text-ink-muted'} id={hintId}>
        {value === suggested ? (
          <>This is the suggested count: </>
        ) : (
          <>
            <button
              className={'font-medium text-accent underline underline-offset-2'}
              onClick={() => {
                set(suggested);
              }}
              type={'button'}
            >
              Use suggested ({suggested})
            </button>{' '}
            —{' '}
          </>
        )}
        the fewest clusters where no group&apos;s walk is longer than {formatDistance(DAY_WALK_METERS, units)}
        .
      </p>
    </div>
  );
}
