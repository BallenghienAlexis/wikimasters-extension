import { useEffect } from 'react';
import type { Carte } from '../lib/collection';
import { sansThemeLocal } from '../lib/themes';
import type { CacheWikipedia } from '../lib/wikipedia';
import { definirRappelCache, lePlanificateur } from './planificateurWikipedia';

interface Props {
  cartes: readonly Carte[];
  prete: boolean;
  onCache: (cache: CacheWikipedia) => void;
}

/**
 * Lecture de fond (Alexis, 2026-11-15 : classement automatique, sans clé) : tant que la page de gestion est ouverte, les
 * titres de **toutes** les cartes sans thème fiable passent par la file Wikipédia/Wikidata, après ceux de la liste affichée.
 * Même cadence (une requête par seconde), mêmes arrêts, même cache de 30 jours ; ne rend rien.
 */
const VerificationFond: React.FC<Props> = ({ cartes, prete, onCache }) => {
  useEffect(() => {
    definirRappelCache(onCache);
  }, [onCache]);

  useEffect(() => {
    if (!prete) return;
    const titres = [...new Set(cartes.filter(sansThemeLocal).map((c) => c.titre))];
    if (titres.length > 0) lePlanificateur().demander(titres, true);
  }, [cartes, prete]);

  return null;
};

export default VerificationFond;
