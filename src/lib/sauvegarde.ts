// Sauvegarde complète : un seul fichier pour transvaser les données saisies à la main d'un PC à l'autre.
// Logique pure, sans `chrome.*`. Liste blanche : seuls les champs ci-dessous sont écrits dans le fichier ;
// aucun secret (jeton, cookie, clé), aucun identifiant d'exemplaire du site, aucun cache ni état de synchro.
import { analyserStockage, meilleureDescription, MAX_CARTES, type Carte, type Collection } from './collection';
import { MAX_EVENEMENTS, validerEvenements, type EvenementVente } from './affluence';
import { fusionnerAmisInitiaux, MODES_ETIQUETTES, modeEtiquettes, plafondDefausse, type Ami, type ModeEtiquettes, type Preferences } from './tri';
import type { Registre } from './actions';
import { exporterEtiquettes, fusionnerImportees, lireEtiquettes, modeApresImport, synchroIciPlusRecente, type EtiquettesImportees, type EtiquettesSauvegardees } from './sauvegardeRegistre';
import { estObjet } from './valider';
import { apercuSynchro, exporterSynchro, fusionnerSynchro, lireSynchro, type ApercuSynchro, type DonneesSynchro, type SynchroSauvegardee } from './sauvegardeSynchro';

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
  'id' | 'titre' | 'rarete' | 'description' | 'quantite' | 'url' | 'favori' | 'prixCible' | 'note' | 'ami' | 'valeurMarchande' | 'choixFavori' | 'themesChoisis'
>;

export interface Sauvegarde {
  format: typeof FORMAT_SAUVEGARDE;
  version: typeof VERSION_SAUVEGARDE;
  creeLe: string;
  cartes: CarteSauvegardee[];
  preferences: Preferences;
  syncAuto: boolean;
  ventes: EvenementVente[];
  /** Mémoire de synchro (facultative : absente des fichiers plus anciens) : la synchro suivante repart de là. */
  synchro?: SynchroSauvegardee;
  /** Étiquettes posées par l'extension (facultatif : absent des fichiers plus anciens, qui restent importables). */
  etiquettes?: EtiquettesSauvegardees;
}

/** Ce que la sauvegarde couvre, tel qu'il vit dans le stockage de l'extension. */
export interface Donnees {
  collection: Collection;
  preferences: Preferences;
  syncAuto: boolean;
  ventes: EvenementVente[];
  synchro?: DonneesSynchro;
  /** Registre des étiquettes posées par l'extension (lecture seule pour la sauvegarde : jamais écrasé par un import). */
  registre?: Registre;
  /** Revendications d'étiquettes en attente d'une synchro (écrites par l'import, voir `adopterEtiquettes`). */
  importees?: EtiquettesImportees | null;
}

const garderChamps = (c: Carte): CarteSauvegardee => ({
  id: c.id,
  titre: c.titre,
  rarete: c.rarete,
  description: c.description,
  quantite: c.quantite,
  url: c.url,
  favori: c.favori,
  prixCible: c.prixCible,
  note: c.note,
  ami: c.ami,
  valeurMarchande: c.valeurMarchande,
  choixFavori: c.choixFavori ?? null,
  themesChoisis: c.themesChoisis ?? null,
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
      ...(donnees.preferences.modeEtiquettes === undefined ? {} : { modeEtiquettes: donnees.preferences.modeEtiquettes }),
    },
    syncAuto: donnees.syncAuto,
    ventes: donnees.ventes.filter((e) => e.type !== 'site').map((e) => ({ type: e.type, at: e.at })),
    ...(donnees.synchro ? { synchro: exporterSynchro(donnees.synchro) } : {}),
    ...(donnees.registre
      ? { etiquettes: exporterEtiquettes({ registre: donnees.registre, cartes: donnees.collection.cartes, derniereSynchro: donnees.synchro?.derniereSynchro ?? null, mode: donnees.preferences.modeEtiquettes }) }
      : {}),
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
  // Mode inconnu (fichier d'une version plus récente) : ignoré, le mode d'ici est gardé.
  const mode = (MODES_ETIQUETTES as readonly unknown[]).includes(brut.modeEtiquettes) ? (brut.modeEtiquettes as ModeEtiquettes) : undefined;
  return { version: 2, mesThemes: [...brut.mesThemes], amis, ...(plafond === undefined ? {} : { plafondDefausse: plafond }), ...(mode === undefined ? {} : { modeEtiquettes: mode }) };
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

  const synchro = lireSynchro(brut.synchro);
  if (typeof synchro === 'string') return non(synchro);
  const etiquettes = lireEtiquettes(brut.etiquettes);
  if (typeof etiquettes === 'string') return non(etiquettes);

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
      ...(synchro ? { synchro } : {}),
      ...(etiquettes ? { etiquettes } : {}),
    },
  };
}

