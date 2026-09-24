import { useId, useRef, useState } from 'react';
import InlineError from 'src/components/InlineError';
import { ACCEPTED_EXTENSIONS } from 'src/uploads';

interface Props {
  onFile: (file: File) => void;
  /** The file being clustered right now, if any. */
  pendingName: null | string;
  error: null | string;
  onDismissError: () => void;
}

/**
 * Upload a file by choosing it or dropping it here.
 *
 * The visible control is a real button that opens the file picker, so it is
 * reachable and operable from the keyboard; dropping is the shortcut, not the
 * only way. While a file is clustering the button says which one, so a slow
 * upload never looks like a click that did nothing.
 */
export default function UploadDropzone({ error, onDismissError, onFile, pendingName }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const isPending = pendingName !== null;

  return (
    <div className={'flex flex-col gap-2'}>
      {/* A drop target is a pointer affordance by nature; the button inside is
          the keyboard path to the same thing. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={[
          'flex flex-col items-center gap-2 rounded-xl border border-dashed px-3 py-4 text-center transition',
          isDragging ? 'border-accent bg-accent/10' : 'border-ink/20',
        ].join(' ')}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !isPending) onFile(file);
        }}
      >
        <button
          aria-busy={isPending}
          aria-describedby={helpId}
          className={
            'inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent transition hover:opacity-90 disabled:opacity-60'
          }
          disabled={isPending}
          onClick={() => input.current?.click()}
          type={'button'}
        >
          {isPending && (
            <span
              aria-hidden={'true'}
              className={'h-3 w-3 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent'}
            />
          )}
          {isPending ? `Clustering ${pendingName}…` : 'Upload your places'}
        </button>
        <p className={'text-xs text-ink-muted'} id={helpId}>
          KML or KMZ from Google My Maps, or GeoJSON from Google Takeout. Up to 500 places, 5 MB.
          <span className={'hidden md:inline'}> Or drop a file here.</span>
        </p>
        <input
          accept={ACCEPTED_EXTENSIONS.join(',')}
          aria-hidden={'true'}
          className={'sr-only'}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            // Cleared so choosing the same file again (after fixing it) fires again.
            event.target.value = '';
          }}
          ref={input}
          tabIndex={-1}
          type={'file'}
        />
      </div>
      {error !== null && <InlineError message={error} onDismiss={onDismissError} />}
      <details className={'text-xs text-ink-muted'}>
        <summary className={'cursor-pointer select-none hover:text-ink'}>Where do I get a file?</summary>
        <ul className={'mt-2 flex list-disc flex-col gap-1.5 pl-4'}>
          <li>
            <strong className={'font-medium text-ink'}>Google My Maps:</strong> open your map, choose ⋮ →
            Export to KML/KMZ, and upload the file it downloads.
          </li>
          <li>
            <strong className={'font-medium text-ink'}>Saved places:</strong> at takeout.google.com, export
            “Saved”, unzip it, and upload <em>Saved Places.json</em>.
          </li>
          <li>Anything else that writes KML or GeoJSON points works too; lines and shapes are skipped.</li>
        </ul>
      </details>
    </div>
  );
}
