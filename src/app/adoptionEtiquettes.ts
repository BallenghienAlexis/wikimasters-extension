// Reprise des étiquettes citées par une sauvegarde importée (Alexis, 2026-11-24). Aucune requête : seules la liste d'étiquettes
// du site et les étiquettes lues sur chaque carte, déjà en stockage, servent de preuve (`adopterEtiquettes`).
import type { Registre } from '../lib/actions';
import type { EtiquetteSite } from '../lib/etiquettesPreexistantes';
import { categorieEtiquette } from '../lib/reinitialisation';
import { adopterEtiquettes } from '../lib/sauvegardeRegistre';
import { LIBELLES_THEMES } from '../lib/themes';
import {
  chargerCollection,
  chargerDerniereSynchro,
  chargerEtiquettesImportees,
  chargerEtiquettesSite,
  chargerExecution,
  chargerRegistre,
  enregistrerEtiquettesImportees,
  enregistrerRegistre,
} from '../lib/stockage';

/**
 * Reprend dans le registre ce que le site confirme parmi les revendications d'un import, puis les oublie une fois qu'une synchro
 * postérieure à l'import les a vues. Rend le registre à jour, ou `null` s'il n'y avait rien à reprendre.
 */
export async function adopterEtiquettesImportees(siteFrais?: EtiquetteSite[]): Promise<Registre | null> {
  const importees = await chargerEtiquettesImportees();
  if (importees === null) return null;
  // Hors d'un lot : jamais pendant une exécution (le lot réécrit le registre après chaque action).
  if (siteFrais === undefined && (await chargerExecution().catch(() => null))?.etat === 'en-cours') return null;
  const [registre, collection, siteStocke, derniereSynchro] = await Promise.all([chargerRegistre(), chargerCollection(), chargerEtiquettesSite(), chargerDerniereSynchro()]);
  // Avant un lot, seule la liste relue juste avant sert de preuve (une liste vide n'en est pas une).
  const site = siteFrais ?? siteStocke;
  const libelles: ReadonlySet<string> = new Set(Object.values(LIBELLES_THEMES));
  // Seuls les noms que l'extension peut créer sont repris : une étiquette posée à la main ne devient jamais « de l'extension ».
  const bilan = adopterEtiquettes(registre, importees, collection.cartes, site, (nom) => categorieEtiquette(nom, libelles, registre) !== 'autre');
  if (bilan.registre !== registre) await enregistrerRegistre(bilan.registre);
  // Une synchro postérieure à l'import a relu les cartes et la liste du site : les revendications ont servi.
  if (site !== null && site.length > 0 && derniereSynchro !== null && derniereSynchro > importees.importeLe) await enregistrerEtiquettesImportees(null);
  return bilan.registre !== registre ? bilan.registre : null;
}
