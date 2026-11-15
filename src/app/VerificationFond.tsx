import React, { useEffect, useSyncExternalStore } from 'react';
import type { Carte } from '../lib/collection';
import { sansThemeLocal } from '../lib/themes';
import type { CacheWikipedia } from '../lib/wikipedia';
import { definirRappelCache, lePlanificateur } from './planificateurWikipedia';

interface Props {
  cartes: readonly Carte[];
  prete: boolean;
  onCache: (cache: CacheWikipedia) => void;
}

const NB = ' ';

/**
 * Lecture de fond (Alexis, 2026-11-15 : classement automatique, sans clé) : tant que la page de gestion est ouverte, les
 * titres de **toutes** les cartes sans thème fiable passent par la file Wikipédia/Wikidata, après ceux de la liste affichée.
 * Même cadence (une requête par seconde), mêmes arrêts, même cache de 30 jours. Une ligne d'état, visible sur tous les onglets,
 * annonce la lecture en cours ou sa suspension.
 */
const VerificationFond: React.FC<Props> = ({ cartes, prete, onCache }) => {
  const file = lePlanificateur();
  const etat = useSyncExternalStore(file.abonner, file.etat);

  useEffect(() => {
    definirRappelCache(onCache);
  }, [onCache]);

  useEffect(() => {
    if (!prete) return;
    const titres = [...new Set(cartes.filter(sansThemeLocal).map((c) => c.titre))];
    if (titres.length > 0) file.demander(titres, true);
  }, [cartes, prete, file]);

  const texte = etat.suspendue ?? (etat.fond > 0 ? `Lecture en arrière-plan de Wikipédia et Wikidata pour les cartes sans thème${NB}: ${etat.fond.toLocaleString('fr-FR')} restantes.` : null);
  return texte === null ? null : (
    <p className="mt-2 text-sm text-muted" aria-live="polite" data-testid="verification-fond">
      {texte}
    </p>
  );
};

export default VerificationFond;
