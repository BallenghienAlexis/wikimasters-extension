/**
 * Tags d’une carte dans la Collection : ce que le site porte vraiment (étiquettes posées, qui font foi) et ce que
 * l’extension prévoit en plus. Le filtre par thème et la ligne affichée utilisent la même source, pour qu’une carte
 * filtrée sur un thème montre ce thème parmi ses tags. Logique pure.
 */
import type { Carte } from './collection';
import { LIBELLES_THEMES, libellesThemesAffiches, THEME_AUTRES } from './themes';

type CarteTags = Pick<Carte, 'titre' | 'description' | 'etiquettesSite'> & { themesChoisis?: string[] | null };

export interface TagsCarte {
  /** Étiquettes posées sur le site (source de vérité). */
  poses: string[];
  /** Thèmes que l’extension poserait et que le site n’a pas encore. */
  aPoser: string[];
}

/** Étiquettes de thème seulement (« #À échanger… », « Statut · … » et étiquettes personnelles du joueur n’en sont pas). */
const etiquettesDeTheme = (noms: readonly string[]): string[] => {
  const libelles = new Set(Object.values(LIBELLES_THEMES));
  return noms.filter((n) => libelles.has(n));
};

export function tagsDeCarte(carte: CarteTags): TagsCarte {
  const poses = etiquettesDeTheme(carte.etiquettesSite ?? []);
  const prevus = libellesThemesAffiches(carte);
  const surSite = new Set(poses);
  return { poses, aPoser: prevus.filter((l) => !surSite.has(l)) };
}

/** Une carte correspond à un thème si ce thème figure parmi les tags affichés (posés, sinon prévus quand rien n’est posé). */
export function correspondAuTheme(carte: CarteTags, theme: string): boolean {
  const { poses, aPoser } = tagsDeCarte(carte);
  const tags = poses.length > 0 ? poses : aPoser;
  if (theme === THEME_AUTRES) return tags.length === 0;
  const libelle = LIBELLES_THEMES[theme];
  return libelle !== undefined && tags.includes(libelle);
}

/** Nombre de cartes par thème, avec la même source que le filtre : le chiffre affiché égale le nombre de cartes filtrées. */
export function compterParTheme(cartes: readonly CarteTags[], themes: readonly string[]): Record<string, number> {
  const compte: Record<string, number> = Object.fromEntries(themes.map((t) => [t, 0]));
  for (const c of cartes) for (const t of themes) if (correspondAuTheme(c, t)) compte[t] = (compte[t] ?? 0) + 1;
  return compte;
}
