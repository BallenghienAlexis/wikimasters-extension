// Sauvegarde complète : un seul fichier pour transvaser les données saisies à la main d'un PC à l'autre.
// Logique pure, sans `chrome.*`. Liste blanche : seuls les champs ci-dessous sont écrits dans le fichier ;
// aucun secret (jeton, cookie, clé), aucun identifiant d'exemplaire du site, aucun cache ni état de synchro.
import { analyserStockage, meilleureDescription, MAX_CARTES, type Carte, type Collection, type DecidePar, type Statut } from './collection';
import { MAX_EVENEMENTS, validerEvenements, type EvenementVente } from './affluence';
import { fusionnerAmisInitiaux, plafondDefausse, type Ami, type Preferences } from './tri';

export const FORMAT_SAUVEGARDE = 'wm-collection-sauvegarde';
export const VERSION_SAUVEGARDE = 1;
/** Taille maximale d'un fichier de sauvegarde accepté (octets). */
export const TAILLE_MAX_SAUVEGARDE = 20 * 1024 * 1024;
const MAX_THEMES = 200;
const MAX_AMIS = 200;
const MAX_TEXTE = 100;

export type PolitiqueConflit = 'garder-ici' | 'remplacer';

/** Champs d'une carte conservés dans la sauvegarde. */
export type CarteSauvegardee = Pick<
  Carte,
  'id' | 'titre' | 'rarete' | 'description' | 'quantite' | 'url' | 'favori' | 'statut' | 'prixCible' | 'note' | 'ami' | 'valeurMarchande' | 'decidePar'
>;

export interface Sauvegarde {
  format: typeof FORMAT_SAUVEGARDE;
  version: typeof VERSION_SAUVEGARDE;
  creeLe: string;
  cartes: CarteSauvegardee[];
  preferences: Preferences;
  syncAuto: boolean;
  ventes: EvenementVente[];
}

/** Ce que la sauvegarde couvre, tel qu'il vit dans le stockage de l'extension. */
export interface Donnees {
  collection: Collection;
  preferences: Preferences;
  syncAuto: boolean;
  ventes: EvenementVente[];
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const garderChamps = (c: Carte): CarteSauvegardee => ({
  id: c.id,
  titre: c.titre,
  rarete: c.rarete,
  description: c.description,
  quantite: c.quantite,
  url: c.url,
  favori: c.favori,
  statut: c.statut,
  prixCible: c.prixCible,
  note: c.note,
  ami: c.ami,
  valeurMarchande: c.valeurMarchande,
  decidePar: c.decidePar,
});

export function creerSauvegarde(donnees: Donnees, maintenant: Date): Sauvegarde {
  return {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    creeLe: maintenant.toISOString(),
    cartes: donnees.collection.cartes.map(garderChamps),
    preferences: {
      version: 2,
      mesThemes: [...donnees.preferences.mesThemes],
      amis: donnees.preferences.amis.map((a) => ({ nom: a.nom, themes: [...a.themes] })),
      ...(donnees.preferences.plafondDefausse === undefined ? {} : { plafondDefausse: donnees.preferences.plafondDefausse }),
    },
    syncAuto: donnees.syncAuto,
    ventes: donnees.ventes.filter((e) => e.type !== 'site').map((e) => ({ type: e.type, at: e.at })),
  };
}

export const serialiserSauvegarde = (s: Sauvegarde): string => `${JSON.stringify(s, null, 2)}\n`;

export const nomFichierSauvegarde = (maintenant: Date): string => `wm-sauvegarde-${maintenant.toISOString().slice(0, 10)}.json`;

const listeTextes = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= MAX_THEMES && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= MAX_TEXTE);

function lirePrefs(brut: unknown): Preferences | string {
  if (!estObjet(brut) || brut.version !== 2) return 'Les réglages de l’assistant sont invalides.';
  if (!listeTextes(brut.mesThemes)) return 'Les thèmes de l’assistant sont invalides.';
  if (!Array.isArray(brut.amis) || brut.amis.length > MAX_AMIS) return 'La liste d’amis est invalide.';
  const amis: Ami[] = [];
  for (const a of brut.amis) {
    if (!estObjet(a) || typeof a.nom !== 'string' || a.nom.trim() === '' || a.nom.length > MAX_TEXTE || !listeTextes(a.themes)) {
      return 'Un ami de la sauvegarde est invalide.';
    }
    amis.push({ nom: a.nom, themes: [...a.themes] });
  }
  const plafond = brut.plafondDefausse;
  if (plafond !== undefined && (typeof plafond !== 'number' || plafondDefausse({ plafondDefausse: plafond }) !== plafond)) {
    return 'Le plafond de défausse est invalide.';
  }
  return { version: 2, mesThemes: [...brut.mesThemes], amis, ...(plafond === undefined ? {} : { plafondDefausse: plafond }) };
}

