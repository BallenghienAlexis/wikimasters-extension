/**
 * Tags d’une carte dans la Collection : ce que le site porte vraiment (étiquettes posées, qui font foi) et ce que
 * l’extension prévoit en plus. Le filtre par thème, le compteur de thèmes et la ligne affichée utilisent la même source,
 * pour qu’une carte filtrée sur un thème montre ce thème parmi ses tags. Logique pure.
 */
import type { Carte } from './collection';
import { LIBELLES_THEMES, libellesThemesAffiches, parentsDe, THEME_AUTRES, versionThemes } from './themes';

type CarteTags = Pick<Carte, 'titre' | 'description' | 'etiquettesSite'> & { themesChoisis?: string[] | null };

export interface TagsCarte {
  /** Étiquettes de thème posées sur le site (source de vérité). */
  poses: string[];
  /** Thèmes que l’extension poserait et que le site n’a pas encore. */
  aPoser: string[];
}

/** Libellé → identifiant des thèmes du catalogue (« #Autres » exclu : jamais posé), reconstruit quand les thèmes changent. */
let tableLibelles: { version: number; table: Map<string, string> } | null = null;
function libellesDeTheme(): Map<string, string> {
  const version = versionThemes();
  if (tableLibelles?.version === version) return tableLibelles.table;
  const table = new Map<string, string>();
  for (const [id, libelle] of Object.entries(LIBELLES_THEMES)) if (id !== THEME_AUTRES) table.set(libelle, id);
  tableLibelles = { version, table };
  return table;
}

export function tagsDeCarte(carte: CarteTags): TagsCarte {
  // Seules les étiquettes de thème comptent (« #À échanger… », « Statut · … » et étiquettes personnelles n’en sont pas).
  const table = libellesDeTheme();
  const poses = (carte.etiquettesSite ?? []).filter((n) => table.has(n));
  const surSite = new Set(poses);
  return { poses, aPoser: libellesThemesAffiches(carte).filter((l) => !surSite.has(l)) };
}

/** Tags retenus pour le filtre : les étiquettes posées, sinon les thèmes prévus quand rien n’est posé. */
function tagsRetenus(carte: CarteTags): string[] {
  const { poses, aPoser } = tagsDeCarte(carte);
  return poses.length > 0 ? poses : aPoser;
}

/**
 * Une carte correspond à un thème si ce thème figure parmi les tags affichés, ou si l’un des tags en est un descendant
 * (Alexis, 2026-11-24 : filtrer sur un parent liste aussi les cartes de ses thèmes enfants). Les parents ne sont jamais
 * posés comme étiquettes : sans cette règle, une famille ne trouverait aucune carte.
 */
export function correspondAuTheme(carte: CarteTags, theme: string): boolean {
  const tags = tagsRetenus(carte);
  if (theme === THEME_AUTRES) return tags.length === 0;
  const libelle = LIBELLES_THEMES[theme];
  if (libelle === undefined) return false;
  if (tags.includes(libelle)) return true;
  const table = libellesDeTheme();
  return tags.some((tag) => {
    const id = table.get(tag);
    return id !== undefined && parentsDe(id).includes(theme);
  });
}

/** Nombre de cartes par thème, avec la même source que le filtre : le chiffre affiché égale le nombre de cartes filtrées. */
export function compterParTheme(cartes: readonly CarteTags[], themes: readonly string[]): Record<string, number> {
  const compte: Record<string, number> = Object.fromEntries(themes.map((t) => [t, 0]));
  const table = libellesDeTheme();
  const voulus = new Set(themes);
  for (const c of cartes) {
    const tags = tagsRetenus(c); // une seule fois par carte
    if (tags.length === 0) {
      if (voulus.has(THEME_AUTRES)) compte[THEME_AUTRES] = (compte[THEME_AUTRES] ?? 0) + 1;
      continue;
    }
    for (const tag of new Set(tags)) {
      const id = table.get(tag);
      if (id !== undefined && voulus.has(id)) compte[id] = (compte[id] ?? 0) + 1;
    }
  }
  return compte;
}
