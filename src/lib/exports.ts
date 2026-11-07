import { VERSION_ECHANGE, type Carte, type Collection } from './collection';
import { LIBELLES_THEMES, themesDeCarte } from './themes';

type ColonneCarte = Exclude<keyof Carte, 'idsSite'>;
const COLONNES: ColonneCarte[] = ['id', 'titre', 'rarete', 'quantite', 'statut', 'prixCible', 'note', 'url', 'favori', 'description', 'ami', 'valeurMarchande'];
const SEPARATEUR = ';';
const BOM = String.fromCharCode(0xfeff);

function celluleCsv(valeur: Carte[ColonneCarte]): string {
  let texte = valeur === null ? '' : String(valeur);
  // Un tableur exécuterait une cellule commençant par l'un de ces caractères comme une formule.
  if (typeof valeur === 'string' && /^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return /[";\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

// Séparateur « ; » et BOM : Excel en français ouvre ainsi le fichier correctement.
export function versCsv(cartes: Carte[]): string {
  const lignes = cartes.map((carte) =>
    [...COLONNES.map((colonne) => celluleCsv(carte[colonne])), celluleCsv(themesDeCarte(carte).map((id) => LIBELLES_THEMES[id]).join(', '))].join(SEPARATEUR),
  );
  return `${BOM}${[[...COLONNES, 'themes'].join(SEPARATEUR), ...lignes].join('\r\n')}\r\n`;
}

// Fichier d’échange : version 1, sans les identifiants du site.
export const versJson = (collection: Collection): string => {
  const cartes = collection.cartes.map((carte) => {
    const reste: Partial<Carte> = { ...carte };
    delete reste.idsSite;
    return reste;
  });
  return `${JSON.stringify({ version: VERSION_ECHANGE, cartes }, null, 2)}\n`;
};
