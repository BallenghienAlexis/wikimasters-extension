import type { Carte, Collection } from './collection';

const COLONNES: (keyof Carte)[] = ['id', 'titre', 'rarete', 'quantite', 'statut', 'prixCible', 'note', 'url'];
const SEPARATEUR = ';';
const BOM = String.fromCharCode(0xfeff);

function celluleCsv(valeur: Carte[keyof Carte]): string {
  let texte = valeur === null ? '' : String(valeur);
  // Un tableur exécuterait une cellule commençant par l'un de ces caractères comme une formule.
  if (typeof valeur === 'string' && /^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return /[";\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

// Séparateur « ; » et BOM : Excel en français ouvre ainsi le fichier correctement.
export function versCsv(cartes: Carte[]): string {
  const lignes = cartes.map((carte) => COLONNES.map((colonne) => celluleCsv(carte[colonne])).join(SEPARATEUR));
  return `${BOM}${[COLONNES.join(SEPARATEUR), ...lignes].join('\r\n')}\r\n`;
}

export const versJson = (collection: Collection): string => `${JSON.stringify(collection, null, 2)}\n`;