export type ResultatLecture = { ok: true; sauvegarde: Sauvegarde } | { ok: false; erreur: string };

/** Valide strictement le texte d'un fichier : rien n'est appliqué ici, une erreur dit quoi corriger. */
export function lireSauvegarde(texte: string): ResultatLecture {
  const non = (erreur: string): ResultatLecture => ({ ok: false, erreur });
  if (texte.length > TAILLE_MAX_SAUVEGARDE) return non('Fichier trop volumineux (20 Mo au plus).');
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return non('Ce fichier n’est pas un JSON lisible.');
  }
  if (!estObjet(brut) || brut.format !== FORMAT_SAUVEGARDE) return non('Ce fichier n’est pas une sauvegarde WM Collection.');
  if (brut.version !== VERSION_SAUVEGARDE) {
    return non(
      typeof brut.version === 'number' && brut.version > VERSION_SAUVEGARDE
        ? 'Cette sauvegarde vient d’une version plus récente de l’extension : mettez-la à jour avant de l’importer.'
        : 'Version de sauvegarde inconnue.',
    );
  }
  if (typeof brut.creeLe !== 'string' || Number.isNaN(Date.parse(brut.creeLe))) return non('La date de création de la sauvegarde est invalide.');
  if (!Array.isArray(brut.cartes) || brut.cartes.length > MAX_CARTES) return non(`La liste des cartes est absente ou trop longue (maximum : ${MAX_CARTES}).`);

  // Même validation que le stockage (v1 : sans identifiants du site) ; une erreur désigne la carte fautive.
  const analyse = analyserStockage({ version: 1, cartes: brut.cartes });
  if (!analyse.ok) return non(analyse.erreur);
  const prefs = lirePrefs(brut.preferences);
  if (typeof prefs === 'string') return non(prefs);
  if (typeof brut.syncAuto !== 'boolean') return non('Le réglage de synchronisation est invalide.');
  if (!Array.isArray(brut.ventes) || brut.ventes.length > MAX_EVENEMENTS) return non('Le journal des ventes est invalide.');
  const ventes = validerEvenements(brut.ventes, MAX_EVENEMENTS);
  if (ventes.length !== brut.ventes.length || ventes.some((e) => e.type === 'site')) return non('Le journal des ventes contient une entrée invalide.');

  return {
    ok: true,
    sauvegarde: {
      format: FORMAT_SAUVEGARDE,
      version: VERSION_SAUVEGARDE,
      creeLe: brut.creeLe,
      cartes: analyse.collection.cartes.map(garderChamps),
      preferences: prefs,
      syncAuto: brut.syncAuto,
      ventes,
    },
  };
}

const vierge = (c: Pick<Carte, 'statut' | 'prixCible' | 'note' | 'ami' | 'decidePar'>): boolean =>
  c.statut === 'a-trier' && c.prixCible === null && c.note === '' && c.ami === null && c.decidePar === null;

const memeEdition = (a: CarteSauvegardee | Carte, b: CarteSauvegardee | Carte): boolean =>
  a.statut === b.statut && a.prixCible === b.prixCible && a.note === b.note && a.ami === b.ami && a.decidePar === b.decidePar;

type Classe = 'nouvelle' | 'identique' | 'completee' | 'conflit';

function classer(locale: Carte | undefined, sauvee: CarteSauvegardee): Classe {
  if (!locale) return 'nouvelle';
  if (memeEdition(locale, sauvee)) return 'identique';
  return vierge(locale) ? 'completee' : 'conflit';
}

export interface Apercu {
  cartesNouvelles: number;
  cartesCompletees: number;
  cartesIdentiques: number;
  cartesEnConflit: number;
  themesAjoutes: number;
  amisAjoutes: number;
  ventesAjoutees: number;
  /** Plafond de défausse repris de la sauvegarde (absent ici), sinon `null`. */
  plafondRepris: number | null;
  creeLe: string;
}

const cleVente = (e: EvenementVente): string => `${e.type}|${e.at}`;
const cleAmi = (nom: string): string => nom.trim().toLowerCase();

