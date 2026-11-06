import { analyserImport, collectionVide, fusionnerImport, type Collection } from './collection';

const CLE = 'collection';

export async function chargerCollection(): Promise<Collection> {
  const contenu = await chrome.storage.local.get(CLE);
  const brut: unknown = contenu[CLE];
  if (brut === undefined) return collectionVide();

  const resultat = analyserImport(brut);
  // On échoue sans écraser : les données restent récupérables.
  if (!resultat.ok) throw new Error(`Données stockées illisibles. ${resultat.erreur}`);
  return fusionnerImport(collectionVide(), resultat.cartes);
}

export async function enregistrerCollection(collection: Collection): Promise<void> {
  await chrome.storage.local.set({ [CLE]: collection });
}
