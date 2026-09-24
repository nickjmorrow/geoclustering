interface Props {
  className?: string;
}

/**
 * The shape of something that is on its way. Fades in after a short delay, so
 * a fast load shows nothing rather than flickering. Hidden from assistive tech:
 * whatever is loading announces itself with a `role="status"` of its own.
 */
export default function Skeleton({ className = '' }: Props) {
  return <div aria-hidden={'true'} className={`animate-appear rounded-md bg-ink/[0.07] ${className}`} />;
}
