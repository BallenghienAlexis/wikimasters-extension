// File unique des vérifications Wikipédia de la page : partagée par la liste affichée (`VerificationWikipedia`) et la
// lecture de fond de toutes les cartes sans thème (`VerificationFond`). Elle survit au démontage des composants, pour ne
// jamais relancer de requêtes en parallèle ni après un refus.
import { creerCollecteur } from '../lib/durees';
import { ajouterDureesMesurees, chargerCacheWikipedia, chargerGrapheWikidata, enregistrerCacheWikipedia, enregistrerGrapheWikidata } from '../lib/stockage';
import { MAX_ENTITES_GRAPHE } from './grapheWikidata';
import type { CacheWikipedia } from '../lib/wikipedia';
import { creerPlanificateur, type Planificateur } from './verifierWikipedia';

let planificateur: Planificateur | null = null;
const collecteurDurees = creerCollecteur(ajouterDureesMesurees);
let rappelCache: (cache: CacheWikipedia) => void = () => undefined;

/** `App` n'est jamais démonté : le dernier rappel enregistré reste valable quand un composant l'est. */
export const definirRappelCache = (rappel: (cache: CacheWikipedia) => void): void => {
  rappelCache = rappel;
};

export function lePlanificateur(): Planificateur {
  planificateur ??= creerPlanificateur({
    mesurer: (ms) => collecteurDurees.noter('wikipedia', ms),
    chargerCache: chargerCacheWikipedia,
    chargerGraphe: () => chargerGrapheWikidata(MAX_ENTITES_GRAPHE),
    surGraphe: (graphe) => enregistrerGrapheWikidata(graphe, MAX_ENTITES_GRAPHE),
    surCache: async (cache) => {
      rappelCache(cache);
      await enregistrerCacheWikipedia(cache);
    },
  });
  return planificateur;
}
