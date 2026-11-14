import type { Donnees } from './sauvegarde';
import { analyserStockage,appliquerEdition, collectionVide, fusionnerCartesLues, type CarteLueSite, type Collection } from './collection';
import type { EtatExecution, EtatExecutionV2, Registre } from './actions';
import { validerJournal, type Journal } from './journal';
import { validerExecution } from './etatExecution';
import { validerStatutSynchro, type StatutSynchro, type StatutSynchroV2 } from './statutSynchro';
import { validerIgnorees, type Ignoree } from './ignorees';
import { validerHistorique, type PointHistorique } from './historique';
import { AFFICHAGE_DEFAUT, validerAffichage, type Affichage } from './affichage';
import { cacheVide, validerCache, type CacheWikipedia } from './wikipedia';
import { registreVide, validerRegistre } from './registre';
import { validerEtiquettesSite, type EtiquetteSite } from './etiquettesPreexistantes';
import { lireSynchro, noterPage, type Pagination, type Synchro } from './synchro';
import type { EtatOrdonnanceur } from './ordonnanceur';
import { AMIS_INITIAUX, VERSION_AMIS_INITIAUX } from '../config/amis';
import { ajouterEvenement, validerEvenements, VERSION_VENTES, type EvenementVente } from './affluence';
import { fusionnerAmisInitiaux, lirePreferences, preferencesParDefaut, proposerTri, type Preferences } from './tri';

const CLE = 'collection';
const CLE_SYNCHRO = 'synchro';
const CLE_PREFERENCES = 'preferences';
const CLE_AMIS_INITIAUX = 'amisInitiaux';
const CLE_REGISTRE = 'registre';
const CLE_JOURNAL = 'journal';
const CLE_EXECUTION = 'execution';
const CLE_SIGNAL = 'signalSynchro';
const CLE_SYNC_AUTO = 'syncAuto';
const CLE_DERNIERE_SYNCHRO = 'derniereSynchro';
const CLE_BAIL_SYNCHRO = 'bailSynchro';
const CLE_ETAT_SYNCHRO = 'etatSynchro';
const CLE_ARRET_SYNCHRO = 'arretSynchro';
const CLE_RELANCE_SYNCHRO = 'relanceSynchro';
const CLE_DERNIERE_RELANCE = 'derniereRelance';
const CLE_STATUT_SYNCHRO = 'statutSynchro';
const CLE_WIKIPEDIA = 'wikipedia';
const CLE_VENTES = 'ventes';
const CLE_AFFLUENCE_SITE = 'affluenceSite';
const MAX_RELEVES_SITE = 2000;
const CLE_RELEVE_MARCHE = 'releveMarche';
const CLE_ETIQUETTES_SITE = 'etiquettesSite';
const CLE_IGNOREES = 'ignorees';
const CLE_HISTORIQUE = 'historique';
const CLE_AFFICHAGE = 'affichage';

export type { StatutSynchro };

/** Version de l’enveloppe du journal stocké. */
export const VERSION_JOURNAL = 2;

/** Toutes les clés locales de l’extension. */
export const CLES_STOCKAGE = {
  collection: CLE,
  synchro: CLE_SYNCHRO,
  preferences: CLE_PREFERENCES,
  amisInitiaux: CLE_AMIS_INITIAUX,
  registre: CLE_REGISTRE,
  journal: CLE_JOURNAL,
  execution: CLE_EXECUTION,
  signalSynchro: CLE_SIGNAL,
  syncAuto: CLE_SYNC_AUTO,
  derniereSynchro: CLE_DERNIERE_SYNCHRO,
  bailSynchro: CLE_BAIL_SYNCHRO,
  etatSynchro: CLE_ETAT_SYNCHRO,
  arretSynchro: CLE_ARRET_SYNCHRO,
  relanceSynchro: CLE_RELANCE_SYNCHRO,
  derniereRelance: CLE_DERNIERE_RELANCE,
  statutSynchro: CLE_STATUT_SYNCHRO,
  wikipedia: CLE_WIKIPEDIA,
  ventes: CLE_VENTES,
  affluenceSite: CLE_AFFLUENCE_SITE,
  releveMarche: CLE_RELEVE_MARCHE,
  etiquettesSite: CLE_ETIQUETTES_SITE,
  ignorees: CLE_IGNOREES,
  historique: CLE_HISTORIQUE,
  affichage: CLE_AFFICHAGE,
} as const;

