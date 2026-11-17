import type { Donnees } from './sauvegarde';
import { analyserStockage, collectionVide, type Collection } from './collection';
import type { EtatExecution, EtatExecutionV2, Registre } from './actions';
import { validerJournal, type Journal } from './journal';
import { validerExecution } from './etatExecution';
import { validerStatutSynchro, type StatutSynchro, type StatutSynchroV2 } from './statutSynchro';
import { validerIgnorees, type Ignoree } from './ignorees';
import { validerHistorique, type PointHistorique } from './historique';
import { AFFICHAGE_DEFAUT, validerAffichage, type Affichage } from './affichage';
import { cacheVide, validerCache, type CacheWikipedia } from './wikipedia';
import { cacheIAVide, validerCacheIA, type CacheIA } from './classificationIA';
import { registreVide, validerRegistre } from './registre';
import { validerEtiquettesSite, type EtiquetteSite } from './etiquettesPreexistantes';
import type { EtatOrdonnanceur } from './ordonnanceur';
import { AMIS_INITIAUX, VERSION_AMIS_INITIAUX } from '../config/amis';
import { ajouterEvenement, validerEvenements, VERSION_VENTES, type EvenementVente } from './affluence';
import { fusionnerAmisInitiaux, lirePreferences, preferencesParDefaut, type Preferences } from './tri';
import { estObjet } from './valider';
import type { EtatVerrouRequete } from './verrouRequete';
import { VERSION_SUIVI, suiviVide, validerLancements, type LancementVente, type SuiviVentes } from './ventes';

const CLE = 'collection';
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
const CLE_PASSER_CARTE = 'passerCarteSynchro';
const CLE_DERNIERE_RELANCE = 'derniereRelance';
const CLE_STATUT_SYNCHRO = 'statutSynchro';
const CLE_WIKIPEDIA = 'wikipedia';
const CLE_CLASSEMENT_IA = 'classementIA';
const CLE_VENTES = 'ventes';
const CLE_AFFLUENCE_SITE = 'affluenceSite';
const MAX_RELEVES_SITE = 2000;
const CLE_RELEVE_MARCHE = 'releveMarche';
const CLE_ETIQUETTES_SITE = 'etiquettesSite';
const CLE_IGNOREES = 'ignorees';
const CLE_HISTORIQUE = 'historique';
const CLE_AFFICHAGE = 'affichage';
const CLE_SUIVI_VENTES = 'suiviVentes';
const CLE_LANCEMENTS_VENTES = 'lancementsVentes';
const CLE_RELANCE_VENTES = 'relanceVentes';
const CLE_STATUT_RELANCE = 'statutRelanceVentes';
const CLE_ECARTES_VENTES = 'ecartesVentes';
const CLE_SUIVI_ACTIF = 'suiviVentesActif';
const CLE_ETAT_SUIVI = 'etatSuiviVentes';
const CLE_SIGNAL_SUIVI = 'signalSuiviVentes';
const CLE_BAIL_SUIVI = 'bailSuiviVentes';
const CLE_VERROU_REQUETE = 'verrouRequete';

export type { StatutSynchro };

/** Version de l’enveloppe du journal stocké. */
export const VERSION_JOURNAL = 2;

