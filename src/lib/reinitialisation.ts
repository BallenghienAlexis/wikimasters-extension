/**
 * Réinitialisation globale (Alexis, 2026-11-21) : repartir d’une base propre.
 *
 * Logique pure, sans `chrome.*` ni réseau. Deux volets indépendants :
 * - **site** : liste des étiquettes du compte à supprimer (RPC `delete_tag`, action `suppression-etiquette`). Seules des
 *   étiquettes sont visées : les favoris (colonne `starred` de `user_cards`) ne passent par aucune de ces routes ;
 *   `garantirSansFavori` refuse tout plan qui contiendrait autre chose qu’une suppression d’étiquette ;
 * - **local** : tout `chrome.storage.local` est effacé, sauf les thèmes aimés, ceux des amis et les choix de favori (collection réduite ; préférences réduites à
 *   `mesThemes` et `amis`) et le drapeau `amisInitiaux` (sinon les amis initiaux seraient refusionnés).
 */
import { ID_CARTE_ETIQUETTES, type Action, type Registre } from './actions';
import type { EtiquetteSite } from './etiquettesPreexistantes';
import type { Carte, Collection } from './collection';
import type { Preferences } from './tri';

/** Catégorie d’une étiquette du compte. */
export type CategorieEtiquette = 'theme' | 'statut' | 'echange' | 'autre';

const PREFIXE_STATUT = 'Statut · ';
const PREFIXE_ECHANGE = '#À échanger ';
/** Étiquettes de thème que l’extension a pu poser mais qui ne sont pas au catalogue. */
const THEMES_SPECIAUX = ['#À classer', '#Autres'];

/**
 * « theme » : libellé du catalogue (ou d’un thème appris), « #À classer », « #Autres » ou étiquette du registre qui n’est
 * ni « Statut · » ni « #À échanger » ; « statut » et « echange » : préfixes du plan ; « autre » : étiquette que l’extension
 * ne reconnaît pas (posée à la main sur le site), jamais supprimée sans choix explicite.
 */
export function categorieEtiquette(nom: string, libellesThemes: ReadonlySet<string>, registre: Registre): CategorieEtiquette {
  if (nom.startsWith(PREFIXE_STATUT)) return 'statut';
  if (nom.startsWith(PREFIXE_ECHANGE)) return 'echange';
  if (libellesThemes.has(nom) || THEMES_SPECIAUX.includes(nom)) return 'theme';
  if (Object.prototype.hasOwnProperty.call(registre.etiquettes, nom)) return 'theme';
  return 'autre';
}

export interface OptionsReinitSite {
  /** Supprimer aussi les étiquettes « Statut · … » (défaut : oui). */
  statut: boolean;
  /** Supprimer aussi les étiquettes « #À échanger … » (défaut : oui). */
  echange: boolean;
  /** Supprimer aussi les étiquettes inconnues de l’extension (défaut : non). */
  autres: boolean;
}

/** Alexis, 2026-11-21 : « repartir de 0 » : « Statut · » et « #À échanger » partent aussi ; les étiquettes inconnues restent à cocher. */
export const OPTIONS_REINIT_PAR_DEFAUT: OptionsReinitSite = { statut: true, echange: true, autres: false };

export interface PlanSite {
  /** Étiquettes qui seront supprimées. */
  aSupprimer: Array<EtiquetteSite & { categorie: CategorieEtiquette }>;
  /** Étiquettes gardées, avec la raison. */
  gardees: Array<EtiquetteSite & { categorie: CategorieEtiquette }>;
  /** Nombre d’étiquettes du compte par catégorie (supprimées ou non). */
  parCategorie: Record<CategorieEtiquette, { etiquettes: number; cartes: number }>;
}

export function planSite(
  site: readonly EtiquetteSite[],
  libellesThemes: ReadonlySet<string>,
  registre: Registre,
  options: OptionsReinitSite,
): PlanSite {
  const parCategorie: PlanSite['parCategorie'] = {
    theme: { etiquettes: 0, cartes: 0 },
    statut: { etiquettes: 0, cartes: 0 },
    echange: { etiquettes: 0, cartes: 0 },
    autre: { etiquettes: 0, cartes: 0 },
  };
  const aSupprimer: PlanSite['aSupprimer'] = [];
  const gardees: PlanSite['gardees'] = [];
  const ordonnees = [...site].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  for (const e of ordonnees) {
    const categorie = categorieEtiquette(e.nom, libellesThemes, registre);
    parCategorie[categorie].etiquettes += 1;
    parCategorie[categorie].cartes += e.nbCartes;
    const supprimer = categorie === 'theme' || (categorie === 'statut' && options.statut) || (categorie === 'echange' && options.echange) || (categorie === 'autre' && options.autres);
    (supprimer ? aSupprimer : gardees).push({ ...e, categorie });
  }
  return { aSupprimer, gardees, parCategorie };
}

