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

/** Lit une durée (token `--d-*`) en millisecondes ; `null` si le token est illisible (pas d'animation). */
export function dureeToken(nom: string): number | null {
  if (typeof document === 'undefined') return null;
  const brut = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  const r = /^([\d.]+)(ms|s)$/.exec(brut);
  if (!r?.[1]) return null;
  return r[2] === 's' ? Number(r[1]) * 1000 : Number(r[1]);
}

/** Lit une courbe (token `--ease-*`) ; `null` si absente. */
export function courbeToken(nom: string): string | null {
  if (typeof document === 'undefined') return null;
  const brut = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return brut === '' ? null : brut;
}
