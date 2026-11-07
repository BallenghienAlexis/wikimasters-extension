import { analyserImport, appliquerEdition, collectionVide, fusionnerImport, type CarteImportee, type Collection } from './collection';
import { lireSynchro, noterPage, type Pagination, type Synchro } from './synchro';
import { lirePreferences, proposerTri, type Preferences } from './tri';

const CLE = 'collection';
const CLE_SYNCHRO = 'synchro';
const CLE_PREFERENCES = 'preferences';

function lireContenu(brut: unknown): Collection {
  if (brut === undefined) return collectionVide();

  const resultat = analyserImport(brut);
  // On échoue sans écraser : les données restent récupérables.
  if (!resultat.ok) throw new Error(`Données stockées illisibles. ${resultat.erreur}`);
  return fusionnerImport(collectionVide(), resultat.cartes);
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
