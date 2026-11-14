import { useCallback, useSyncExternalStore } from 'react';
import { ongletDepuisHash, type IdOnglet } from './definitionOnglets';

function abonner(rappel: () => void): () => void {
  window.addEventListener('hashchange', rappel);
  return () => window.removeEventListener('hashchange', rappel);
}

const lireHash = (): string => window.location.hash;

/**
 * Onglet actif, porté uniquement par `location.hash` (rien en stockage, D-12). Précédent et Suivant du
 * navigateur déclenchent `hashchange`. Le second élément ouvre un onglet en ajoutant une entrée d’historique.
 */
export function useOngletActif(): [IdOnglet, (id: IdOnglet) => void] {
  const hash = useSyncExternalStore(abonner, lireHash, () => '');
  const aller = useCallback((id: IdOnglet): void => {
    window.location.hash = id;
  }, []);
  return [ongletDepuisHash(hash), aller];
}