function illisible(detail: string): Error {
  return new Error(`Données stockées illisibles. ${detail}`);
}

/** Étiquettes du compte lues sur le site (identifiant, nom, nombre de cartes) ; illisible ou absent : `null`. */
export async function chargerEtiquettesSite(): Promise<EtiquetteSite[] | null> {
  const contenu = await chrome.storage.local.get(CLE_ETIQUETTES_SITE);
  return validerEtiquettesSite(contenu[CLE_ETIQUETTES_SITE]);
}

export async function enregistrerEtiquettesSite(liste: EtiquetteSite[]): Promise<void> {
  if (validerEtiquettesSite(liste) === null) throw new Error('Liste d’étiquettes invalide.');
  await chrome.storage.local.set({ [CLE_ETIQUETTES_SITE]: liste });
}

export function ecouterEtiquettesSite(rappel: () => void): () => void {
  const ecouteur = (changes: Record<string, unknown>, zone: string): void => {
    if (zone === 'local' && CLE_ETIQUETTES_SITE in changes) rappel();
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

/** Cache des catégories Wikipédia : un cache illisible vaut « vide » (il se reconstruit, rien d'irremplaçable). */
export async function chargerCacheWikipedia(): Promise<CacheWikipedia> {
  const contenu = await chrome.storage.local.get(CLE_WIKIPEDIA);
  return validerCache(contenu[CLE_WIKIPEDIA]) ?? cacheVide();
}

export async function enregistrerCacheWikipedia(cache: CacheWikipedia): Promise<void> {
  if (validerCache(cache) === null) throw new Error('Cache Wikipédia invalide.');
  await chrome.storage.local.set({ [CLE_WIKIPEDIA]: cache });
}

export async function chargerRegistre(): Promise<Registre> {
  const contenu = await chrome.storage.local.get(CLE_REGISTRE);
  const brut = contenu[CLE_REGISTRE];
  if (brut === undefined) return registreVide();
  const registre = validerRegistre(brut);
  if (registre === null) throw illisible('Le registre des étiquettes est invalide.');
  return registre;
}

export async function enregistrerRegistre(registre: Registre): Promise<void> {
  await chrome.storage.local.set({ [CLE_REGISTRE]: registre });
}

export async function chargerJournal(): Promise<Journal> {
  const contenu = await chrome.storage.local.get(CLE_JOURNAL);
  const brut = contenu[CLE_JOURNAL];
  if (brut === undefined) return [];
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    throw illisible('Le journal est invalide.');
  }
  const enveloppe = brut as Record<string, unknown>;
  // Une enveloppe v1 est lue (entrées complétées à null) ; elle est réécrite en v2 à la prochaine écriture.
  if (enveloppe.version !== VERSION_JOURNAL && enveloppe.version !== 1) throw illisible('La version du journal est inconnue.');
  const journal = validerJournal(enveloppe.entrees);
  if (journal === null) throw illisible('Le journal est invalide.');
  return journal;
}

export async function enregistrerJournal(journal: Journal): Promise<void> {
  await chrome.storage.local.set({ [CLE_JOURNAL]: { version: VERSION_JOURNAL, entrees: journal } });
}

export async function chargerExecution(): Promise<EtatExecutionV2 | null> {
  const contenu = await chrome.storage.local.get(CLE_EXECUTION);
  const brut = contenu[CLE_EXECUTION];
  if (brut === undefined) return null;
  const etat = validerExecution(brut);
  if (etat === null) throw illisible('L’état d’exécution est invalide.');
  return etat;
}

/** Accepte une v1 ou une v2 ; écrit toujours une v2. */
export async function enregistrerExecution(etat: EtatExecution | EtatExecutionV2): Promise<void> {
  const valide = validerExecution(etat);
  if (valide === null) throw new Error('État d’exécution invalide.');
  await chrome.storage.local.set({ [CLE_EXECUTION]: valide });
}

export async function effacerExecution(): Promise<void> {
  await chrome.storage.local.remove(CLE_EXECUTION);
}

export async function chargerSignalSynchro(): Promise<number | null> {
  const contenu = await chrome.storage.local.get(CLE_SIGNAL);
  const brut = contenu[CLE_SIGNAL];
  // Le signal n’est qu’un déclencheur : une valeur illisible vaut « pas de signal », sans erreur.
  return typeof brut === 'number' && Number.isFinite(brut) ? brut : null;
}

export async function enregistrerSignalSynchro(horodatage: number): Promise<void> {
  await chrome.storage.local.set({ [CLE_SIGNAL]: horodatage });
}

const horodatageValide = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Synchronisation automatique : activée par défaut (décision d’Alexis du 2026-11-11) ; valeur absente = activée, toute valeur illisible = désactivée. */
export async function chargerSyncAuto(): Promise<boolean> {
  const contenu = await chrome.storage.local.get(CLE_SYNC_AUTO);
  // Absente : activée (décision d’Alexis) ; présente mais autre que `true` : désactivée.
  const valeur = contenu[CLE_SYNC_AUTO];
  return valeur === undefined || valeur === true;
}

export async function enregistrerSyncAuto(actif: boolean): Promise<void> {
  if (typeof actif !== 'boolean') throw new Error('Préférence de synchronisation invalide.');
  await chrome.storage.local.set({ [CLE_SYNC_AUTO]: actif });
}

async function chargerHorodatage(cle: string): Promise<number | null> {
  const contenu = await chrome.storage.local.get(cle);
  const brut = contenu[cle];
  return horodatageValide(brut) ? brut : null;
}

async function enregistrerHorodatage(cle: string, valeur: number | null): Promise<void> {
  if (valeur === null) {
    await chrome.storage.local.remove(cle);
    return;
  }
  if (!horodatageValide(valeur)) throw new Error('Horodatage invalide.');
  await chrome.storage.local.set({ [cle]: valeur });
}

/** Horodatage (ms) de la dernière synchronisation terminée, ou `null`. */
export const chargerDerniereSynchro = (): Promise<number | null> => chargerHorodatage(CLE_DERNIERE_SYNCHRO);
export const enregistrerDerniereSynchro = (horodatage: number | null): Promise<void> => enregistrerHorodatage(CLE_DERNIERE_SYNCHRO, horodatage);

/** Horodatage (ms) de la dernière relance exécutée, commun aux onglets (limite d’une relance par minute). */
export const chargerDerniereRelance = (): Promise<number | null> => chargerHorodatage(CLE_DERNIERE_RELANCE);
export const enregistrerDerniereRelance = (horodatage: number): Promise<void> => enregistrerHorodatage(CLE_DERNIERE_RELANCE, horodatage);

/** Horodatage (ms) d’expiration du bail qui empêche deux synchronisations simultanées, ou `null`. */
export const chargerBailSynchro = (): Promise<number | null> => chargerHorodatage(CLE_BAIL_SYNCHRO);
export const enregistrerBailSynchro = (expiration: number | null): Promise<void> => enregistrerHorodatage(CLE_BAIL_SYNCHRO, expiration);

const MAX_ENTREES_ETAT = 100_000;
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nullOuHorodatage = (v: unknown): v is number | null => v === null || horodatageValide(v);
const nullOuEntier = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0);