/** Toutes les clés locales de l’extension. */
export const CLES_STOCKAGE = {
  collection: CLE,
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
  passerCarteSynchro: CLE_PASSER_CARTE,
  derniereRelance: CLE_DERNIERE_RELANCE,
  statutSynchro: CLE_STATUT_SYNCHRO,
  wikipedia: CLE_WIKIPEDIA,
  classementIA: CLE_CLASSEMENT_IA,
  ventes: CLE_VENTES,
  affluenceSite: CLE_AFFLUENCE_SITE,
  releveMarche: CLE_RELEVE_MARCHE,
  etiquettesSite: CLE_ETIQUETTES_SITE,
  ignorees: CLE_IGNOREES,
  historique: CLE_HISTORIQUE,
  affichage: CLE_AFFICHAGE,
  suiviVentes: CLE_SUIVI_VENTES,
  lancementsVentes: CLE_LANCEMENTS_VENTES,
  relanceVentes: CLE_RELANCE_VENTES,
  statutRelanceVentes: CLE_STATUT_RELANCE,
  ecartesVentes: CLE_ECARTES_VENTES,
  suiviVentesActif: CLE_SUIVI_ACTIF,
  etatSuiviVentes: CLE_ETAT_SUIVI,
  signalSuiviVentes: CLE_SIGNAL_SUIVI,
  bailSuiviVentes: CLE_BAIL_SUIVI,
  verrouRequete: CLE_VERROU_REQUETE,
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

/** Cache du classement par l’API Claude (titre → thèmes) : illisible vaut « vide » (il se refait, au prix d’un nouveau classement). */
export async function chargerCacheIA(): Promise<CacheIA> {
  const contenu = await chrome.storage.local.get(CLE_CLASSEMENT_IA);
  return validerCacheIA(contenu[CLE_CLASSEMENT_IA]) ?? cacheIAVide();
}

export async function enregistrerCacheIA(cache: CacheIA): Promise<void> {
  if (validerCacheIA(cache) === null) throw new Error('Cache du classement invalide.');
  await chrome.storage.local.set({ [CLE_CLASSEMENT_IA]: cache });
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

/** Demande de relance de l’interface (« Forcer la synchro ») : un horodatage, aucune autre donnée. */
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

/** Demande de passer la carte de prix en attente (bouton « Passer cette carte ») : un horodatage, aucune autre donnée. */
export async function enregistrerPasserCarteSynchro(horodatage: number): Promise<void> {
  if (!horodatageValide(horodatage)) throw new Error('Horodatage invalide.');
  await chrome.storage.local.set({ [CLE_PASSER_CARTE]: horodatage });
}

/** Ne signale que les demandes faites pendant l’écoute. */
export function ecouterPasserCarteSynchro(rappel: () => void): () => void {
  const ecouteur = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    const changement = changements[CLE_PASSER_CARTE];
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

// ---- Mise en vente : suivi, relance automatique (Alexis, 2026-11-17) ----

/** Dernier suivi lu sur le site ; absent ou illisible : suivi vide (sans rien écraser). */
export async function chargerSuiviVentes(): Promise<SuiviVentes> {
  const contenu = await chrome.storage.local.get(CLE_SUIVI_VENTES);
  const brut = contenu[CLE_SUIVI_VENTES];
  if (!estObjet(brut) || brut.version !== VERSION_SUIVI || !Array.isArray(brut.actives) || !Array.isArray(brut.terminees)) return suiviVide();
  const suivi = brut as unknown as SuiviVentes;
  const nonVentes: Record<string, number> = {};
  if (estObjet(suivi.nonVentes)) for (const [t, n] of Object.entries(suivi.nonVentes)) if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n < 1000) nonVentes[t] = n;
  const finsVues = Array.isArray(suivi.finsVues) ? suivi.finsVues.filter((i): i is string => typeof i === 'string').slice(0, 200) : undefined;
  return { ...suivi, nonVentes, finsVues };
}

export async function enregistrerSuiviVentes(suivi: SuiviVentes): Promise<void> {
  await chrome.storage.local.set({ [CLE_SUIVI_VENTES]: suivi });
}

export const ecouterSuiviVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_SUIVI_VENTES, rappel);

/** Journal des lancements automatiques (100 au plus, les plus récents gardés). */
export async function chargerLancementsVentes(): Promise<LancementVente[]> {
  const contenu = await chrome.storage.local.get(CLE_LANCEMENTS_VENTES);
  return validerLancements(contenu[CLE_LANCEMENTS_VENTES]);
}

export async function ajouterLancementVente(lancement: LancementVente): Promise<void> {
  const actuels = await chargerLancementsVentes();
  await chrome.storage.local.set({ [CLE_LANCEMENTS_VENTES]: validerLancements([...actuels, lancement]) });
}

export const ecouterLancementsVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_LANCEMENTS_VENTES, rappel);

/** Interrupteur de la relance automatique : désactivé par défaut, seule la valeur `true` l’active. */
export async function chargerRelanceVentes(): Promise<boolean> {
  const contenu = await chrome.storage.local.get(CLE_RELANCE_VENTES);
  return contenu[CLE_RELANCE_VENTES] === true;
}

