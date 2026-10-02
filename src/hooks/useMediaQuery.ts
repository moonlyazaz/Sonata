import { useEffect, useState } from 'react';

/** Observa uma media query do CSS. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Breakpoints do layout. */
export const BREAKPOINTS = {
  /** tablet: sidebar encolhida (só ícones) */
  tablet: '(max-width: 1024px)',
  /** mobile: sidebar vira drawer */
  mobile: '(max-width: 768px)',
} as const;