const vierge = (c: Pick<Carte, 'prixCible' | 'note' | 'ami' | 'choixFavori' | 'themesChoisis'>): boolean =>
  c.prixCible === null && c.note === '' && c.ami === null && (c.choixFavori ?? null) === null && (c.themesChoisis ?? null) === null;

const memeEdition = (a: CarteSauvegardee | Carte, b: CarteSauvegardee | Carte): boolean =>
  a.prixCible === b.prixCible && a.note === b.note && a.ami === b.ami && (a.choixFavori ?? null) === (b.choixFavori ?? null) &&
  JSON.stringify(a.themesChoisis ?? null) === JSON.stringify(b.themesChoisis ?? null);

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
  /** Mémoire de synchro reprise de la sauvegarde (relevés de prix, caches), sinon `null`. */
  synchro: ApercuSynchro | null;
  /** Rapport sur les étiquettes (fichier avec part « étiquettes »), sinon `null`. */
  etiquettes: ApercuEtiquettes | null;
}

export interface ApercuEtiquettes {
  /** Étiquettes créées par l'extension, citées par le fichier. */
  noms: number;
  /** Cartes dont le fichier cite des étiquettes posées (reprises après la prochaine synchro, seulement si le site les confirme). */
  cartes: number;
  /** Retraits à la main repris du fichier ; 0 si la synchro d'ici est plus récente (ses décisions priment). */
  refusRepris: number;
  refusIgnores: number;
  /** Mode des étiquettes qu'aura ce PC après l'import ; `suspendre` = pose coupée. */
  modeFinal: ModeEtiquettes;
  modeRepris: boolean;
  syncIciPlusRecente: boolean;
  derniereSynchroIci: number | null;
  releveLeFichier: number | null;
}

const cleVente = (e: EvenementVente): string => `${e.type}|${e.at}`;
const cleAmi = (nom: string): string => nom.trim().toLowerCase();

export function apercuImport(locales: Donnees, s: Sauvegarde): Apercu {
  const parId = new Map(locales.collection.cartes.map((c) => [c.id, c]));
  const a: Apercu = { cartesNouvelles: 0, cartesCompletees: 0, cartesIdentiques: 0, cartesEnConflit: 0, themesAjoutes: 0, amisAjoutes: 0, ventesAjoutees: 0, plafondRepris: null, creeLe: s.creeLe, synchro: null, etiquettes: null };
  if (s.synchro) {
    // Valeur marchande finale de chaque carte : celle d'ici, sinon celle de la sauvegarde (comme `appliquerImport`).
    const finales = s.cartes.map((c) => ({ ...c, valeurMarchande: parId.get(c.id)?.valeurMarchande ?? c.valeurMarchande }) as Carte);
    a.synchro = apercuSynchro(locales.synchro, s.synchro, [...locales.collection.cartes, ...finales]);
  }
  if (s.etiquettes) {
    const e = s.etiquettes;
    const iciPlusRecente = synchroIciPlusRecente(locales.synchro?.derniereSynchro ?? null, e.releveLe);
    const nbRefus = Object.keys(e.refus).length;
    const modeIci = locales.preferences.modeEtiquettes;
    a.etiquettes = {
      noms: e.noms.length,
      cartes: Object.keys(e.parCarte).length,
      refusRepris: iciPlusRecente ? 0 : nbRefus,
      refusIgnores: iciPlusRecente ? nbRefus : 0,
      modeFinal: modeEtiquettes({ modeEtiquettes: modeApresImport(modeIci, e) }),
      modeRepris: modeIci === undefined && e.mode !== undefined,
      syncIciPlusRecente: iciPlusRecente,
      derniereSynchroIci: locales.synchro?.derniereSynchro ?? null,
      releveLeFichier: e.releveLe,
    };
  }
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
  // Mode des étiquettes : celui d'ici s'il a été choisi, sinon celui de la sauvegarde (sans lui, un PC neuf reste « suspendu »).
  const mode = modeApresImport(locales.modeEtiquettes, sauvees.modeEtiquettes === undefined ? undefined : { releveLe: null, mode: sauvees.modeEtiquettes, noms: [], parCarte: {}, refus: {} });
  return { ...fusion, mesThemes: [...new Set([...locales.mesThemes, ...sauvees.mesThemes])], ...(plafond === undefined ? {} : { plafondDefausse: plafond }), ...(mode === undefined ? {} : { modeEtiquettes: mode }) };
}