export async function enregistrerRelanceVentes(actif: boolean): Promise<void> {
  if (typeof actif !== 'boolean') throw new Error('Réglage de relance invalide.');
  await chrome.storage.local.set({ [CLE_RELANCE_VENTES]: actif });
}

export const ecouterRelanceVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_RELANCE_VENTES, rappel);

/** État affiché de la relance automatique et du suivi (libellés fixes, jamais un corps de réponse). */
export interface StatutRelanceVentes {
  /** `lecture` : suivi en cours ; `attente` : relance prête ; `pause` : attente jusqu’à `jusqua` (jamais d’arrêt automatique). */
  etat: 'lecture' | 'attente' | 'pause'
  message: string
  jusqua: number | null
  /** Échecs de lecture de suite (attente 5 s, +5 s à chaque échec). */
  echecs: number
  maj: number
  /** Carte en échec depuis plusieurs essais : avertissement avec choix « Passer cette carte » ou « Continuer d’attendre ». */
  carte?: { titre: string; idExemplaire: string; essais: number } | null
}

export async function chargerStatutRelanceVentes(): Promise<StatutRelanceVentes | null> {
  const contenu = await chrome.storage.local.get(CLE_STATUT_RELANCE);
  const b = contenu[CLE_STATUT_RELANCE];
  if (!estObjet(b) || typeof b.message !== 'string' || !['lecture', 'attente', 'pause'].includes(String(b.etat))) return null;
  if (!nullOuHorodatage(b.jusqua) || !horodatageValide(b.maj) || !horodatageValide(b.echecs)) return null;
  const c = b.carte;
  const carte = estObjet(c) && typeof c.titre === 'string' && typeof c.idExemplaire === 'string' && horodatageValide(c.essais) ? { titre: c.titre.slice(0, 200), idExemplaire: c.idExemplaire.slice(0, 80), essais: c.essais } : null;
  return { etat: b.etat as StatutRelanceVentes['etat'], message: b.message.slice(0, 300), jusqua: b.jusqua, echecs: b.echecs, maj: b.maj, carte };
}

export async function enregistrerStatutRelanceVentes(statut: StatutRelanceVentes): Promise<void> {
  await chrome.storage.local.set({ [CLE_STATUT_RELANCE]: { ...statut, message: statut.message.slice(0, 300) } });
}

export const ecouterStatutRelanceVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_STATUT_RELANCE, rappel);

/** Exemplaires écartés après un refus : identifiant → date avant laquelle on ne les retente pas. */
export async function chargerEcartesVentes(): Promise<Record<string, number>> {
  const contenu = await chrome.storage.local.get(CLE_ECARTES_VENTES);
  const b = contenu[CLE_ECARTES_VENTES];
  if (!estObjet(b)) return {};
  const sortie: Record<string, number> = {};
  // Les 1 000 entrées les plus récentes (échéance la plus lointaine) : un écart récent n’est jamais jeté.
  for (const [id, t] of Object.entries(b).filter(([, v]) => horodatageValide(v)).sort((x, y) => (y[1] as number) - (x[1] as number)).slice(0, 1000)) sortie[id] = t as number;
  return sortie;
}

export const ecouterEcartesVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_ECARTES_VENTES, rappel);

