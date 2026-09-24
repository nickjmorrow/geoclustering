import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from 'src/api/client';
import { sampleFileUrl, sampleQuery, samplesQuery, uploadPlaces } from 'src/api/clustering';
import AuthorCredit from 'src/components/AuthorCredit';
import ClusterCountControl from 'src/components/ClusterCountControl';
import ClusterList from 'src/components/ClusterList';
import ClusterMap from 'src/components/ClusterMap';
import DatasetPicker from 'src/components/DatasetPicker';
import Header from 'src/components/Header';
import InlineError from 'src/components/InlineError';
import LevelSummary from 'src/components/LevelSummary';
import Skeleton from 'src/components/Skeleton';
import UploadDropzone from 'src/components/UploadDropzone';
import { buildHierarchy, clampCount, clustersAt } from 'src/dendrogram';
import { plural, preferredUnits } from 'src/format';
import useResolvedTheme from 'src/hooks/useResolvedTheme';
import useUploads from 'src/hooks/useUploads';
import { boundsOf, buildMapData } from 'src/mapData';
import { readUrlState, type Selection, selectionKey, writeUrlState } from 'src/selection';
import { checkFile } from 'src/uploads';

const SECTION_HEADING = 'text-xs font-semibold tracking-wide text-ink-muted uppercase';

