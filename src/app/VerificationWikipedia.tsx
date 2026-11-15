import React, { useEffect, useSyncExternalStore } from 'react';
import type { CacheWikipedia } from '../lib/wikipedia';
import { definirRappelCache, lePlanificateur } from './planificateurWikipedia';

interface Props {
  /** Titres des cartes consultées (affichées dans la liste). */
  titres: string[];
  onCache: (cache: CacheWikipedia) => void;
}

const NB = ' ';

/**
 * Vérifie automatiquement, d’après les catégories de leur page Wikipédia, les thèmes des cartes consultées
 * (affichées dans la liste). Une requête à la fois, une par seconde, uniquement pour les cartes absentes du cache.
 */
const VerificationWikipedia: React.FC<Props> = ({ titres, onCache }) => {
  const file = lePlanificateur();
  const etat = useSyncExternalStore(file.abonner, file.etat);

  useEffect(() => {
    // `onCache` (App) est stable et App n'est jamais démonté : on garde le rappel même quand ce composant l'est.
    definirRappelCache(onCache);
  }, [onCache]);

  useEffect(() => {
    file.demander(titres);
  }, [file, titres]);

  // Quitter la vue liste arrête de planifier de nouvelles vérifications (SC-011) ; elles reprendront au retour.
  useEffect(() => () => file.annuler(), [file]);

  return (
    <div className="mt-2 text-sm text-muted" data-testid="verification-wikipedia">
      <p>Les titres des cartes affichées sont vérifiés sur Wikipédia pour affiner leurs thèmes (aucune autre donnée n’est envoyée). Ceux des autres cartes sans thème le sont ensuite, en arrière-plan.</p>
      <p aria-live="polite">
        {etat.suspendue ?? (etat.enCours ? `Vérification en cours${NB}: ${Math.min(etat.faites, etat.total)} sur ${etat.total}` : null)}
      </p>
      {etat.suspendue === null && etat.fond > 0 ? (
        <p data-testid="verification-fond">Lecture en arrière-plan des cartes sans thème{NB}: {etat.fond.toLocaleString('fr-FR')} restantes.</p>
      ) : null}
    </div>
  );
};

export default VerificationWikipedia;
