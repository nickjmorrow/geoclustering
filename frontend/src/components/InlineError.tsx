interface Props {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

/**
 * A failure inside one part of the page. It says what went wrong and offers
 * the way out, because "Could not load" with no retry leaves reloading the
 * whole page as the only option.
 */
export default function InlineError({ message, onDismiss, onRetry }: Props) {
  return (
    <div
      className={
        'flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg bg-danger/10 px-2.5 py-2 text-xs text-danger'
      }
      role={'alert'}
    >
      <span className={'min-w-0 flex-1'}>{message}</span>
      {onRetry && (
        <button className={'font-medium underline underline-offset-2'} onClick={onRetry} type={'button'}>
          Try again
        </button>
      )}
      {onDismiss && (
        <button
          aria-label={'Dismiss'}
          className={'font-medium opacity-70 hover:opacity-100'}
          onClick={onDismiss}
          type={'button'}
        >
          ✕
        </button>
      )}
    </div>
  );
}
