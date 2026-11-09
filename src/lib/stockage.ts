import { analyserStockage,appliquerEdition, collectionVide, fusionnerImport, type CarteImportee, type Collection } from './collection';
import type { EtatExecution, Registre } from './actions';
import { validerJournal, type Journal } from './journal';
import { registreVide, validerRegistre } from './registre';
import { lireSynchro, noterPage, type Pagination, type Synchro } from './synchro';
import type { EtatOrdonnanceur } from './ordonnanceur';
import { AMIS_INITIAUX, VERSION_AMIS_INITIAUX } from '../config/amis';
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

/** Version de l’enveloppe du journal stocké. */
export const VERSION_JOURNAL = 1;

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
} as const;

function illisible(detail: string): Error {
  return new Error(`Données stockées illisibles. ${detail}`);
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
  if (enveloppe.version !== VERSION_JOURNAL) throw illisible('La version du journal est inconnue.');
  const journal = validerJournal(enveloppe.entrees);
  if (journal === null) throw illisible('Le journal est invalide.');
  return journal;
}

export async function enregistrerJournal(journal: Journal): Promise<void> {
  await chrome.storage.local.set({ [CLE_JOURNAL]: { version: VERSION_JOURNAL, entrees: journal } });
}

const ETATS_EXECUTION: readonly string[] = ['en-cours', 'terminee', 'arretee'];

const entierPositif = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function validerExecution(brut: unknown): EtatExecution | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.idLot !== 'string' || o.idLot === '') return null;
  if (typeof o.etat !== 'string' || !ETATS_EXECUTION.includes(o.etat)) return null;
  if (!entierPositif(o.traitees) || !entierPositif(o.total) || o.traitees > o.total) return null;
  return { version: 1, idLot: o.idLot, etat: o.etat as EtatExecution['etat'], traitees: o.traitees, total: o.total };
}

export async function chargerExecution(): Promise<EtatExecution | null> {
  const contenu = await chrome.storage.local.get(CLE_EXECUTION);
  const brut = contenu[CLE_EXECUTION];
  if (brut === undefined) return null;
  const etat = validerExecution(brut);
  if (etat === null) throw illisible('L’état d’exécution est invalide.');
  return etat;
}

export async function enregistrerExecution(etat: EtatExecution): Promise<void> {
  await chrome.storage.local.set({ [CLE_EXECUTION]: etat });
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

/** Synchronisation automatique : désactivée par défaut, toute valeur illisible vaut « désactivée ». */
export async function chargerSyncAuto(): Promise<boolean> {
  const contenu = await chrome.storage.local.get(CLE_SYNC_AUTO);
  return contenu[CLE_SYNC_AUTO] === true;
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

function lireContenu(brut: unknown): Collection {
  if (brut === undefined) return collectionVide();

  const resultat = analyserStockage(brut);
  // On échoue sans écraser : les données restent récupérables.
  if (!resultat.ok) throw new Error(`Données stockées illisibles. ${resultat.erreur}`);
  return resultat.collection;
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
export async function fusionnerDansStockage(cartes: CarteImportee[]): Promise<Collection> {
  const avant = await chargerCollection();
  const apres = fusionnerImport(avant, cartes);
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
