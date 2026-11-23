// Lecture du graphe de classes Wikidata d’une carte : remonte les « sous-classe de » (P279) depuis les classes de l’entité jusqu’à
// 7 niveaux, par lots de 50 entités, et ne redemande jamais une entité déjà connue (le graphe est mémorisé entre les cartes).
// Aucun `fetch` ici : les requêtes passent par `appeler` (cadence, arrêts 403 et 429 et transport de `verifierWikipedia.ts`).
import {
  ancetresAChargerDe,
  ciblesDeLaCarte,
  estTaxon,
  lireEntitesWikidata,
  PROPRIETES_ANCETRE,
  themesDeGraphe,
  urlEntitesWikidata,
  type EntiteGraphe,
  type GrapheWikidata,
} from '../lib/classesWikidata';
import { parentsDe } from '../lib/themes';

/** Entités ancêtres gardées en mémoire : au-delà, le graphe n’est plus agrandi (les cartes suivantes se contentent de ce qui est connu). */
import { MAX_ENTITES_GRAPHE } from '../lib/classesWikidata';
export { MAX_ENTITES_GRAPHE };
const NIVEAUX_P279 = 7;
const NIVEAUX_P171 = 12;
const PAR_REQUETE = 50;

export type Appeler = (url: string) => Promise<unknown>;

/** Charge les entités inconnues de `ids` dans `graphe` ; false si une requête n’a rien donné d’exploitable. */
async function charger(graphe: GrapheWikidata, ids: readonly string[], appeler: Appeler, ajoutees: { n: number }): Promise<boolean> {
  // Graphe plein : rien ne serait gardé, on ne redemande pas (les classes inconnues comptent pour rien).
  const place = MAX_ENTITES_GRAPHE - Object.keys(graphe).length;
  const inconnues = ids.filter((id) => !(id in graphe)).slice(0, Math.max(0, place));
  for (let i = 0; i < inconnues.length; i += PAR_REQUETE) {
    const lot = inconnues.slice(i, i + PAR_REQUETE);
    const lues = lireEntitesWikidata(await appeler(urlEntitesWikidata(lot)), PROPRIETES_ANCETRE);
    if (lues === null) return false;
    for (const id of lot) {
      if (Object.keys(graphe).length >= MAX_ENTITES_GRAPHE) break;
      graphe[id] = lues[id] ?? {};
      ajoutees.n += 1;
    }
  }
  return true;
}

export interface ThemesWikidata {
  themes: string[];
  /** Nombre d’entités ajoutées au graphe (à enregistrer s’il est positif). */
  ajoutees: number;
}

/**
 * Thèmes d’une carte d’après les classes de son entité Wikidata. `racine` porte les propriétés de la carte (déjà lues) ;
 * `graphe` est complété sur place. null = une requête a échoué : la carte garde ce que les autres sources ont donné.
 * Les arrêts 403 et 429 sont levés par `appeler` (AbortError) et traversent cette fonction.
 */
export async function themesWikidataDe(qid: string, racine: EntiteGraphe, graphe: GrapheWikidata, appeler: Appeler): Promise<ThemesWikidata | null> {
  const ajoutees = { n: 0 };
  let front: string[] = ciblesDeLaCarte(racine);
  const vus = new Set<string>([qid]);
  for (let niveau = 0; niveau < NIVEAUX_P279 && front.length > 0; niveau++) {
    if (!(await charger(graphe, front, appeler, ajoutees))) return null;
    front.forEach((id) => vus.add(id));
    front = [...new Set(front.flatMap((id) => graphe[id]?.P279 ?? []))].filter((id) => !vus.has(id));
  }
  // Taxon (espèce, genre…) : la chaîne du taxon parent mène au règne des animaux, des plantes ou des champignons.
  if (estTaxon(racine)) {
    let chaine = (racine.P171 ?? []).slice(0, 2);
    for (let niveau = 0; niveau < NIVEAUX_P171 && chaine.length > 0; niveau++) {
      if (!(await charger(graphe, chaine, appeler, ajoutees))) return null;
      chaine = ancetresAChargerDe(graphe, chaine, 'P171').slice(0, 2);
    }
  }
  // L’entité de la carte n’est pas enregistrée dans le graphe : seuls ses ancêtres le sont.
  return { themes: themesDeGraphe({ ...graphe, [qid]: racine }, qid, parentsDe), ajoutees: ajoutees.n };
}
