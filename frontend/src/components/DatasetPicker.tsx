import type { SampleSummary } from 'src/api/clustering';
import InlineError from 'src/components/InlineError';
import Skeleton from 'src/components/Skeleton';
import { plural } from 'src/format';
import type { Selection } from 'src/selection';
import type { Upload } from 'src/uploads';

interface Props {
  samples: SampleSummary[] | undefined;
  samplesError: null | string;
  onRetrySamples: () => void;
  uploads: Upload[];
  selection: null | Selection;
  onSelect: (selection: Selection) => void;
  onRemoveUpload: (id: string) => void;
}

function rowTone(isRowSelected: boolean): string {
  return isRowSelected ? 'bg-accent/10 text-ink ring-1 ring-accent/40' : 'text-ink hover:bg-surface-raised';
}

const ROW = 'flex w-full items-center gap-2 rounded-lg text-left transition';
const ROW_PADDING = 'px-2.5 py-2';

/**
 * The datasets to choose between: the samples, then this browser's uploads.
 *
 * Toggle buttons with `aria-pressed` rather than a radio group, for the same
 * reason as the theme toggle: a radio group brings arrow-key roving focus with
 * it, and a half-implemented one is worse than none. The upload rows also carry
 * a remove button, which a radio could not contain.
 */
export default function DatasetPicker({
  onRemoveUpload,
  onRetrySamples,
  onSelect,
  samples,
  samplesError,
  selection,
  uploads,
}: Props) {
  const isSelected = (kind: Selection['kind'], id: string) => selection?.kind === kind && selection.id === id;

  return (
    <div className={'flex flex-col gap-1'}>
      {samplesError !== null && <InlineError message={samplesError} onRetry={onRetrySamples} />}
      {samples === undefined && samplesError === null && (
        <div className={'flex flex-col gap-1'} role={'status'}>
          <span className={'sr-only'}>Loading samples…</span>
          <Skeleton className={'h-12'} />
          <Skeleton className={'h-12'} />
        </div>
      )}
      {samples?.map((sample) => {
        const isRowSelected = isSelected('sample', sample.id);
        return (
          <button
            aria-pressed={isRowSelected}
            className={`${ROW} ${ROW_PADDING} ${rowTone(isRowSelected)}`}
            key={sample.id}
            onClick={() => {
              onSelect({ id: sample.id, kind: 'sample' });
            }}
            title={sample.description}
            type={'button'}
          >
            <span className={'min-w-0 flex-1'}>
              <span className={'block truncate text-sm font-medium'}>{sample.name}</span>
              <span className={'block text-xs text-ink-muted'}>
                {plural(sample.placeCount, 'place')} · sample
              </span>
            </span>
          </button>
        );
      })}
      {uploads.map((upload) => {
        const isRowSelected = isSelected('upload', upload.id);
        return (
          <div className={`${ROW} pr-1 ${rowTone(isRowSelected)}`} key={upload.id}>
            <button
              aria-pressed={isRowSelected}
              className={'min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left'}
              onClick={() => {
                onSelect({ id: upload.id, kind: 'upload' });
              }}
              type={'button'}
            >
              <span className={'block truncate text-sm font-medium'}>{upload.clustering.name}</span>
              <span className={'block text-xs text-ink-muted'}>
                {plural(upload.clustering.places.length, 'place')} · your upload
              </span>
            </button>
            <button
              aria-label={`Remove ${upload.clustering.name}`}
              className={'rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-ink/10 hover:text-ink'}
              onClick={() => {
                onRemoveUpload(upload.id);
              }}
              title={'Remove from this browser'}
              type={'button'}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