/**
 * Actions du volet site : une suppression d’étiquette par étiquette, rien d’autre. `limite` borne un essai
 * (par exemple 1 étiquette avant de poursuivre) ; les étiquettes déjà supprimées ne figurent plus dans la liste lue,
 * donc relancer après une interruption ne reprend que ce qui reste.
 */
export function actionsReinitSite(plan: PlanSite, limite?: number): Action[] {
  const choisies = limite === undefined ? plan.aSupprimer : plan.aSupprimer.slice(0, Math.max(0, limite));
  const actions: Action[] = choisies.map((e) => ({ type: 'suppression-etiquette', idCarte: ID_CARTE_ETIQUETTES, nomEtiquette: e.nom, idEtiquette: e.id }));
  garantirSansFavori(actions);
  return actions;
}

/** Garde-fou : un plan de réinitialisation ne contient que des suppressions d’étiquettes (jamais un favori, une enchère…). */
export function garantirSansFavori(actions: readonly Action[]): void {
  for (const a of actions) if (a.type !== 'suppression-etiquette') throw new Error(`Réinitialisation : action « ${a.type} » interdite.`);
}

// ───────────────────────── Volet local ─────────────────────────

/** Clés conservées telles quelles (le drapeau empêche de refusionner les amis initiaux déjà décidés). */
export const CLES_GARDEES = ['preferences', 'amisInitiaux', 'collection'] as const;

/** Préférences réduites à ce qui est gardé : thèmes aimés et amis (avec leurs thèmes). Le reste revient au défaut. */
export function preferencesGardees(p: Preferences): Preferences {
  return { version: 2, mesThemes: [...p.mesThemes], amis: p.amis.map((a) => ({ ...a, themes: [...a.themes] })) };
}

/**
 * Collection réduite aux choix de favori du joueur (Alexis, 2026-11-21 : « repartir de 0 à part les choix de favori ») :
 * seules les cartes avec un `choixFavori` (vrai ou faux) restent, vidées de tout le reste (exemplaires, étiquettes,
 * prix, note, ami, thèmes choisis). La synchro les relie de nouveau au site.
 */
export function collectionReduite(collection: Collection): Collection {
  const cartes: Carte[] = collection.cartes
    .filter((c) => (c.choixFavori ?? null) !== null)
    .map((c) => ({
      id: c.id, titre: c.titre, rarete: c.rarete, description: c.description, quantite: Math.max(1, c.quantite), url: null,
      favori: false, choixFavori: c.choixFavori, idsSite: null, etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null,
    }));
  return { ...collection, cartes };
}

export interface PlanLocal {
  /** Clés effacées, avec la taille approximative de leur contenu en octets. */
  supprimees: Array<{ cle: string; octets: number }>;
  gardees: string[];
  octetsSupprimes: number;
}

const taille = (v: unknown): number => {
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return 0;
  }
};

export function planLocal(contenu: Readonly<Record<string, unknown>>): PlanLocal {
  // La collection est réduite aux choix de favori, pas effacée : elle compte parmi les clés gardées (en version réduite).
  const gardees: string[] = [];
  const supprimees: PlanLocal['supprimees'] = [];
  for (const [cle, valeur] of Object.entries(contenu)) {
    if ((CLES_GARDEES as readonly string[]).includes(cle)) gardees.push(cle);
    else supprimees.push({ cle, octets: taille(valeur) });
  }
  supprimees.sort((a, b) => b.octets - a.octets);
  return { supprimees, gardees: gardees.sort(), octetsSupprimes: supprimees.reduce((s, x) => s + x.octets, 0) };
}

// ───────────────────────── Sauvegarde préalable ─────────────────────────

export interface SauvegardeReinit {
  format: 'wm-collection-avant-reinitialisation';
  version: 1;
  creeLe: string;
  /** Contenu complet de `chrome.storage.local` (aucun jeton ni cookie n’y est jamais stocké). */
  stockage: Record<string, unknown>;
  /** Étiquettes du compte lues sur le site : sert à les recréer à la main si besoin. */
  etiquettesSite: EtiquetteSite[] | null;
  registre: Registre;
}

export function creerSauvegardeReinit(stockage: Record<string, unknown>, etiquettesSite: EtiquetteSite[] | null, registre: Registre, maintenant: Date): SauvegardeReinit {
  return { format: 'wm-collection-avant-reinitialisation', version: 1, creeLe: maintenant.toISOString(), stockage, etiquettesSite, registre };
}

export const nomFichierSauvegardeReinit = (maintenant: Date): string => `wm-avant-reinitialisation-${maintenant.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

/** Texte à saisir pour armer chaque volet destructif. */
export const MOT_CONFIRMATION_SITE = 'SUPPRIMER LES ÉTIQUETTES';
export const MOT_CONFIRMATION_LOCAL = 'EFFACER LES DONNÉES';
