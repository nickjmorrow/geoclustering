import ThemeToggle from 'src/components/ThemeToggle';

const LINK = 'rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-raised hover:text-ink';

/** The app's name, where the code lives, and the theme. On every screen size. */
export default function Header() {
  return (
    <header className={'flex h-12 shrink-0 items-center gap-3 border-b border-ink/10 px-4'}>
      <a className={'flex items-center gap-2'} href={'/'}>
        <img alt={''} className={'h-5 w-5'} height={20} src={'/favicon.svg'} width={20} />
        <span className={'text-sm font-semibold tracking-tight'}>Geoclustering</span>
      </a>
      <span className={'hidden text-xs text-ink-muted md:inline'}>
        Group the places you want to visit into days out
      </span>
      <nav aria-label={'Project links'} className={'ml-auto flex items-center gap-1'}>
        <a
          className={LINK}
          href={'https://github.com/nickjmorrow/geoclustering'}
          rel={'noreferrer'}
          target={'_blank'}
        >
          Source
        </a>
        <a
          className={`${LINK} hidden sm:inline`}
          href={'https://nickjmorrow.com'}
          rel={'noreferrer'}
          target={'_blank'}
        >
          Portfolio
        </a>
      </nav>
      <ThemeToggle />
    </header>
  );
}