export async function enregistrerEcartesVentes(ecartes: Record<string, number>): Promise<void> {
  await chrome.storage.local.set({ [CLE_ECARTES_VENTES]: ecartes });
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

// ---- Synchro autonome du suivi des ventes en cours (Alexis, 2026-11-17) ----
// Minuteur, état, bail, interrupteur et signal « Forcer » propres : aucune dépendance à la synchro globale.

/** Interrupteur du suivi : activé par défaut (comme la synchro), seule la valeur `false` le coupe. */
export async function chargerSuiviVentesActif(): Promise<boolean> {
  const contenu = await chrome.storage.local.get(CLE_SUIVI_ACTIF);
  const valeur = contenu[CLE_SUIVI_ACTIF];
  return valeur === undefined || valeur === true;
}

export async function enregistrerSuiviVentesActif(actif: boolean): Promise<void> {
  if (typeof actif !== 'boolean') throw new Error('Réglage du suivi invalide.');
  await chrome.storage.local.set({ [CLE_SUIVI_ACTIF]: actif });
}

export const ecouterSuiviVentesActif = (rappel: () => void): (() => void) => ecouterCle(CLE_SUIVI_ACTIF, rappel);

/** État affiché du suivi (santé) : dernier passage, dernier succès, attente éventuelle. Libellés fixes. */
export interface EtatSuiviVentes {
  /** `ok` : à jour ; `attente` : nouvel essai après un échec ; `pause` : 401/429, pause de 30 min ; `inactif` : interrupteur coupé. */
  etat: 'ok' | 'attente' | 'pause' | 'inactif';
  message: string;
  /** Fin de l’attente ou de la pause en cours. */
  jusqua: number | null;
  /** Échecs de lecture de suite (attente 5 s, +5 s à chaque échec). */
  echecs: number;
  /** Dernière tentative de lecture (réussie ou non). */
  dernierPassage: number | null;
  /** Dernière lecture réussie. */
  dernierSucces: number | null;
  /** Dernier « Forcer » pris en compte (une demande par minute au plus, commune aux onglets). */
  forceLe: number | null;
}

export const ETAT_SUIVI_INITIAL: EtatSuiviVentes = { etat: 'ok', message: 'Suivi en attente du premier passage.', jusqua: null, echecs: 0, dernierPassage: null, dernierSucces: null, forceLe: null };

export async function chargerEtatSuiviVentes(): Promise<EtatSuiviVentes | null> {
  const contenu = await chrome.storage.local.get(CLE_ETAT_SUIVI);
  const b = contenu[CLE_ETAT_SUIVI];
  if (!estObjet(b) || typeof b.message !== 'string' || !['ok', 'attente', 'pause', 'inactif'].includes(String(b.etat))) return null;
  if (!nullOuHorodatage(b.jusqua) || !horodatageValide(b.echecs) || !nullOuHorodatage(b.dernierPassage) || !nullOuHorodatage(b.dernierSucces)) return null;
  const forceLe = nullOuHorodatage(b.forceLe) ? b.forceLe : null;
  return { etat: b.etat as EtatSuiviVentes['etat'], message: b.message.slice(0, 300), jusqua: b.jusqua, echecs: b.echecs, dernierPassage: b.dernierPassage, dernierSucces: b.dernierSucces, forceLe };
}

export async function enregistrerEtatSuiviVentes(etat: EtatSuiviVentes): Promise<void> {
  await chrome.storage.local.set({ [CLE_ETAT_SUIVI]: { ...etat, message: etat.message.slice(0, 300) } });
}

export const ecouterEtatSuiviVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_ETAT_SUIVI, rappel);

/** Signal du bouton « Forcer » du suivi : un horodatage, simple déclencheur (illisible = pas de signal). */
export async function enregistrerSignalSuiviVentes(horodatage: number): Promise<void> {
  await chrome.storage.local.set({ [CLE_SIGNAL_SUIVI]: horodatage });
}

export const ecouterSignalSuiviVentes = (rappel: () => void): (() => void) => ecouterCle(CLE_SIGNAL_SUIVI, rappel);

/** Bail propre du suivi : un seul passage à la fois entre onglets, sans rapport avec le bail de la synchro globale. */
export const chargerBailSuivi = (): Promise<number | null> => chargerHorodatage(CLE_BAIL_SUIVI);
export const enregistrerBailSuivi = (expiration: number | null): Promise<void> => enregistrerHorodatage(CLE_BAIL_SUIVI, expiration);

/** Verrou de requête (une seule requête en vol vers le site, toutes fonctions confondues) : voir `verrouRequete.ts`. */
export async function chargerVerrouRequete(): Promise<EtatVerrouRequete | null> {
  const contenu = await chrome.storage.local.get(CLE_VERROU_REQUETE);
  const b = contenu[CLE_VERROU_REQUETE];
  if (!estObjet(b) || !(b.proprio === null || typeof b.proprio === 'string') || !horodatageValide(b.jusqua) || !horodatageValide(b.derniere)) return null;
  return { proprio: b.proprio === null ? null : b.proprio.slice(0, 64), jusqua: b.jusqua, derniere: b.derniere };
}

export async function enregistrerVerrouRequete(etat: EtatVerrouRequete): Promise<void> {
  await chrome.storage.local.set({ [CLE_VERROU_REQUETE]: etat });
}
