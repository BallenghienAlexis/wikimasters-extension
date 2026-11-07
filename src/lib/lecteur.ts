// Lecture des cartes affichées sur /collection. Lit le texte de la page, sans jamais agir dessus.
import type { CarteImportee } from './collection';
import { analyserPagination, type Pagination } from './synchro';

const RARETES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
const MAX_TITRE = 300;
const STATISTIQUE = /^[\d\s]+$/;
const MAX_DESCRIPTION = 1000;

export const identifiantCarte = (rarete: string, titre: string): string => `${rarete}|${titre}`;

export interface CarteAffichee {
  rarete: string;
  titre: string;
  description: string;
  favori: boolean;
}

// Une carte affiche : rareté, titre, description éventuelle, puis deux statistiques.
// Toute autre forme est ignorée : si le site change, on ne lit rien plutôt que du faux.
export function analyserTexteCarte(texte: string, libelleFavori: string): CarteAffichee | null {
  const lignes = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);
  if (lignes.length < 4 || lignes.length > 5) return null;

  const [rarete, titre] = lignes;
  if (!rarete || !titre || !RARETES.includes(rarete) || titre.length > MAX_TITRE) return null;
  if (!lignes.slice(-2).every((ligne) => STATISTIQUE.test(ligne))) return null;
  const description = lignes.length === 5 ? (lignes[2] ?? '').slice(0, MAX_DESCRIPTION) : '';
  return { rarete, titre, description, favori: libelleFavori.startsWith('Retirer') };
}

// Une carte présente plusieurs fois sur la page compte comme autant d'exemplaires.
export function regrouperCartes(cartes: CarteAffichee[]): CarteImportee[] {
  const parId = new Map<string, CarteImportee>();
  for (const { rarete, titre, description, favori } of cartes) {
    const id = identifiantCarte(rarete, titre);
    const existante = parId.get(id);
    if (existante) existante.quantite += 1;
    else parId.set(id, { id, titre, rarete, description, quantite: 1, url: null, favori });
  }
  return [...parId.values()];
}

export interface ValeurLue {
  id: string;
  valeur: number;
}

// La fenêtre « Mettre aux enchères » affiche la moyenne du marché de la carte.
export function analyserFenetreEnchere(texte: string): ValeurLue | null {
  const lignes = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);
  const rarete = lignes[lignes.findIndex((l) => l.startsWith('Enchères actives')) + 1];
  const titre = lignes[lignes.findIndex((l) => /^marché(\s|$)/i.test(l)) - 1];
  const moyenne = lignes.findIndex((l) => /^moyenne$/i.test(l));
  const texteValeur = moyenne === -1 ? undefined : lignes[moyenne + 1];
  if (!rarete || !RARETES.includes(rarete) || !titre || !texteValeur || !STATISTIQUE.test(texteValeur)) return null;
  const valeur = Number(texteValeur.replace(/\s/g, ''));
  return Number.isSafeInteger(valeur) ? { id: identifiantCarte(rarete, titre), valeur } : null;
}

export function lireFenetreEnchere(racine: ParentNode): ValeurLue | null {
  const etiquette = [...racine.querySelectorAll<HTMLElement>('body *')].find(
    (el) => el.children.length === 0 && /^moyenne$/i.test(el.textContent?.trim() ?? ''),
  );
  let boite: HTMLElement | null | undefined = etiquette;
  while (boite && !boite.innerText.includes('Enchères actives')) boite = boite.parentElement;
  return boite ? analyserFenetreEnchere(boite.innerText) : null;
}

export function empreinte(texte: string): string {
  let h = 5381;
  for (const c of texte) h = ((h * 33) ^ c.codePointAt(0)!) >>> 0;
  return texte === '' ? '' : h.toString(36);
}

// La clé change avec le tri et les filtres, qui changent le contenu des pages.
export function lirePositionPage(racine: ParentNode): { cle: string; pagination: Pagination } | null {
  const libelle = [...racine.querySelectorAll<HTMLElement>('main *')].find(
    (el) => el.children.length === 0 && analyserPagination(el.textContent ?? '') !== null,
  );
  const pagination = analyserPagination(libelle?.textContent ?? '');
  if (!pagination) return null;
  const texteBouton = (nom: string): string => racine.querySelector<HTMLElement>(`button[aria-label="${nom}"]`)?.innerText.trim() ?? '';
  // Seule une empreinte de la recherche est gardée, jamais le texte tapé sur le site.
  const recherche = empreinte(racine.querySelector<HTMLInputElement>('main input[type="text"]')?.value ?? '');
  return { cle: [texteBouton('Trier la collection'), texteBouton('Filtrer par étiquette'), recherche].join('|'), pagination };
}

export interface CarteDansPage {
  element: HTMLElement;
  carte: CarteAffichee;
}

export function trouverCartes(racine: ParentNode): CarteDansPage[] {
  const trouvees: CarteDansPage[] = [];
  for (const bouton of racine.querySelectorAll<HTMLElement>('button[aria-label*="favoris"]')) {
    const element = bouton.closest<HTMLElement>('.group');
    if (!element) continue;
    const carte = analyserTexteCarte(element.innerText, bouton.getAttribute('aria-label') ?? '');
    if (carte) trouvees.push({ element, carte });
  }
  return trouvees;
}
