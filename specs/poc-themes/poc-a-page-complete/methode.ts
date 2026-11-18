// POC A : déduction des thèmes à partir de la page Wikipédia complète, par scoring pondéré des canaux.
// Réutilise le lexique du catalogue (`themesDirectsDeTexte`) : le POC voisin (PR #192) étudie ses faux positifs, pas celui-ci.
import { parentsDe, themesDirectsDeTexte } from '../../../src/lib/themes';
import type { PageComplete } from './page';

export type Canal = 'definition' | 'infobox' | 'categories' | 'intro' | 'sections' | 'corps' | 'liens';
/** Canaux « forts » : au moins un doit porter un thème pour qu’il soit posé. */
export const CANAUX_FORTS: readonly Canal[] = ['definition', 'infobox', 'categories'];

export interface Options {
  poids: Partial<Record<Canal, number>>;
  /** Score minimal pour poser un thème. */
  seuil: number;
  /** Un thème doit valoir au moins cette part du meilleur. */
  partMin: number;
  /** Nombre de canaux forts distincts exigés. */
  canauxFortsMin: number;
  /** Une page d’homonymie ne propose rien (la page d’homonymie relève d’une autre étape). */
  ignorerHomonymie: boolean;
}

export const POIDS_COMPLET: Record<Canal, number> = { definition: 5, infobox: 4, categories: 3, intro: 2, sections: 1, corps: 0.5, liens: 0.5 };

export const VARIANTES: Record<string, Options> = {
  /** Ce que la production lit déjà : définition, introduction, catégories. */
  'A0 intro + catégories': { poids: { definition: 5, categories: 3, intro: 2 }, seuil: 3, partMin: 0.4, canauxFortsMin: 1, ignorerHomonymie: true },
  'A1 + infobox': { poids: { definition: 5, infobox: 4, categories: 3, intro: 2 }, seuil: 3, partMin: 0.4, canauxFortsMin: 1, ignorerHomonymie: true },
  'A2 + sections': { poids: { definition: 5, infobox: 4, categories: 3, intro: 2, sections: 1 }, seuil: 3, partMin: 0.4, canauxFortsMin: 1, ignorerHomonymie: true },
  'A3 page complète': { poids: POIDS_COMPLET, seuil: 3, partMin: 0.4, canauxFortsMin: 1, ignorerHomonymie: true },
  'A4 complète, 2 canaux forts': { poids: POIDS_COMPLET, seuil: 3, partMin: 0.4, canauxFortsMin: 2, ignorerHomonymie: true },
  'A5 complète, 2 canaux forts, seuil 5': { poids: POIDS_COMPLET, seuil: 5, partMin: 0.5, canauxFortsMin: 2, ignorerHomonymie: true },
};

const lier = (textes: readonly string[]): string => textes.join(' . ');

/** Thèmes (sans parents) trouvés par canal. Une occurrence compte une fois par canal, sauf sections, corps et liens (plafonnés). */
export function themesParCanal(page: PageComplete): Record<Canal, Map<string, number>> {
  const compter = (texte: string, categories = false): Map<string, number> => new Map(themesDirectsDeTexte(texte, categories).map((id) => [id, 1]));
  const parLignes = (textes: readonly string[], categories: boolean, plafond: number): Map<string, number> => {
    const m = new Map<string, number>();
    for (const t of textes) for (const id of themesDirectsDeTexte(t, categories)) m.set(id, Math.min(plafond, (m.get(id) ?? 0) + 1));
    return m;
  };
  return {
    definition: compter(page.definition),
    infobox: compter(lier([page.infoboxModele, ...page.infoboxValeurs])),
    categories: parLignes(page.categories, true, 3),
    intro: compter(page.intro),
    sections: parLignes(page.sections, false, 2),
    corps: compter(page.corps),
    liens: parLignes(page.liens, false, 3),
  };
}

export interface Detail { themes: string[]; scores: Record<string, number>; canaux: Record<string, Canal[]> }

export function deduirePage(page: PageComplete, options: Options): Detail {
  if (options.ignorerHomonymie && page.homonymie) return { themes: [], scores: {}, canaux: {} };
  const parCanal = themesParCanal(page);
  const scores: Record<string, number> = {};
  const canaux: Record<string, Canal[]> = {};
  for (const [canal, poids] of Object.entries(options.poids) as [Canal, number][]) {
    for (const [id, n] of parCanal[canal]) {
      scores[id] = (scores[id] ?? 0) + poids * Math.min(n, canal === 'categories' || canal === 'liens' || canal === 'sections' ? n : 1);
      (canaux[id] ??= []).push(canal);
    }
  }
  const meilleur = Math.max(0, ...Object.values(scores));
  let retenus = Object.entries(scores)
    .filter(([id, s]) => s >= options.seuil && s >= options.partMin * meilleur && (canaux[id] ?? []).filter((c) => CANAUX_FORTS.includes(c)).length >= options.canauxFortsMin)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  // Le plus précis l’emporte : un thème est retiré si l’un de ses descendants est retenu.
  const ancetres = new Set(retenus.flatMap((id) => ancetresDe(id)));
  retenus = retenus.filter((id) => !ancetres.has(id)).slice(0, 4);
  return { themes: retenus, scores, canaux };
}

function ancetresDe(id: string, vus = new Set<string>()): string[] {
  const resultat: string[] = [];
  for (const p of parentsDe(id)) {
    if (vus.has(p)) continue;
    vus.add(p);
    resultat.push(p, ...ancetresDe(p, vus));
  }
  return resultat;
}
