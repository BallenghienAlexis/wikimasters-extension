// Préférences du joueur (amis et thèmes). L'assistant de tri et les statuts ont été retirés le 2026-11-14 :
// les étiquettes du site et les favoris font foi.
import { CONFIG_PRIX, PLAFOND_DEFAUSSE_MAX, PLAFOND_DEFAUSSE_MIN, PLAFOND_VALEUR_DEFAUSSE, type ConfigPrix } from '../config/prix';
import type { Carte } from './collection';
import { normaliser } from './collection';
import { DEFINITIONS_THEMES, THEME_AUTRES, themesDeCarte } from './themes';

export interface Ami {
  nom: string;
  themes: string[];
}

export interface Preferences {
  version: 2;
  mesThemes: string[];
  amis: Ami[];
  /** Plafond de défausse réglé par le joueur (1 à 20) ; absent : valeur par défaut de `config/prix.ts`. */
  plafondDefausse?: number;
}

/** Plafond de défausse effectif : la valeur réglée si elle est valide, sinon la valeur par défaut (5). */
export function plafondDefausse(preferences: Pick<Preferences, 'plafondDefausse'>): number {
  const v = preferences.plafondDefausse;
  return typeof v === 'number' && Number.isInteger(v) && v >= PLAFOND_DEFAUSSE_MIN && v <= PLAFOND_DEFAUSSE_MAX ? v : PLAFOND_VALEUR_DEFAUSSE;
}

export const preferencesParDefaut = (): Preferences => ({ version: 2, mesThemes: [], amis: [] });

export function valeurDeCarte(carte: Pick<Carte, 'valeurMarchande'>): number | null {
  return carte.valeurMarchande ?? null;
}

export function prixDepart(valeur: number, config: ConfigPrix = CONFIG_PRIX): number | null {
  const atteintes = config.matricePrixDepart.filter((tranche) => valeur >= tranche.valeurMin);
  if (atteintes.length === 0) return null;
  return atteintes.reduce((haute, tranche) => (tranche.valeurMin > haute.valeurMin ? tranche : haute)).prixDepart;
}

/**
 * Amis dont au moins un thème figure parmi ceux de la carte (parents compris), dans l'ordre de la liste.
 * Règle unique, partagée par le tri (premier ami) et par le lot (tous les amis).
 */
export function amisConcernes(themesCarte: readonly string[], amis: readonly Ami[]): Ami[] {
  if (themesCarte.length === 0) return [];
  const themes = new Set(themesCarte);
  return amis.filter((ami) => ami.themes.some((theme) => themes.has(theme)));
}

/**
 * Thèmes « aimés » déduits des cartes que le joueur a mises en favori sur le site (lecture locale :
 * aucune requête). Du plus fréquent au plus rare ; « autres » n'est jamais suggéré.
 */
export function themesAimesDesFavoris(cartes: readonly Carte[]): { theme: string; nombre: number }[] {
  const compte = new Map<string, number>();
  for (const carte of cartes) {
    if (!carte.favori) continue;
    // Seuls les thèmes les plus précis : un parent déjà couvert par un thème de la carte est écarté,
    // sinon « Tibet » ferait cocher toute la géographie.
    const themes = themesDeCarte(carte);
    const parents = new Set(DEFINITIONS_THEMES.filter((d) => themes.includes(d.id)).flatMap((d) => d.parents ?? []));
    for (const theme of themes) {
      if (theme === THEME_AUTRES || parents.has(theme)) continue;
      compte.set(theme, (compte.get(theme) ?? 0) + 1);
    }
  }
  return [...compte.entries()]
    .map(([theme, nombre]) => ({ theme, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.theme.localeCompare(b.theme, 'fr'));
}

const estListeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

// Valide des préférences stockées ; retourne les valeurs par défaut si elles sont illisibles.
export function lirePreferences(brut: unknown): Preferences {
  if (typeof brut !== 'object' || brut === null) return preferencesParDefaut();
  const { version, mesThemes, amis, plafondDefausse: plafond } = brut as Partial<Preferences>;
  const amisValides =
    Array.isArray(amis) && amis.every((a) => typeof a === 'object' && a !== null && typeof a.nom === 'string' && estListeTextes(a.themes));
  if (version !== 2 || !estListeTextes(mesThemes) || !amisValides) return preferencesParDefaut();
  const base: Preferences = { version, mesThemes, amis };
  return typeof plafond === 'number' && plafondDefausse({ plafondDefausse: plafond }) === plafond ? { ...base, plafondDefausse: plafond } : base;
}

const cleAmi = (nom: string): string => normaliser(nom.trim());

/**
 * Ajoute les amis et intérêts initiaux aux préférences : un ami absent est ajouté, un ami présent
 * (même nom, casse et accents ignorés) reçoit les thèmes qui lui manquent. Rien n'est jamais retiré,
 * l'entrée n'est pas modifiée, et l'opération est idempotente.
 */
export function fusionnerAmisInitiaux(preferences: Preferences, initiaux: readonly Ami[]): Preferences {
  const amis: Ami[] = preferences.amis.map((a) => ({ nom: a.nom, themes: [...a.themes] }));
  for (const initial of initiaux) {
    const existant = amis.find((a) => cleAmi(a.nom) === cleAmi(initial.nom));
    if (!existant) {
      amis.push({ nom: initial.nom, themes: [...initial.themes] });
      continue;
    }
    for (const theme of initial.themes) if (!existant.themes.includes(theme)) existant.themes.push(theme);
  }
  return { ...preferences, mesThemes: [...preferences.mesThemes], amis };
}
