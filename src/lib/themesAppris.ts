// Thèmes appris (Alexis, 2026-11-17) : une catégorie Wikipédia déjà lue, qui ne correspond à aucun thème du catalogue et qui revient
// sur au moins 5 cartes distinctes, devient un thème, rattaché à la famille la plus fréquente de ces cartes. Aucune requête en plus :
// tout vient des catégories du cache Wikipédia. Logique pure, sans `chrome.*` ni état.
import { normaliser } from './collection';
import { LIBELLES_THEMES, parentsDe, themesDeTexte } from './themes';
import { estObjet } from './valider';

/** Nombre de cartes distinctes à partir duquel une catégorie devient un thème (Alexis, 2026-11-17). */
export const SEUIL_CARTES_APPRIS = 5;
/** Une catégorie portée par plus de cartes est trop générale pour être un thème. */
export const MAX_CARTES_APPRIS = 400;
export const MAX_THEMES_APPRIS = 100;
const MAX_JOURNAL = 100;

export type EtatThemeAppris = 'actif' | 'fusionne' | 'supprime';

export interface ThemeAppris {
  /** `appris-` + catégorie normalisée : stable, c’est la clé des préférences et des étiquettes. */
  id: string;
  /** Étiquette posée sur le site, « #Nom ». Renommable par le joueur. */
  libelle: string;
  /** Catégorie Wikipédia normalisée qui a donné ce thème. */
  categorie: string;
  /** Famille : parent direct puis tous ses ancêtres (vide : famille de premier niveau). */
  parents: string[];
  cartes: number;
  creeLe: number;
  etat: EtatThemeAppris;
  /** Si fusionné : identifiant du thème qui reçoit cette catégorie. */
  fusionneVers?: string;
}

export interface EntreeJournalAppris {
  le: number;
  texte: string;
}

export interface EtatAppris {
  version: 1;
  themes: ThemeAppris[];
  journal: EntreeJournalAppris[];
}

export const etatApprisVide = (): EtatAppris => ({ version: 1, themes: [], journal: [] });

const ETATS: readonly EtatThemeAppris[] = ['actif', 'fusionne', 'supprime'];

