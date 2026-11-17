import { useCallback, useLayoutEffect, useRef } from 'react';
import { courbeToken, dureeToken, useMouvement } from './useMouvement';

/**
 * FLIP des seules lignes rendues (D-16). `cles` : ordre courant des clés ; `enregistrer(cle)` renvoie la
 * ref à poser sur la ligne (la même fonction à chaque rendu, pour ne pas détacher/rattacher les lignes).
 * Au changement d’ordre, chaque ligne glisse de son ancienne à sa nouvelle place.
 * Les positions sont mesurées dans la page (pas dans la fenêtre) : un défilement entre deux rendus ne doit jamais
 * être pris pour un déplacement de lignes. Seul un vrai changement d’ordre déclenche une mesure.
 * Mouvement coupé : réordonnancement instantané.
 */
export function useFlip(cles: readonly string[]): (cle: string) => (el: HTMLElement | null) => void {
  const mouvement = useMouvement();
  const elements = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());
  const rappels = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const ordre = cles.join('\u0000');

  const enregistrer = useCallback((cle: string) => {
    let rappel = rappels.current.get(cle);
    if (!rappel) {
      rappel = (el: HTMLElement | null) => {
        if (el) elements.current.set(cle, el);
        else elements.current.delete(cle);
      };
      rappels.current.set(cle, rappel);
    }
    return rappel;
  }, []);

  useLayoutEffect(() => {
    const avant = positions.current;
    const decalage = window.scrollY;
    const apres = new Map<string, number>();
    for (const [cle, el] of elements.current) apres.set(cle, el.getBoundingClientRect().top + decalage);
    if (mouvement && avant.size > 0) {
      const duree = dureeToken('--d-move');
      const courbe = courbeToken('--ease-spring');
      if (duree === null || courbe === null) {
        positions.current = apres;
        return;
      }
      for (const [cle, el] of elements.current) {
        const ancien = avant.get(cle);
        const nouveau = apres.get(cle);
        if (ancien === undefined || nouveau === undefined || ancien === nouveau) continue;
        if (typeof el.animate !== 'function') continue;
        el.animate(
          [{ transform: `translateY(${ancien - nouveau}px)`, filter: 'blur(1.2px)' }, { transform: 'none', filter: 'none' }],
          { duration: duree, easing: courbe },
        );
      }
    }
    positions.current = apres;
  }, [ordre, mouvement]);

  return enregistrer;
}
