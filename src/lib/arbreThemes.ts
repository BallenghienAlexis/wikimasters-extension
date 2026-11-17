// Arbre des thèmes par famille (Alexis, 2026-11-17) : parent → enfants, avec recherche. Fonctions pures, sans `chrome.*`.
// Les listes `parents` du catalogue contiennent déjà tous les ancêtres ; le parent direct est celui qu’aucun autre parent ne couvre.
// Une notion peut figurer sous plusieurs familles (une course automobile est sous Course ET sous Automobile).
import { normaliser } from './collection';
import { IDS_THEMES, LIBELLES_THEMES, parentsDe, THEME_AUTRES, versionThemes } from './themes';

const parLibelle = (a: string, b: string): number => (LIBELLES_THEMES[a] ?? a).localeCompare(LIBELLES_THEMES[b] ?? b, 'fr');

/** Parents directs d’un thème (sans ceux déjà couverts par un autre parent). */
export function parentsDirects(id: string): string[] {
  const parents = parentsDe(id);
  return parents.filter((p) => !parents.some((q) => q !== p && parentsDe(q).includes(p)));
}

// L’arbre suit le catalogue en mémoire, qui change quand des thèmes appris sont posés : il est recalculé à chaque nouvelle version.
let versionArbre = -1;
let enfantsParParent = new Map<string, string[]>();
let racines: string[] = [];
const identifiants = (): string[] => IDS_THEMES.filter((id) => id !== THEME_AUTRES);

function reconstruire(): void {
  if (versionArbre === versionThemes()) return;
  const m = new Map<string, string[]>();
  for (const id of identifiants()) for (const p of parentsDirects(id)) m.set(p, [...(m.get(p) ?? []), id]);
  for (const [p, liste] of m) m.set(p, liste.sort(parLibelle));
  enfantsParParent = m;
  racines = identifiants().filter((id) => parentsDe(id).length === 0).sort(parLibelle);
  versionArbre = versionThemes();
}

/** Familles de premier niveau (thèmes sans parent), par libellé. */
export function racinesArbre(): readonly string[] {
  reconstruire();
  return racines;
}

export const enfantsDe = (id: string): readonly string[] => {
  reconstruire();
  return enfantsParParent.get(id) ?? [];
};

/** Tous les ancêtres d’un thème (ceux qui, cochés, le couvrent). */
export const ancetresDe = (id: string): readonly string[] => parentsDe(id);

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
  for (const id of identifiants()) {
    const libelle = LIBELLES_THEMES[id] ?? id;
    if (!normaliser(libelle.replace(/^#/, '')).includes(q)) continue;
    trouves.add(id);
    visibles.add(id);
    for (const a of ancetresDe(id)) visibles.add(a);
  }
  return { visibles, trouves };
}
