import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defence: a render that throws anywhere shows a sentence and
 * a reload button instead of a blank page. A class because `componentDidCatch`
 * still has no hook equivalent.
 */
export default class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  state: State = { error: null };

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className={'flex h-full flex-col items-center justify-center gap-3 p-8 text-center'}
        role={'alert'}
      >
        <p className={'text-sm font-medium'}>Something broke.</p>
        <p className={'max-w-md text-xs text-ink-muted'}>{this.state.error.message}</p>
        <button
          className={'rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:opacity-90'}
          onClick={() => {
            window.location.reload();
          }}
          type={'button'}
        >
          Reload
        </button>
      </div>
    );
  }
}
