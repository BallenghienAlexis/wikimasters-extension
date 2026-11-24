// Reprise des étiquettes citées par une sauvegarde importée (Alexis, 2026-11-24). Aucune requête : seules la liste d'étiquettes
// du site et les étiquettes lues sur chaque carte, déjà en stockage, servent de preuve (`adopterEtiquettes`).
import type { Registre } from '../lib/actions';
import { adopterEtiquettes } from '../lib/sauvegardeRegistre';
import {
  chargerCollection,
  chargerDerniereSynchro,
  chargerEtiquettesImportees,
  chargerEtiquettesSite,
  chargerRegistre,
  enregistrerEtiquettesImportees,
  enregistrerRegistre,
} from '../lib/stockage';

/**
 * Reprend dans le registre ce que le site confirme parmi les revendications d'un import, puis les oublie une fois qu'une synchro
 * postérieure à l'import les a vues. Rend le registre à jour, ou `null` s'il n'y avait rien à reprendre.
 */
export async function adopterEtiquettesImportees(): Promise<Registre | null> {
  const importees = await chargerEtiquettesImportees();
  if (importees === null) return null;
  const [registre, collection, site, derniereSynchro] = await Promise.all([chargerRegistre(), chargerCollection(), chargerEtiquettesSite(), chargerDerniereSynchro()]);
  const bilan = adopterEtiquettes(registre, importees, collection.cartes, site);
  if (bilan.registre !== registre) await enregistrerRegistre(bilan.registre);
  // Une synchro postérieure à l'import a relu les cartes et la liste du site : les revendications ont servi.
  if (site !== null && site.length > 0 && derniereSynchro !== null && derniereSynchro > importees.importeLe) await enregistrerEtiquettesImportees(null);
  return bilan.registre !== registre ? bilan.registre : null;
}
