import { useCallback, useLayoutEffect, useRef } from 'react';
import { dureeToken, useMouvement } from './useMouvement';

/**
 * FLIP des seules lignes rendues (D-16). `cles` : ordre courant des clés ; `enregistrer(cle)` renvoie la
 * ref à poser sur la ligne. Au changement d’ordre, chaque ligne glisse de son ancienne à sa nouvelle place.
 * Mouvement coupé : réordonnancement instantané.
 */
export function useFlip(cles: readonly string[]): (cle: string) => (el: HTMLElement | null) => void {
  const mouvement = useMouvement();
  const elements = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());

  const enregistrer = useCallback(
    (cle: string) => (el: HTMLElement | null) => {
      if (el) elements.current.set(cle, el);
      else elements.current.delete(cle);
    },
    [],
  );

  useLayoutEffect(() => {
    const avant = positions.current;
    const apres = new Map<string, number>();
    for (const [cle, el] of elements.current) apres.set(cle, el.getBoundingClientRect().top);
    if (mouvement && avant.size > 0) {
      const duree = dureeToken('--d-move', 650);
      for (const [cle, el] of elements.current) {
        const ancien = avant.get(cle);
        const nouveau = apres.get(cle);
        if (ancien === undefined || nouveau === undefined || ancien === nouveau) continue;
        if (typeof el.animate !== 'function') continue;
        el.animate(
          [{ transform: `translateY(${ancien - nouveau}px)`, filter: 'blur(1.2px)' }, { transform: 'none', filter: 'none' }],
          { duration: duree, easing: 'var(--ease-spring)' },
        );
      }
    }
    positions.current = apres;
  }, [cles, mouvement]);

  return enregistrer;
}
