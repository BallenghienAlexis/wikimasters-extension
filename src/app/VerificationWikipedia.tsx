import React, { useEffect, useSyncExternalStore } from 'react';
import { chargerCacheWikipedia, enregistrerCacheWikipedia } from '../lib/stockage';
import type { CacheWikipedia } from '../lib/wikipedia';
import { creerPlanificateur, type Planificateur } from './verifierWikipedia';

interface Props {
  /** Titres des cartes consultées (affichées dans la liste). */
  titres: string[];
  onCache: (cache: CacheWikipedia) => void;
}

const NB = ' ';

// Une seule file par page : elle survit au démontage du composant (ouverture de l'assistant, par exemple),
// pour ne jamais relancer de requêtes en parallèle ni après un refus.
let planificateur: Planificateur | null = null;
let rappelCache: (cache: CacheWikipedia) => void = () => undefined;

function lePlanificateur(): Planificateur {
  planificateur ??= creerPlanificateur({
    chargerCache: chargerCacheWikipedia,
    surCache: async (cache) => {
      rappelCache(cache);
      await enregistrerCacheWikipedia(cache);
    },
  });
  return planificateur;
}

/**
 * Vérifie automatiquement, d’après les catégories de leur page Wikipédia, les thèmes des cartes consultées
 * (affichées dans la liste). Une requête à la fois, une par seconde, uniquement pour les cartes absentes du cache.
 */
const VerificationWikipedia: React.FC<Props> = ({ titres, onCache }) => {
  const file = lePlanificateur();
  const etat = useSyncExternalStore(file.abonner, file.etat);

  useEffect(() => {
    rappelCache = onCache;
    return () => {
      rappelCache = () => undefined;
    };
  }, [onCache]);

  useEffect(() => {
    file.demander(titres);
  }, [file, titres]);

  return (
    <div className="mt-2 text-sm text-muted" data-testid="verification-wikipedia">
      <p>Les titres des cartes affichées sont vérifiés sur Wikipédia pour affiner leurs thèmes (aucune autre donnée n’est envoyée).</p>
      <p aria-live="polite">
        {etat.suspendue ?? (etat.enCours ? `Vérification en cours${NB}: ${Math.min(etat.faites, etat.total)} sur ${etat.total}` : null)}
      </p>
    </div>
  );
};

export default VerificationWikipedia;
