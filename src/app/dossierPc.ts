// Accès au dossier partagé de la synchro entre PC (File System Access API) : seul fichier de l'application qui le touche.
// Aucun réseau : on lit et écrit des fichiers locaux que Google Drive pour ordinateur (ou un équivalent) recopie d'un PC à l'autre.
import { FICHIER_TROP_GROS, nomPcDeFichier, TAILLE_MAX_FICHIER_PC, nomFichierPc, type FichierPc } from '../lib/synchroPc';

export type Dossier = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
};

const BASE = 'wm-synchro-pc';
const MAGASIN = 'kv';
const CLE = 'dossier';

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB indisponible'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (m: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await ouvrirBase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const requete = action(base.transaction(MAGASIN, mode).objectStore(MAGASIN));
      requete.onsuccess = () => resolve(requete.result);
      requete.onerror = () => reject(requete.error ?? new Error('IndexedDB : échec'));
    });
  } finally {
    base.close();
  }
}

export const synchroPcDisponible = (): boolean => typeof indexedDB !== 'undefined' && 'showDirectoryPicker' in window;

/** Le joueur choisit le dossier (geste obligatoire). `null` seulement s'il ferme la fenêtre : toute autre erreur remonte avec son nom. */
export async function choisirDossier(): Promise<{ dossier: Dossier | null; erreurMemoire: string | null }> {
  let choisi: Dossier;
  try {
    choisi = await (window as unknown as { showDirectoryPicker(o: { mode: 'readwrite'; id: string }): Promise<Dossier> }).showDirectoryPicker({ mode: 'readwrite', id: 'wm-synchro-pc' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { dossier: null, erreurMemoire: null };
    throw e;
  }
  // Une erreur de mémorisation (IndexedDB) ne doit jamais passer pour une annulation : le dossier sert pour cette session.
  try {
    await transaction('readwrite', (m) => m.put(choisi, CLE));
    return { dossier: choisi, erreurMemoire: null };
  } catch (e) {
    return { dossier: choisi, erreurMemoire: e instanceof Error ? `${e.name} : ${e.message}` : 'erreur inconnue' };
  }
}

export async function chargerDossier(): Promise<Dossier | null> {
  return ((await transaction('readonly', (m) => m.get(CLE))) as Dossier | undefined) ?? null;
}

export async function oublierDossier(): Promise<void> {
  await transaction('readwrite', (m) => m.delete(CLE));
}

/** État de l'autorisation ; `demander` exige un geste du joueur (clic). */
export async function autorisation(dossier: Dossier, demander: boolean): Promise<PermissionState> {
  const etat = await dossier.queryPermission({ mode: 'readwrite' });
  return etat === 'granted' || !demander ? etat : dossier.requestPermission({ mode: 'readwrite' });
}

/** Fichiers `wm-sync-<pc>.json` du dossier (les autres fichiers, temporaires ou copies de conflit, sont ignorés). */
export async function listerFichiersPc(dossier: Dossier): Promise<FichierPc[]> {
  const fichiers: FichierPc[] = [];
  const entrees = (dossier as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const e of entrees) {
    const nom = nomPcDeFichier(e.name);
    if (e.kind !== 'file' || nom === null) continue;
    const fichier = await (e as FileSystemFileHandle).getFile();
    // Un fichier trop gros n'est pas lu : la fusion le signale.
    fichiers.push({ nom, texte: fichier.size > TAILLE_MAX_FICHIER_PC ? FICHIER_TROP_GROS : await fichier.text() });
  }
  return fichiers;
}

/** Remplace le fichier de ce PC. `createWritable` écrit dans un fichier temporaire et ne remplace l'original qu'à la fermeture. */
export async function ecrireFichierPc(dossier: Dossier, nomPc: string, texte: string): Promise<void> {
  const poignee = await dossier.getFileHandle(nomFichierPc(nomPc), { create: true });
  const flux = await poignee.createWritable();
  try {
    await flux.write(texte);
    await flux.close();
  } catch (e) {
    await flux.abort().catch(() => undefined);
    throw e;
  }
}

/** Supprime le fichier d'un ancien nom de ce PC (après un renommage), pour ne pas laisser de PC fantôme. */
export async function supprimerFichierPc(dossier: Dossier, nomPc: string): Promise<void> {
  await dossier.removeEntry(nomFichierPc(nomPc)).catch(() => undefined);
}