function validerEtatSynchro(brut: unknown): EtatOrdonnanceur | null {
  if (!estObjet(brut) || brut.version !== 1) return null;
  const { total, totalUnique, signatureEtiquettes, derniereComplete, arretJusqua, requetes, cardIds, prix } = brut;
  if (!nullOuEntier(total) || !nullOuEntier(totalUnique)) return null;
  if (signatureEtiquettes !== null && typeof signatureEtiquettes !== 'string') return null;
  if (!nullOuHorodatage(derniereComplete) || !nullOuHorodatage(arretJusqua)) return null;
  if (!Array.isArray(requetes) || requetes.length > MAX_ENTREES_ETAT || !requetes.every(horodatageValide)) return null;
  if (!estObjet(cardIds) || Object.keys(cardIds).length > MAX_ENTREES_ETAT) return null;
  if (!Object.values(cardIds).every((v) => typeof v === 'string')) return null;
  if (!estObjet(prix) || Object.keys(prix).length > MAX_ENTREES_ETAT) return null;
  const releves: EtatOrdonnanceur['prix'] = {};
  for (const [id, r] of Object.entries(prix)) {
    if (!estObjet(r) || !nullOuEntier(r.valeur) || !horodatageValide(r.releveLe)) return null;
    releves[id] = { valeur: r.valeur, releveLe: r.releveLe };
  }
  const vs = brut.ventesSite;
  const ventesSite =
    estObjet(vs) && horodatageValide(vs.enCours) && horodatageValide(vs.max) && horodatageValide(vs.releveLe)
      ? { enCours: vs.enCours, max: vs.max, releveLe: vs.releveLe }
      : null;
  return {
    version: 1,
    total,
    totalUnique,
    signatureEtiquettes,
    derniereComplete,
    arretJusqua,
    requetes: [...requetes],
    cardIds: { ...(cardIds as Record<string, string>) },
    prix: releves,
    ...(ventesSite === null ? {} : { ventesSite }),
  };
}