export function validerEtatAppris(brut: unknown): EtatAppris | null {
  if (!estObjet(brut) || brut.version !== 1 || !Array.isArray(brut.themes) || !Array.isArray(brut.journal)) return null;
  if (brut.themes.length > MAX_THEMES_APPRIS * 3 || brut.journal.length > MAX_JOURNAL * 2) return null;
  const themes: ThemeAppris[] = [];
  for (const t of brut.themes) {
    if (!estObjet(t) || typeof t.id !== 'string' || !/^appris-[a-z0-9-]{1,60}$/.test(t.id)) return null;
    if (typeof t.libelle !== 'string' || !/^#.{2,40}$/u.test(t.libelle) || typeof t.categorie !== 'string' || t.categorie.length > 120) return null;
    if (!Array.isArray(t.parents) || !t.parents.every((p) => typeof p === 'string') || t.parents.length > 20) return null;
    if (typeof t.cartes !== 'number' || !Number.isSafeInteger(t.cartes) || t.cartes < 0 || typeof t.creeLe !== 'number' || !Number.isSafeInteger(t.creeLe)) return null;
    if (!ETATS.includes(t.etat as EtatThemeAppris)) return null;
    themes.push({
      id: t.id, libelle: t.libelle, categorie: t.categorie, parents: [...(t.parents as string[])], cartes: t.cartes, creeLe: t.creeLe, etat: t.etat as EtatThemeAppris,
      ...(typeof t.fusionneVers === 'string' ? { fusionneVers: t.fusionneVers } : {}),
    });
  }
  const journal: EntreeJournalAppris[] = [];
  for (const j of brut.journal) {
    if (!estObjet(j) || typeof j.le !== 'number' || typeof j.texte !== 'string' || j.texte.length > 300) return null;
    journal.push({ le: j.le, texte: j.texte });
  }
  return { version: 1, themes, journal: journal.slice(-MAX_JOURNAL) };
}

// Catégories qui ne décrivent pas le sujet : dates, lieux de naissance, listes, maintenance.
const A_ECARTER = /^(naissance|deces|personnalite|personnalites|membre|membres|mort|morte|date|annee|decennie|siecle|liste|listes|type de|article|page|wikipedia|portail|ebauche|homonymie|bio|lien|modele|categorie|culture|histoire de|geographie de|vivant|nom de famille|prenom)/;

/** Catégorie normalisée, ou null si elle ne peut pas devenir un thème (année, « par pays », trop longue ou trop courte, maintenance). */
export function categorieUtilisable(categorie: string): string | null {
  const n = normaliser(categorie).trim();
  if (n.length < 3 || n.length > 40 || /[0-9]/.test(n) || n.includes(' par ') || n.split(/\s+/).length > 4 || A_ECARTER.test(n)) return null;
  return n;
}

/** « Cocktail à base de rhum (boisson) » → « #Cocktail à base de rhum » ; null si le nom n’est pas posable. */
export function libelleDepuisCategorie(categorie: string): string | null {
  const nom = categorie.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (nom.length < 2 || nom.length > 38) return null;
  return `#${nom.charAt(0).toLocaleUpperCase('fr')}${nom.slice(1)}`;
}

export const idDepuisCategorie = (normalisee: string): string => `appris-${normalisee.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`;

interface EntreeCategories {
  categories?: readonly string[];
  themes: readonly string[];
}

/**
 * Nouveaux thèmes appris à partir des catégories du cache. Une catégorie connue de l’état (même supprimée ou fusionnée) n’est pas reproposée ;
 * une catégorie qui correspond déjà à un thème du catalogue (mots-clés) n’en crée pas. La famille est le thème précis présent sur au moins
 * 60 % des cartes concernées. Les nombres de cartes des thèmes existants sont mis à jour.
 */
export function proposerThemes(entrees: Readonly<Record<string, EntreeCategories>>, etat: EtatAppris, maintenant: number): EtatAppris {
  const parCategorie = new Map<string, { brut: string; titres: string[] }>();
  for (const [titre, e] of Object.entries(entrees)) {
    const vues = new Set<string>();
    for (const brut of e.categories ?? []) {
      const n = categorieUtilisable(brut);
      if (n === null || vues.has(n)) continue;
      vues.add(n);
      const g = parCategorie.get(n);
      if (g) g.titres.push(titre);
      else parCategorie.set(n, { brut, titres: [titre] });
    }
  }
  const connues = new Map(etat.themes.map((t) => [t.categorie, t] as const));
  const libellesPris = new Set([...Object.values(LIBELLES_THEMES), ...etat.themes.map((t) => t.libelle)].map((l) => normaliser(l)));
  const themes = etat.themes.map((t) => ({ ...t, cartes: parCategorie.get(t.categorie)?.titres.length ?? t.cartes }));
  const journal = [...etat.journal];
  let actifs = themes.filter((t) => t.etat === 'actif').length;
  const candidats = [...parCategorie.entries()]
    .filter(([n, g]) => !connues.has(n) && g.titres.length >= SEUIL_CARTES_APPRIS && g.titres.length <= MAX_CARTES_APPRIS)
    .sort((a, b) => b[1].titres.length - a[1].titres.length || a[0].localeCompare(b[0], 'fr'));
  for (const [n, g] of candidats) {
    if (actifs >= MAX_THEMES_APPRIS) break;
    // Déjà couverte par le catalogue (« Rhum » → #Rhum) : pas de doublon.
    if (themesDeTexte(g.brut, true).length > 0) continue;
    const libelle = libelleDepuisCategorie(g.brut);
    if (libelle === null || libellesPris.has(normaliser(libelle))) continue;
    const presence = new Map<string, number>();
    for (const titre of g.titres) for (const id of new Set(entrees[titre]?.themes ?? [])) presence.set(id, (presence.get(id) ?? 0) + 1);
    const famille = [...presence.entries()]
      .filter(([, k]) => k >= g.titres.length * 0.6)
      .sort((a, b) => parentsDe(b[0]).length - parentsDe(a[0]).length || b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const parents = famille === undefined ? [] : [famille, ...parentsDe(famille)];
    const id = idDepuisCategorie(n);
    if (themes.some((t) => t.id === id)) continue;
    libellesPris.add(normaliser(libelle));
    themes.push({ id, libelle, categorie: n, parents, cartes: g.titres.length, creeLe: maintenant, etat: 'actif' });
    actifs += 1;
    journal.push({ le: maintenant, texte: `Thème appris : ${libelle} (${g.titres.length} cartes${famille === undefined ? ', famille à part' : `, famille ${LIBELLES_THEMES[famille] ?? famille}`}).` });
  }
  return { version: 1, themes, journal: journal.slice(-MAX_JOURNAL) };
}

/** Erreur lisible si le nom n’est pas posable ou déjà pris, sinon null. */
export function erreurDeNom(nom: string, etat: EtatAppris, id: string): string | null {
  const libelle = nom.trim().startsWith('#') ? nom.trim() : `#${nom.trim()}`;
  if (libelle.length < 3 || libelle.length > 40) return 'Le nom doit faire de 2 à 39 caractères.';
  const n = normaliser(libelle);
  const pris = [...Object.entries(LIBELLES_THEMES)].some(([k, l]) => k !== id && normaliser(l) === n) || etat.themes.some((t) => t.id !== id && t.etat === 'actif' && normaliser(t.libelle) === n);
  return pris ? 'Ce nom est déjà utilisé par un autre thème.' : null;
}

const note = (etat: EtatAppris, texte: string, maintenant: number): EntreeJournalAppris[] => [...etat.journal, { le: maintenant, texte }].slice(-MAX_JOURNAL);

export function renommer(etat: EtatAppris, id: string, nom: string, maintenant: number): EtatAppris {
  const libelle = nom.trim().startsWith('#') ? nom.trim() : `#${nom.trim()}`;
  const t = etat.themes.find((x) => x.id === id);
  if (!t || erreurDeNom(nom, etat, id) !== null) return etat;
  return { ...etat, themes: etat.themes.map((x) => (x.id === id ? { ...x, libelle } : x)), journal: note(etat, `${t.libelle} renommé en ${libelle}.`, maintenant) };
}

/** Supprime un thème appris : sa catégorie n’est plus jamais reproposée. */
export function supprimer(etat: EtatAppris, id: string, maintenant: number): EtatAppris {
  const t = etat.themes.find((x) => x.id === id);
  if (!t) return etat;
  return { ...etat, themes: etat.themes.map((x) => (x.id === id ? { ...x, etat: 'supprime' as const } : x)), journal: note(etat, `${t.libelle} supprimé.`, maintenant) };
}

/** Fusionne un thème appris dans un autre thème (catalogue ou appris) : ses cartes reçoivent ce thème, il n’a plus d’étiquette propre. */
export function fusionner(etat: EtatAppris, id: string, vers: string, maintenant: number): EtatAppris {
  const t = etat.themes.find((x) => x.id === id);
  const cible = LIBELLES_THEMES[vers];
  if (!t || cible === undefined || vers === id) return etat;
  return { ...etat, themes: etat.themes.map((x) => (x.id === id ? { ...x, etat: 'fusionne' as const, fusionneVers: vers } : x)), journal: note(etat, `${t.libelle} fusionné dans ${cible}.`, maintenant) };
}

/** Rétablit un thème supprimé ou fusionné. */
export function retablir(etat: EtatAppris, id: string, maintenant: number): EtatAppris {
  const t = etat.themes.find((x) => x.id === id);
  if (!t || t.etat === 'actif' || erreurDeNom(t.libelle, etat, id) !== null) return etat;
  const { fusionneVers: _vers, ...reste } = t;
  void _vers;
  return { ...etat, themes: etat.themes.map((x) => (x.id === id ? { ...reste, etat: 'actif' as const } : x)), journal: note(etat, `${t.libelle} rétabli.`, maintenant) };
}
