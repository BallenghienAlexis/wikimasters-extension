// Règles de l'assistant de tri : transforme les préférences du joueur en propositions locales.
// Rien n'est exécuté sur le site : le joueur défausse, vend et échange lui-même.
import { CONFIG_PRIX, type ConfigPrix } from '../config/prix';
import type { Carte, Collection, Statut } from './collection';
import { normaliser } from './collection';
import { themesDeCarte } from './themes';

export interface Ami {
  nom: string;
  themes: string[];
}

export interface Preferences {
  version: 2;
  mesThemes: string[];
  amis: Ami[];
}

export const preferencesParDefaut = (): Preferences => ({ version: 2, mesThemes: [], amis: [] });

export function valeurDeCarte(carte: Pick<Carte, 'valeurMarchande' | 'rarete'>, config: ConfigPrix = CONFIG_PRIX): number | null {
  return carte.valeurMarchande ?? config.valeurParRarete[carte.rarete ?? ''] ?? null;
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

export interface Proposition {
  statut: Statut;
  ami: string | null;
  prixCible: number | null;
}

export function proposerTri(carte: Carte, preferences: Preferences, config: ConfigPrix = CONFIG_PRIX): Proposition {
  const garder: Proposition = { statut: 'garder', ami: null, prixCible: null };
  // Le site interdit de vendre, d'échanger ou de défausser un favori.
  if (carte.favori) return garder;

  const themes = themesDeCarte(carte);
  if (preferences.mesThemes.some((theme) => themes.includes(theme))) return garder;

  const ami = amisConcernes(themes, preferences.amis)[0];
  if (ami) return { statut: 'echanger', ami: ami.nom, prixCible: null };

  // Sans valeur connue, on ne propose rien : une défausse ne se rattrape pas.
  const valeur = valeurDeCarte(carte, config);
  if (valeur === null) return { statut: 'a-trier', ami: null, prixCible: null };
  if (valeur < config.seuilDefausse) return { statut: 'defausser', ami: null, prixCible: null };
  return { statut: 'vendre', ami: null, prixCible: prixDepart(valeur, config) };
}

// Une décision prise à la main n'est jamais remplacée.
export function appliquerTri(collection: Collection, preferences: Preferences, config: ConfigPrix = CONFIG_PRIX): Collection {
  return {
    ...collection,
    cartes: collection.cartes.map((carte) => {
      if (carte.decidePar === 'moi') return carte;
      return { ...carte, ...proposerTri(carte, preferences, config), decidePar: 'assistant' };
    }),
  };
}

export interface FileDeVente {
  enCours: Carte[];
  placesLibres: number;
  prochaines: Carte[];
  enAttente: number;
}

// Les enchères simultanées sont limitées : on propose d'abord les cartes qui valent le plus.
export function fileDeVente(cartes: Carte[], config: ConfigPrix = CONFIG_PRIX): FileDeVente {
  const enCours = cartes.filter((c) => c.statut === 'en-vente');
  const aVendre = cartes
    .filter((c) => c.statut === 'vendre')
    .sort((a, b) => (valeurDeCarte(b, config) ?? 0) - (valeurDeCarte(a, config) ?? 0));
  const placesLibres = Math.max(0, config.maxVentesSimultanees - enCours.length);
  return {
    enCours,
    placesLibres,
    prochaines: aVendre.slice(0, placesLibres),
    enAttente: Math.max(0, aVendre.length - placesLibres),
  };
}

export type Apercu = Record<Statut, { nombre: number; exemples: string[] }>;

export function apercuTri(collection: Collection, preferences: Preferences, config: ConfigPrix = CONFIG_PRIX, nbExemples = 5): Apercu {
  const apercu: Apercu = {
    'a-trier': { nombre: 0, exemples: [] },
    garder: { nombre: 0, exemples: [] },
    echanger: { nombre: 0, exemples: [] },
    vendre: { nombre: 0, exemples: [] },
    'en-vente': { nombre: 0, exemples: [] },
    defausser: { nombre: 0, exemples: [] },
  };
  for (const carte of appliquerTri(collection, preferences, config).cartes) {
    const groupe = apercu[carte.statut];
    groupe.nombre += 1;
    if (groupe.exemples.length < nbExemples) groupe.exemples.push(carte.titre);
  }
  return apercu;
}

const estListeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

// Valide des préférences stockées ; retourne les valeurs par défaut si elles sont illisibles.
export function lirePreferences(brut: unknown): Preferences {
  if (typeof brut !== 'object' || brut === null) return preferencesParDefaut();
  const { version, mesThemes, amis } = brut as Partial<Preferences>;
  const amisValides =
    Array.isArray(amis) && amis.every((a) => typeof a === 'object' && a !== null && typeof a.nom === 'string' && estListeTextes(a.themes));
  if (version !== 2 || !estListeTextes(mesThemes) || !amisValides) return preferencesParDefaut();
  return { version, mesThemes, amis };
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
