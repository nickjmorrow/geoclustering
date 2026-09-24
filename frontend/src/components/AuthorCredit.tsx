const LINKS = [
  { href: 'https://nickjmorrow.com', label: 'Portfolio' },
  { href: 'https://github.com/nickjmorrow', label: 'GitHub' },
  { href: 'https://github.com/nickjmorrow/geoclustering', label: 'Source' },
];

/**
 * Who built this, and where the code is. At the foot of the sidebar, which is
 * on screen at every size. Links open a new tab so the demo is still there
 * when you come back to it.
 */
export default function AuthorCredit() {
  return (
    <p className={'text-xs leading-5 text-ink-muted'}>
      Built by Nicholas Morrow
      {LINKS.map((link) => (
        <span key={link.href}>
          <span aria-hidden={'true'}> · </span>
          <a
            className={'underline decoration-ink/20 underline-offset-2 transition hover:text-ink'}
            href={link.href}
            rel={'noreferrer'}
            target={'_blank'}
          >
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}
