import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Réglage « Animations » (clé `affichage`). T-304 fournira la valeur réelle via `useAffichage` en
 * montant `ContexteAffichage.Provider` ; sans fournisseur, les animations sont autorisées.
 */
export const ContexteAffichage = createContext<{ animations: boolean }>({ animations: true });

const REQUETE = '(prefers-reduced-motion: reduce)';

function abonner(rappel: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const liste = window.matchMedia(REQUETE);
  liste.addEventListener('change', rappel);
  return () => liste.removeEventListener('change', rappel);
}

const reduit = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REQUETE).matches;

/** `true` = animations autorisées ; `false` si le système demande moins de mouvement ou si le réglage est coupé. */
export function useMouvement(): boolean {
  const { animations } = useContext(ContexteAffichage);
  const systemeReduit = useSyncExternalStore(abonner, reduit, () => false);
  return animations && !systemeReduit;
}

/** Lit une durée (token `--d-*`) en millisecondes ; repli si le token est illisible. */
export function dureeToken(nom: string, repli: number): number {
  if (typeof document === 'undefined') return repli;
  const brut = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  const m = /^([\d.]+)(ms|s)$/.exec(brut);
  if (!m?.[1]) return repli;
  return m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1]);
}
