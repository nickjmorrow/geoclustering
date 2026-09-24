import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ['data-theme'],
    attributes: true,
  });
  return () => {
    observer.disconnect();
  };
}

function read(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * The theme actually on the page, for code that has to paint with it — the
 * map, whose basemap and marker colors are chosen in JavaScript rather than
 * by CSS.
 *
 * Read from `<html data-theme>`, which `useTheme` writes, rather than by
 * calling `useTheme` a second time: that hook holds the preference as state
 * and two copies would diverge on a click. The attribute is the one place the
 * answer is written down.
 */
export default function useResolvedTheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribe, read);
}
