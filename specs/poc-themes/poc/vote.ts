// POC thèmes — règles de décision par accord entre signaux. Un thème n'est posé que si plusieurs sources indépendantes concordent ;
// sinon la carte reste « sans thème fiable » (liste vide), jamais « À classer » ni « Autres ».
import { ancetres, calculerSignaux, genreDePage } from './signaux';
import type { NomSignal, Page, Signaux } from './types';
import type { Genre } from '../../../src/lib/sens';

export const MAX_THEMES = 4;
const PHYSIQUES = new Set(['nature', 'vehicule', 'espace', 'geographie', 'sciences']);
const HUMAINS: ReadonlySet<Genre> = new Set(['personne', 'oeuvre', 'organisation', 'produit', 'notion']);
const estPhysique = (id: string): boolean => PHYSIQUES.has(id) || [...ancetres(id)].some((a) => PHYSIQUES.has(a));

export interface ReglesVote {
  nom: string;
  poids: Record<NomSignal, number>;
  /** Score minimal pour poser un thème. */
  seuil: number;
  /** Un thème physique est refusé pour une personne, une œuvre, une organisation, un produit ou une notion, sauf si la définition ou Wikidata le portent. */
  veto: boolean;
}

/** Variante 1 : au moins deux signaux sur cinq concordent (chacun pèse 1). */
export const V1: ReglesVote = { nom: 'V1 accord de 2 signaux', poids: { site: 1, definition: 1, wikidata: 1, categories: 1, lexical: 1 }, seuil: 2, veto: true };
/** Variante 2 : la définition et Wikidata (classificatoires) pèsent 2, seuil 3 : deux sources fortes ou une forte et une faible. */
export const V2: ReglesVote = { nom: 'V2 pondéré (déf. et Wikidata = 2, seuil 3)', poids: { site: 1, definition: 2, wikidata: 2, categories: 1, lexical: 1 }, seuil: 3, veto: true };

/** Un signal qui propose un thème soutient aussi ses ancêtres (« #Metalcore » soutient « #Métal » et « #Musique »). */
function soutiens(signaux: Signaux, regles: ReglesVote): Map<string, { score: number; par: Set<NomSignal> }> {
  const m = new Map<string, { score: number; par: Set<NomSignal> }>();
  for (const nom of Object.keys(signaux) as NomSignal[]) {
    const portes = new Set<string>();
    for (const id of signaux[nom]) {
      portes.add(id);
      for (const a of ancetres(id)) portes.add(a);
    }
    for (const id of portes) {
      const e = m.get(id) ?? { score: 0, par: new Set<NomSignal>() };
      e.score += regles.poids[nom];
      e.par.add(nom);
      m.set(id, e);
    }
  }
  return m;
}

export function voter(page: Page, regles: ReglesVote, signaux: Signaux = calculerSignaux(page)): string[] {
  const genre = genreDePage(page);
  const retenus = [...soutiens(signaux, regles).entries()].filter(([id, e]) => {
    if (e.score < regles.seuil) return false;
    if (regles.veto && HUMAINS.has(genre) && estPhysique(id) && !e.par.has('definition') && !e.par.has('wikidata')) return false;
    return true;
  });
  // Un thème qui est l'ancêtre d'un autre thème retenu est écarté : le plus précis suffit.
  const anc = new Set(retenus.flatMap(([id]) => [...ancetres(id)]));
  return retenus
    .filter(([id]) => !anc.has(id))
    .sort(([a, x], [b, y]) => y.score - x.score || ancetres(b).size - ancetres(a).size || a.localeCompare(b))
    .slice(0, MAX_THEMES)
    .map(([id]) => id);
}