/** État de l’ordonnanceur (aucun secret) ; `null` si jamais écrit, erreur s’il est illisible. */
export async function chargerEtatSynchro(): Promise<EtatOrdonnanceur | null> {
  const contenu = await chrome.storage.local.get(CLE_ETAT_SYNCHRO);
  const brut = contenu[CLE_ETAT_SYNCHRO];
  if (brut === undefined) return null;
  const etat = validerEtatSynchro(brut);
  if (etat === null) throw illisible('L’état de la synchronisation est invalide.');
  return etat;
}

export async function enregistrerEtatSynchro(etat: EtatOrdonnanceur): Promise<void> {
  if (validerEtatSynchro(etat) === null) throw new Error('État de synchronisation invalide.');
  await chrome.storage.local.set({ [CLE_ETAT_SYNCHRO]: etat });
}

/** Demande d’arrêt de l’interface : un horodatage, aucune autre donnée. */
export async function enregistrerArretSynchro(horodatage: number): Promise<void> {
  if (!horodatageValide(horodatage)) throw new Error('Horodatage invalide.');
  await chrome.storage.local.set({ [CLE_ARRET_SYNCHRO]: horodatage });
}

/** Ne signale que les demandes faites pendant l’écoute (une ancienne demande ne bloque rien). */
export function ecouterArretSynchro(rappel: () => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    const changement = changements[CLE_ARRET_SYNCHRO];
    if (zone === 'local' && changement && horodatageValide(changement.newValue)) rappel();
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

/** Demande de relance de l’interface (« Relancer la synchro ») : un horodatage, aucune autre donnée. */
export async function enregistrerRelanceSynchro(horodatage: number): Promise<void> {
  if (!horodatageValide(horodatage)) throw new Error('Horodatage invalide.');
  await chrome.storage.local.set({ [CLE_RELANCE_SYNCHRO]: horodatage });
}

/** Ne signale que les demandes faites pendant l’écoute (une ancienne demande ne relance rien). */
export function ecouterRelanceSynchro(rappel: () => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    const changement = changements[CLE_RELANCE_SYNCHRO];
    if (zone === 'local' && changement && horodatageValide(changement.newValue)) rappel();
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

/** `null` si jamais écrit ou illisible : l’interface retombe alors sur l’état sans détail. */
export async function chargerStatutSynchro(): Promise<StatutSynchroV2 | null> {
  const contenu = await chrome.storage.local.get(CLE_STATUT_SYNCHRO);
  return validerStatutSynchro(contenu[CLE_STATUT_SYNCHRO]);
}

export async function enregistrerStatutSynchro(statut: StatutSynchro): Promise<void> {
  const valide = validerStatutSynchro(statut);
  if (valide === null) throw new Error('Statut de synchronisation invalide.');
  await chrome.storage.local.set({ [CLE_STATUT_SYNCHRO]: valide });
}

/** Prévient quand la clé change dans la zone locale (sans lire la valeur). */
function ecouterCle(cle: string, rappel: () => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    if (zone === 'local' && cle in changements) rappel();
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

export const ecouterExecution = (rappel: () => void): (() => void) => ecouterCle(CLE_EXECUTION, rappel);
export const ecouterJournal = (rappel: () => void): (() => void) => ecouterCle(CLE_JOURNAL, rappel);
export const ecouterIgnorees = (rappel: () => void): (() => void) => ecouterCle(CLE_IGNOREES, rappel);
export const ecouterHistorique = (rappel: () => void): (() => void) => ecouterCle(CLE_HISTORIQUE, rappel);
export const ecouterAffichage = (rappel: () => void): (() => void) => ecouterCle(CLE_AFFICHAGE, rappel);

/** Actions ignorées jusqu’à la prochaine synchro ; absentes ou illisibles : liste vide (sans rien écraser). */
export async function chargerIgnorees(): Promise<Ignoree[]> {
  const contenu = await chrome.storage.local.get(CLE_IGNOREES);
  return validerIgnorees(contenu[CLE_IGNOREES]) ?? [];
}

/** Refuse d’écrire par-dessus une clé présente mais illisible (version inconnue) : elle n’est jamais écrasée (retouche T-303). */
export async function enregistrerIgnorees(liste: Ignoree[]): Promise<void> {
  const present = (await chrome.storage.local.get(CLE_IGNOREES))[CLE_IGNOREES];
  if (present !== undefined && validerIgnorees(present) === null) throw illisible('La liste des actions ignorées est illisible : elle n’est pas modifiée.');
  const entrees = validerIgnorees({ version: 1, entrees: liste });
  if (entrees === null) throw new Error('Liste d’actions ignorées invalide.');
  await chrome.storage.local.set({ [CLE_IGNOREES]: { version: 1, entrees } });
}

/** Historique quotidien des exemplaires ; absent ou illisible : liste vide (sans rien écraser). */
export async function chargerHistorique(): Promise<PointHistorique[]> {
  const contenu = await chrome.storage.local.get(CLE_HISTORIQUE);
  return validerHistorique(contenu[CLE_HISTORIQUE]) ?? [];
}

/** Refuse d’écrire par-dessus une clé présente mais illisible (version inconnue) : elle n’est jamais écrasée (retouche T-308). */
export async function enregistrerHistorique(points: PointHistorique[]): Promise<void> {
  const present = (await chrome.storage.local.get(CLE_HISTORIQUE))[CLE_HISTORIQUE];
  if (present !== undefined && validerHistorique(present) === null) throw illisible('L’historique est illisible : il n’est pas modifié.');
  const valides = validerHistorique({ version: 1, points });
  if (valides === null) throw new Error('Historique invalide.');
  await chrome.storage.local.set({ [CLE_HISTORIQUE]: { version: 1, points: valides } });
}

/** Préférence d’affichage ; absente ou illisible : défaut (animations activées), sans rien écraser. */
export async function chargerAffichage(): Promise<Affichage> {
  const contenu = await chrome.storage.local.get(CLE_AFFICHAGE);
  return validerAffichage(contenu[CLE_AFFICHAGE]) ?? { ...AFFICHAGE_DEFAUT };
}

export async function enregistrerAffichage(affichage: Affichage): Promise<void> {
  const valide = validerAffichage(affichage);
  if (valide === null) throw new Error('Préférence d’affichage invalide.');
  await chrome.storage.local.set({ [CLE_AFFICHAGE]: valide });
}

const CLES_SYNCHRO_AUTO = [CLE_SYNC_AUTO, CLE_STATUT_SYNCHRO, CLE_BAIL_SYNCHRO, CLE_DERNIERE_SYNCHRO];

/** Prévient la page de gestion dès que l’option, le statut, le bail ou la date de synchro change. */
export function ecouterSynchroAuto(rappel: () => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    if (zone === 'local' && CLES_SYNCHRO_AUTO.some((cle) => cle in changements)) rappel();
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

function lireContenu(brut: unknown): Collection {
  if (brut === undefined) return collectionVide();

  const resultat = analyserStockage(brut);
  // On échoue sans écraser : les données restent récupérables.
  if (!resultat.ok) throw new Error(`Données stockées illisibles. ${resultat.erreur}`);
  return resultat.collection;
}

/** Contenu brut de la collection, sans validation : sert à sauvegarder des données illisibles avant tout effacement. */
export async function lireCollectionBrute(): Promise<unknown> {
  const contenu = await chrome.storage.local.get(CLE);
  return contenu[CLE];
}

/** Efface la seule collection (jamais les préférences, le registre ni le journal). */
export async function reinitialiserCollection(): Promise<void> {
  await chrome.storage.local.remove(CLE);
}

export async function chargerCollection(): Promise<Collection> {
  const contenu = await chrome.storage.local.get(CLE);
  return lireContenu(contenu[CLE]);
}

export async function enregistrerCollection(collection: Collection): Promise<void> {
  await chrome.storage.local.set({ [CLE]: collection });
}

/**
 * Préférences stockées, avec les amis initiaux de `src/config/amis.ts` fusionnés une seule fois par version
 * (drapeau `amisInitiaux`). Des préférences illisibles ne sont ni fusionnées ni écrasées. Si l'écriture
 * échoue, les préférences fusionnées sont rendues quand même et le drapeau n'est pas posé.
 */
export async function chargerPreferences(): Promise<Preferences> {
  const contenu = await chrome.storage.local.get([CLE_PREFERENCES, CLE_AMIS_INITIAUX]);
  const brut = contenu[CLE_PREFERENCES];
  const lues = lirePreferences(brut);
  const illisible = brut !== undefined && JSON.stringify(lues) !== JSON.stringify(brut) && JSON.stringify(lues) === JSON.stringify(preferencesParDefaut());
  if (illisible) return lues;
  const version = contenu[CLE_AMIS_INITIAUX];
  if (typeof version === 'number' && version >= VERSION_AMIS_INITIAUX) return lues;
  const fusionnees = fusionnerAmisInitiaux(lues, AMIS_INITIAUX);
  try {
    await chrome.storage.local.set({ [CLE_PREFERENCES]: fusionnees, [CLE_AMIS_INITIAUX]: VERSION_AMIS_INITIAUX });
  } catch {
    /* le drapeau n'est pas posé : la fusion sera retentée au prochain chargement */
  }
  return fusionnees;
}

export async function enregistrerPreferences(preferences: Preferences): Promise<void> {
  await chrome.storage.local.set({ [CLE_PREFERENCES]: preferences });
}

// N'écrit que si la lecture apporte du nouveau.
export async function fusionnerDansStockage(cartes: CarteLueSite[]): Promise<Collection> {
  const avant = await chargerCollection();
  const apres = fusionnerCartesLues(avant, cartes);
  if (JSON.stringify(apres) !== JSON.stringify(avant)) await enregistrerCollection(apres);
  return apres;
}

// Une carte triée par l'assistant est reclassée dès que sa valeur est connue.
export async function enregistrerValeur(id: string, valeurMarchande: number): Promise<void> {
  const collection = await chargerCollection();
  const carte = collection.cartes.find((c) => c.id === id);
  if (!carte || carte.valeurMarchande === valeurMarchande) return;
  const avecValeur = { ...carte, valeurMarchande };
  const edition = carte.decidePar === 'assistant' ? proposerTri(avecValeur, await chargerPreferences()) : {};
  await enregistrerCollection(appliquerEdition(collection, id, { valeurMarchande, ...edition }));
}

export async function chargerSynchro(): Promise<Synchro | null> {
  const contenu = await chrome.storage.local.get(CLE_SYNCHRO);
  return lireSynchro(contenu[CLE_SYNCHRO]);
}

export async function enregistrerPage(cle: string, pagination: Pagination): Promise<Synchro> {
  const avant = await chargerSynchro();
  const apres = noterPage(avant, cle, pagination);
  if (JSON.stringify(apres) !== JSON.stringify(avant)) await chrome.storage.local.set({ [CLE_SYNCHRO]: apres });
  return apres;
}

export function ecouterSynchro(rappel: (synchro: Synchro | null) => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    const changement = changements[CLE_SYNCHRO];
    if (zone === 'local' && changement) rappel(lireSynchro(changement.newValue));
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

export function ecouterCollection(rappel: (collection: Collection) => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    const changement = changements[CLE];
    if (zone !== 'local' || !changement) return;
    try {
      rappel(lireContenu(changement.newValue));
    } catch {
      // Contenu illisible : on garde l'état affiché.
    }
  };
  chrome.storage.onChanged.addListener(ecouteur);
  return () => chrome.storage.onChanged.removeListener(ecouteur);
}

/** Évènements de vente notés par le joueur (locaux, sans donnée du site). Valeur illisible : liste vide. */
export async function chargerVentes(): Promise<EvenementVente[]> {
  const contenu = await chrome.storage.local.get(CLE_VENTES);
  const brut = contenu[CLE_VENTES];
  if (typeof brut !== 'object' || brut === null || (brut as { version?: unknown }).version !== VERSION_VENTES) return [];
  return validerEvenements((brut as { evenements?: unknown }).evenements).filter((e) => e.type !== 'site');
}

// Les écritures sont chaînées : deux clics rapprochés ne doivent pas perdre un évènement.
let fileVentes: Promise<unknown> = Promise.resolve();

export function noterEvenementVente(e: EvenementVente): Promise<EvenementVente[]> {
  const tache = fileVentes.then(async () => {
    const suite = ajouterEvenement(await chargerVentes(), e);
    await chrome.storage.local.set({ [CLE_VENTES]: { version: VERSION_VENTES, evenements: suite } });
    return suite;
  });
  fileVentes = tache.catch(() => undefined);
  return tache;
}

/** Horodatages d’annonces du marché relevés sur le site (aucune autre donnée). Valeur illisible : liste vide. */
export async function chargerAffluenceSite(): Promise<EvenementVente[]> {
  const contenu = await chrome.storage.local.get(CLE_AFFLUENCE_SITE);
  const brut = contenu[CLE_AFFLUENCE_SITE];
  if (typeof brut !== 'object' || brut === null || (brut as { version?: unknown }).version !== VERSION_VENTES) return [];
  return validerEvenements((brut as { evenements?: unknown }).evenements, MAX_RELEVES_SITE).filter((e) => e.type === 'site');
}

let fileAffluence: Promise<unknown> = Promise.resolve();

/** Ajoute les horodatages nouveaux (sans doublon), en gardant les plus récents ; écritures chaînées. */
export function noterAffluenceSite(horodatages: readonly number[]): Promise<EvenementVente[]> {
  const tache = fileAffluence.then(async () => {
    const actuels = await chargerAffluenceSite();
    const connus = new Set(actuels.map((e) => e.at));
    const nouveaux = [...new Set(horodatages)].filter((t) => !connus.has(t)).map((at): EvenementVente => ({ type: 'site', at }));
    const suite = [...actuels, ...nouveaux].sort((a, b) => a.at - b.at).slice(-MAX_RELEVES_SITE);
    await chrome.storage.local.set({ [CLE_AFFLUENCE_SITE]: { version: VERSION_VENTES, evenements: suite } });
    return suite;
  });
  fileAffluence = tache.catch(() => undefined);
  return tache;
}

/** Dernier relevé du marché (horodatage) et nombre d’échecs consécutifs, communs aux onglets. */
export interface ReleveMarche {
  le: number | null;
  echecs: number;
}

export async function chargerReleveMarche(): Promise<ReleveMarche> {
  const contenu = await chrome.storage.local.get(CLE_RELEVE_MARCHE);
  const brut = contenu[CLE_RELEVE_MARCHE];
  if (typeof brut !== 'object' || brut === null) return { le: null, echecs: 0 };
  const { le, echecs } = brut as { le?: unknown; echecs?: unknown };
  return { le: horodatageValide(le) ? le : null, echecs: typeof echecs === 'number' && Number.isInteger(echecs) && echecs >= 0 && echecs <= 100 ? echecs : 0 };
}

export async function enregistrerReleveMarche(releve: ReleveMarche): Promise<void> {
  if (releve.le !== null && !horodatageValide(releve.le)) throw new Error('Horodatage invalide.');
  await chrome.storage.local.set({ [CLE_RELEVE_MARCHE]: { le: releve.le, echecs: Math.min(100, Math.max(0, Math.trunc(releve.echecs))) } });
}

/** Remplace le journal des ventes du joueur (écritures chaînées avec `noterEvenementVente`). */
export function enregistrerVentes(evenements: EvenementVente[]): Promise<void> {
  const tache = fileVentes.then(() => chrome.storage.local.set({ [CLE_VENTES]: { version: VERSION_VENTES, evenements: validerEvenements(evenements).filter((e) => e.type !== 'site') } }));
  fileVentes = tache.catch(() => undefined);
  return tache;
}

/** Lit ce que couvre la sauvegarde complète (voir `sauvegarde.ts`) ; une donnée illisible fait échouer la lecture. */
export async function lireDonneesSauvegarde(): Promise<Donnees> {
  const [collection, preferences, syncAuto, ventes] = await Promise.all([chargerCollection(), chargerPreferences(), chargerSyncAuto(), chargerVentes()]);
  return { collection, preferences, syncAuto, ventes };
}

/** Écrit les données fusionnées. La collection d’abord : en cas d’échec, rien d’autre n’a bougé. */
export async function ecrireDonneesSauvegarde(donnees: Donnees): Promise<void> {
  await enregistrerCollection(donnees.collection);
  await enregistrerPreferences(donnees.preferences);
  await enregistrerVentes(donnees.ventes);
  await enregistrerSyncAuto(donnees.syncAuto);
}
