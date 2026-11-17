// Arbre des thèmes par famille (Alexis, 2026-11-17) : parent → enfants, avec recherche. Fonctions pures, sans `chrome.*`.
// Les listes `parents` du catalogue contiennent déjà tous les ancêtres ; le parent direct est celui qu’aucun autre parent ne couvre.
// Une notion peut figurer sous plusieurs familles (une course automobile est sous Course ET sous Automobile).
import { normaliser } from './collection';
import { DEFINITIONS_THEMES, LIBELLES_THEMES } from './themes';

const ANCETRES = new Map(DEFINITIONS_THEMES.map((t) => [t.id, t.parents ?? []] as const));

const parLibelle = (a: string, b: string): number => (LIBELLES_THEMES[a] ?? a).localeCompare(LIBELLES_THEMES[b] ?? b, 'fr');

/** Parents directs d’un thème (sans ceux déjà couverts par un autre parent). */
export function parentsDirects(id: string): string[] {
  const parents = ANCETRES.get(id) ?? [];
  return parents.filter((p) => !parents.some((q) => q !== p && (ANCETRES.get(q) ?? []).includes(p)));
}

const ENFANTS = (() => {
  const m = new Map<string, string[]>();
  for (const { id } of DEFINITIONS_THEMES) for (const p of parentsDirects(id)) m.set(p, [...(m.get(p) ?? []), id]);
  for (const [p, liste] of m) m.set(p, liste.sort(parLibelle));
  return m;
})();

/** Familles de premier niveau (thèmes sans parent), par libellé. */
export const RACINES: readonly string[] = DEFINITIONS_THEMES.filter((t) => (t.parents ?? []).length === 0)
  .map((t) => t.id)
  .sort(parLibelle);

export const enfantsDe = (id: string): readonly string[] => ENFANTS.get(id) ?? [];

/** Tous les ancêtres d’un thème (ceux qui, cochés, le couvrent). */
export const ancetresDe = (id: string): readonly string[] => ANCETRES.get(id) ?? [];

/** Thème coché qui couvre `id` sans être lui-même (« Alcool » couvre « Rhum »), s’il y en a un. */
export const couvertPar = (id: string, selection: readonly string[]): string | undefined => ancetresDe(id).find((a) => selection.includes(a));

/** Les thèmes de la sélection qui ne sont couverts par aucun autre (ce qu’il faut vraiment retenir). */
export const selectionMinimale = (selection: readonly string[]): string[] => selection.filter((id) => couvertPar(id, selection) === undefined);

export interface RechercheArbre {
  /** Thèmes à afficher : ceux qui correspondent et leurs ancêtres. */
  visibles: ReadonlySet<string>;
  /** Thèmes qui correspondent à la recherche. */
  trouves: ReadonlySet<string>;
}

/** Recherche insensible à la casse et aux accents sur les libellés ; une requête vide montre tout. */
export function chercherThemes(requete: string): RechercheArbre | null {
  const q = normaliser(requete.replace(/^#/, '')).trim();
  if (q === '') return null;
  const trouves = new Set<string>();
  const visibles = new Set<string>();
  for (const { id, libelle } of DEFINITIONS_THEMES) {
    if (!normaliser(libelle.replace(/^#/, '')).includes(q)) continue;
    trouves.add(id);
    visibles.add(id);
    for (const a of ancetresDe(id)) visibles.add(a);
  }
  return { visibles, trouves };
}