export type ResultatApplication = { ok: true; donnees: Donnees } | { ok: false; erreur: string };

/**
 * Fusionne la sauvegarde dans les données locales sans rien perdre :
 * - carte absente ici : ajoutée (sans identifiants ni étiquettes du site, la synchro les relie) ;
 * - carte dont l'édition ici est vierge : reçoit celle de la sauvegarde ;
 * - édition différente des deux côtés : la politique tranche (`remplacer` par défaut dans l'interface, ou `garder-ici`) ;
 * - favori, quantité, identifiants : ceux d'ici (le site fait foi) ; valeur marchande : complétée si absente ici ;
 * - réglages (thèmes, amis, plafond de défausse d'ici s'il existe) et ventes : toujours réunis, quelle que soit la politique ; la politique ne tranche que les cartes en conflit ;
 * - interrupteur de synchro auto : celui d'ici ;
 * - mémoire de synchro (prix relevés, dernière synchro, caches) : reprise, pour que la synchro suivante soit incrémentale
 *   (voir `fusionnerSynchro` : le plus récent l'emporte, un prix n'est repris que si la valeur de la carte concorde).
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
        ? { prixCible: sauvee.prixCible, note: sauvee.note, ami: sauvee.ami, choixFavori: sauvee.choixFavori ?? null, themesChoisis: sauvee.themesChoisis ?? null }
        : {}),
      valeurMarchande: valeur,
      description: meilleureDescription(locale.description, sauvee.description),
      url: locale.url ?? sauvee.url,
    });
  }
  // Prix plus frais dans le fichier (relevé ailleurs) : la valeur de la carte le suit si la valeur d'ici n'était pas une saisie à la main,
  // sinon `prixRepris` l'écarterait (valeur différente) et le prix serait redemandé au site.
  if (locales.synchro && s.synchro?.etat) {
    for (const [id, r] of Object.entries(s.synchro.etat.prix)) {
      const carte = parId.get(id);
      const ici = locales.synchro.etat?.prix[id];
      if (!carte || r.valeur === null || carte.valeurMarchande === r.valeur || (ici !== undefined && ici.releveLe >= r.releveLe)) continue;
      const releveAuto = ici === undefined ? carte.valeurMarchande === null : carte.valeurMarchande === ici.valeur;
      if (releveAuto) parId.set(id, { ...carte, valeurMarchande: r.valeur });
    }
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
      // Sans mémoire de synchro dans le fichier, rien de la synchro n'est réécrit (ni le bail exigé).
      // Étiquettes : le registre d'ici n'est jamais touché ; les revendications du fichier attendent la synchro (le site confirme).
      ...(s.etiquettes ? { importees: fusionnerImportees(locales.importees ?? null, s.etiquettes, locales.synchro?.derniereSynchro ?? null, Date.now()) } : {}),
      ...(locales.synchro && s.synchro ? { synchro: fusionnerSynchro(locales.synchro, s.synchro, [...parId.values()]) } : {}),
    },
  };
}