export default function App() {
  const theme = useResolvedTheme();
  const units = useMemo(() => preferredUnits(navigator.language), []);
  const [initialUrl] = useState(() => readUrlState(window.location.search));

  const samples = useQuery(samplesQuery);
  const { add, notice, remove, uploads } = useUploads();

  // Null until someone picks, and then the first sample is the default — so
  // an unknown `?sample=` in a shared link still lands somewhere sensible.
  const [picked, setPicked] = useState<null | Selection>(() =>
    initialUrl.sample === null ? null : { id: initialUrl.sample, kind: 'sample' },
  );
  const firstSample = samples.data?.[0];
  const pickedUpload = picked?.kind === 'upload' ? uploads.find((u) => u.id === picked.id) : undefined;
  const selection = useMemo<null | Selection>(() => {
    if (picked?.kind === 'sample' || pickedUpload) return picked;
    return firstSample ? { id: firstSample.id, kind: 'sample' } : null;
  }, [picked, pickedUpload, firstSample]);
  const key = selection ? selectionKey(selection) : '';

  const sample = useQuery({
    ...sampleQuery(selection?.kind === 'sample' ? selection.id : ''),
    enabled: selection?.kind === 'sample',
  });
  const clustering = selection?.kind === 'sample' ? sample.data : pickedUpload?.clustering;
  const hierarchy = useMemo(() => (clustering ? buildHierarchy(clustering) : null), [clustering]);

  // The count chosen for each dataset, so switching away and back keeps it.
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    initialUrl.sample !== null && initialUrl.clusters !== null
      ? { [`sample:${initialUrl.sample}`]: initialUrl.clusters }
      : {},
  );
  const placeCount = clustering?.places.length ?? 1;
  const count = hierarchy ? clampCount(counts[key] ?? hierarchy.suggested, placeCount) : 1;
  const at = useMemo(() => (hierarchy ? clustersAt(hierarchy, count) : null), [hierarchy, count]);
  const level = hierarchy?.levels[count - 1];

  // A focused cluster stays focused while it still exists at the new count,
  // and quietly lets go when the slider merges or splits it away.
  const [focused, setFocused] = useState<null | {
    clusterId: number;
    key: string;
  }>(null);
  const focusedId =
    focused?.key === key && at?.groups.some((g) => g.cluster.id === focused.clusterId)
      ? focused.clusterId
      : null;

  const mapData = useMemo(
    () => (clustering && at ? buildMapData(clustering.places, at, theme, focusedId) : null),
    [clustering, at, theme, focusedId],
  );
  const cameraTarget = useMemo(() => {
    if (!clustering) return null;
    const cluster = focusedId === null ? null : clustering.clusters[focusedId];
    const places = cluster
      ? cluster.placeIds.map((id) => clustering.places[id]).filter((p) => p !== undefined)
      : clustering.places;
    return boundsOf(places);
  }, [clustering, focusedId]);

  useEffect(() => {
    const search = writeUrlState(selection, counts[key] ?? null);
    window.history.replaceState(null, '', search === '' ? window.location.pathname : search);
  }, [selection, counts, key]);

  const [fileProblem, setFileProblem] = useState<null | string>(null);
  const upload = useMutation({
    mutationFn: uploadPlaces,
    onSuccess: (result) => {
      const saved = add(result);
      setPicked({ id: saved.id, kind: 'upload' });
    },
  });
  const uploadError = fileProblem ?? (upload.error ? errorMessage(upload.error) : null);

  const select = (next: Selection) => {
    setPicked(next);
    setFocused(null);
  };

  const mapOverlay =
    selection?.kind === 'sample' && sample.isPending ? (
      <p className={'animate-appear text-sm text-ink-muted'} role={'status'}>
        Loading places…
      </p>
    ) : sample.isError && selection?.kind === 'sample' ? (
      <p className={'text-sm text-ink-muted'}>The places couldn&apos;t be loaded.</p>
    ) : null;

  return (
    <div className={'flex h-full flex-col overflow-hidden'}>
      <a
        className={
          'sr-only z-10 rounded-md bg-accent px-3 py-1.5 text-sm text-on-accent focus:not-sr-only focus:absolute focus:top-2 focus:left-2'
        }
        href={'#clusters'}
      >
        Skip to the clusters
      </a>
      <Header />
      <main
        className={'relative flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden'}
      >
        <div
          className={
            'relative order-last flex w-full shrink-0 flex-col gap-6 border-ink/10 p-4 md:order-first md:w-[380px] md:overflow-y-auto md:border-r'
          }
        >
          <p className={'text-sm leading-6 text-ink-muted'}>
            Too many places to see and not enough days? Group them into clusters you can visit together, each
            with the shortest walk through it. Try a sample, or upload your own saved places.
          </p>

          <section aria-labelledby={'places-heading'} className={'flex flex-col gap-3'}>
            <h2 className={SECTION_HEADING} id={'places-heading'}>
              Places
            </h2>
            <DatasetPicker
              onRemoveUpload={(id) => {
                remove(id);
                if (picked?.kind === 'upload' && picked.id === id) setPicked(null);
              }}
              onRetrySamples={() => void samples.refetch()}
              onSelect={select}
              samples={samples.data}
              samplesError={samples.isError ? errorMessage(samples.error) : null}
              selection={selection}
              uploads={uploads}
            />
            <UploadDropzone
              error={uploadError}
              onDismissError={() => {
                setFileProblem(null);
                upload.reset();
              }}
              onFile={(file) => {
                const problem = checkFile(file);
                setFileProblem(problem);
                upload.reset();
                if (problem === null) upload.mutate(file);
              }}
              pendingName={upload.isPending ? upload.variables.name : null}
            />
            {notice !== null && <p className={'text-xs text-ink-muted'}>{notice}</p>}
          </section>

          <section
            aria-labelledby={'clusters-heading'}
            className={'flex flex-col gap-4'}
            id={'clusters'}
            tabIndex={-1}
          >
            {clustering && hierarchy && at && level ? (
              <>
                <div>
                  <h2 className={'text-base font-semibold'} id={'clusters-heading'}>
                    {clustering.name}
                  </h2>
                  <p className={'text-xs text-ink-muted'}>
                    {plural(clustering.places.length, 'place')}
                    {selection?.kind === 'sample' && (
                      <>
                        {' · '}
                        <a
                          className={'underline decoration-ink/20 underline-offset-2 hover:text-ink'}
                          download
                          href={sampleFileUrl(selection.id)}
                        >
                          download the KML
                        </a>
                      </>
                    )}
                  </p>
                  {clustering.skipped > 0 && (
                    <p className={'mt-1 text-xs text-ink-muted'}>
                      {plural(clustering.skipped, 'entry', 'entries')} in this file{' '}
                      {clustering.skipped === 1 ? "wasn't a" : "weren't"} single{' '}
                      {clustering.skipped === 1 ? 'point' : 'points'} (lines or shapes), so{' '}
                      {clustering.skipped === 1 ? 'it was' : 'they were'} left out.
                    </p>
                  )}
                </div>
                <ClusterCountControl
                  max={clustering.places.length}
                  onChange={(next) => {
                    setCounts((current) => ({ ...current, [key]: next }));
                  }}
                  suggested={hierarchy.suggested}
                  units={units}
                  value={count}
                />
                <LevelSummary groupCount={at.groups.length} level={level} units={units} />
                <p aria-live={'polite'} className={'sr-only'}>
                  {plural(count, 'cluster')}: {plural(at.groups.length, 'group')} and {at.lone.length} on
                  their own.
                </p>
                <ClusterList
                  at={at}
                  onSelect={(clusterId) => {
                    setFocused(clusterId === null ? null : { clusterId, key });
                  }}
                  places={clustering.places}
                  selectedId={focusedId}
                  theme={theme}
                  units={units}
                />
              </>
            ) : selection?.kind === 'sample' && sample.isError ? (
              <>
                <h2 className={'sr-only'} id={'clusters-heading'}>
                  Clusters
                </h2>
                <InlineError message={errorMessage(sample.error)} onRetry={() => void sample.refetch()} />
              </>
            ) : (
              <div className={'flex flex-col gap-3'} role={'status'}>
                <h2 className={'sr-only'} id={'clusters-heading'}>
                  Loading clusters…
                </h2>
                <Skeleton className={'h-6 w-40'} />
                <Skeleton className={'h-10'} />
                <Skeleton className={'h-16'} />
                <Skeleton className={'h-24'} />
                <Skeleton className={'h-24'} />
              </div>
            )}
          </section>

          <footer className={'mt-auto border-t border-ink/10 pt-3'}>
            <AuthorCredit />
            <p className={'mt-1 text-[11px] text-ink-muted'}>
              Uploads are clustered on the server and kept only in this browser.
            </p>
          </footer>
        </div>

        <div className={'order-first h-[45vh] shrink-0 md:order-last md:h-auto md:min-w-0 md:flex-1'}>
          <ClusterMap
            data={mapData}
            focus={cameraTarget}
            onSelectCluster={(clusterId) => {
              if (at?.groups.some((g) => g.cluster.id === clusterId)) setFocused({ clusterId, key });
            }}
            overlay={mapOverlay}
            theme={theme}
          />
        </div>
      </main>
    </div>
  );
}
