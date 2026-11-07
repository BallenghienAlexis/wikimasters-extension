import { analyserStockage,appliquerEdition, collectionVide, fusionnerImport, type CarteImportee, type Collection } from './collection';
import type { EtatExecution, Registre } from './actions';
import { validerJournal, type Journal } from './journal';
import { registreVide, validerRegistre } from './registre';
import { lireSynchro, noterPage, type Pagination, type Synchro } from './synchro';
import { lirePreferences, proposerTri, type Preferences } from './tri';

const CLE = 'collection';
const CLE_SYNCHRO = 'synchro';
const CLE_PREFERENCES = 'preferences';
const CLE_REGISTRE = 'registre';
const CLE_JOURNAL = 'journal';
const CLE_EXECUTION = 'execution';
const CLE_SIGNAL = 'signalSynchro';

/** Version de l’enveloppe du journal stocké. */
export const VERSION_JOURNAL = 1;

/** Toutes les clés locales de l’extension. */
export const CLES_STOCKAGE = {
  collection: CLE,
  synchro: CLE_SYNCHRO,
  preferences: CLE_PREFERENCES,
  registre: CLE_REGISTRE,
  journal: CLE_JOURNAL,
  execution: CLE_EXECUTION,
  signalSynchro: CLE_SIGNAL,
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

export async function chargerPreferences(): Promise<Preferences> {
  const contenu = await chrome.storage.local.get(CLE_PREFERENCES);
  return lirePreferences(contenu[CLE_PREFERENCES]);
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