export function apercuImport(locales: Donnees, s: Sauvegarde): Apercu {
  const parId = new Map(locales.collection.cartes.map((c) => [c.id, c]));
  const a: Apercu = { cartesNouvelles: 0, cartesCompletees: 0, cartesIdentiques: 0, cartesEnConflit: 0, themesAjoutes: 0, amisAjoutes: 0, ventesAjoutees: 0, plafondRepris: null, creeLe: s.creeLe };
  for (const c of s.cartes) {
    const k = classer(parId.get(c.id), c);
    if (k === 'nouvelle') a.cartesNouvelles += 1;
    else if (k === 'completee') a.cartesCompletees += 1;
    else if (k === 'conflit') a.cartesEnConflit += 1;
    else a.cartesIdentiques += 1;
  }
  const fusion = fusionnerPreferences(locales.preferences, s.preferences);
  a.themesAjoutes = fusion.mesThemes.length - locales.preferences.mesThemes.length;
  const dejaAmis = new Set(locales.preferences.amis.map((x) => cleAmi(x.nom)));
  a.amisAjoutes = s.preferences.amis.filter((x) => !dejaAmis.has(cleAmi(x.nom))).length;
  a.plafondRepris = locales.preferences.plafondDefausse === undefined ? s.preferences.plafondDefausse ?? null : null;
  const connues = new Set(locales.ventes.map(cleVente));
  a.ventesAjoutees = new Set(s.ventes.map(cleVente).filter((k) => !connues.has(k))).size;
  return a;
}

function fusionnerPreferences(locales: Preferences, sauvees: Preferences): Preferences {
  const fusion = fusionnerAmisInitiaux(locales, sauvees.amis);
  const plafond = locales.plafondDefausse ?? sauvees.plafondDefausse;
  return { ...fusion, mesThemes: [...new Set([...locales.mesThemes, ...sauvees.mesThemes])], ...(plafond === undefined ? {} : { plafondDefausse: plafond }) };
}

export type ResultatApplication = { ok: true; donnees: Donnees } | { ok: false; erreur: string };

/**
 * Fusionne la sauvegarde dans les données locales sans rien perdre :
 * - carte absente ici : ajoutée (sans identifiants ni étiquettes du site, la synchro les relie) ;
 * - carte dont l'édition ici est vierge : reçoit celle de la sauvegarde ;
 * - édition différente des deux côtés : la politique tranche (`garder-ici` par défaut, ou `remplacer`) ;
 * - favori, quantité, identifiants : ceux d'ici (le site fait foi) ; valeur marchande : complétée si absente ici ;
 * - réglages (thèmes, amis, plafond de défausse d'ici s'il existe) et ventes : toujours réunis, quelle que soit la politique ; la politique ne tranche que les cartes en conflit ;
 * - interrupteur de synchro auto : celui d'ici.
 */
export function appliquerImport(locales: Donnees, s: Sauvegarde, politique: PolitiqueConflit): ResultatApplication {
  const remplacer = politique === 'remplacer';
  const parId = new Map(locales.collection.cartes.map((c) => [c.id, c]));
  for (const sauvee of s.cartes) {
    const locale = parId.get(sauvee.id);
    if (!locale) {
      parId.set(sauvee.id, { ...sauvee, idsSite: null, etiquettesSite: [] });
      continue;
    }
    const k = classer(locale, sauvee);
    const prendEdition = k === 'completee' || (k === 'conflit' && remplacer);
    // La valeur d'ici prime toujours : elle fixe le plafond de défausse, irréversible ; la synchro la tient à jour.
    const valeur = locale.valeurMarchande ?? sauvee.valeurMarchande;
    parId.set(sauvee.id, {
      ...locale,
      ...(prendEdition
        ? { statut: sauvee.statut as Statut, prixCible: sauvee.prixCible, note: sauvee.note, ami: sauvee.ami, decidePar: sauvee.decidePar as DecidePar }
        : {}),
      valeurMarchande: valeur,
      description: meilleureDescription(locale.description, sauvee.description),
      url: locale.url ?? sauvee.url,
    });
  }
  if (parId.size > MAX_CARTES) return { ok: false, erreur: `La collection dépasserait ${MAX_CARTES} cartes.` };

  const preferences = fusionnerPreferences(locales.preferences, s.preferences);
  const ventes = new Map<string, EvenementVente>();
  for (const e of [...locales.ventes, ...s.ventes]) ventes.set(cleVente(e), e);
  const ventesFusionnees = [...ventes.values()].sort((a, b) => a.at - b.at).slice(-MAX_EVENEMENTS);
  return {
    ok: true,
    donnees: {
      collection: { ...locales.collection, cartes: [...parId.values()] },
      preferences,
      syncAuto: locales.syncAuto,
      ventes: ventesFusionnees,
    },
  };
}
