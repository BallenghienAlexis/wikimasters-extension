// Conversion d’une sauvegarde de l’extension (Réglages › Sauvegarde, fichier JSON) vers le banc d’essai : seuls le titre et la
// description du site sont lus. Identifiants, rareté, quantité, prix, notes, amis, préférences et ventes sont ignorés et jamais copiés.
import { CARTES_REFERENCE } from './cartes';
import type { CarteReference } from './types';

export interface CarteLue {
  titre: string;
  description: string;
}

const FORMAT_SAUVEGARDE = 'wm-collection-sauvegarde';

/** Clé de comparaison des titres : sans accents ni casse, apostrophes droites, espaces simples (l’export garde « ' », le jeu « ’ »). */
export const cleTitre = (titre: string): string =>
  titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Lit une sauvegarde (texte ou objet déjà analysé) : titre et description seulement ; une carte sans titre est ignorée. */
export function lireSauvegarde(source: unknown): CarteLue[] {
  const brut: unknown = typeof source === 'string' ? JSON.parse(source) : source;
  if (typeof brut !== 'object' || brut === null) throw new Error('Sauvegarde illisible : objet attendu.');
  const { format, cartes } = brut as { format?: unknown; cartes?: unknown };
  if (format !== FORMAT_SAUVEGARDE) throw new Error(`Format de sauvegarde inattendu : « ${String(format)} ».`);
  if (!Array.isArray(cartes)) throw new Error('Sauvegarde illisible : liste « cartes » absente.');
  const lues: CarteLue[] = [];
  for (const carte of cartes as unknown[]) {
    if (typeof carte !== 'object' || carte === null) continue;
    const { titre, description } = carte as { titre?: unknown; description?: unknown };
    if (typeof titre !== 'string' || titre.trim() === '') continue;
    lues.push({ titre, description: typeof description === 'string' ? description : '' });
  }
  return lues;
}

export interface ResultatConversion {
  cartes: CarteReference[];
  /** Cartes dont la description a été remplacée par celle de la sauvegarde. */
  remplacees: string[];
  /** Cartes du jeu absentes de la sauvegarde : description gardée telle quelle. */
  absentes: string[];
}

/**
 * Remplace les descriptions du jeu par celles de la sauvegarde (même titre, ou même page Wikipédia). Les thèmes de référence sont gardés.
 * Une carte retrouvée passe en source « reelle » ; sa description peut devenir vide, comme sur le site.
 */
export function appliquerDescriptions(lues: readonly CarteLue[], cartes: readonly CarteReference[] = CARTES_REFERENCE): ResultatConversion {
  const index = new Map(lues.map((l) => [cleTitre(l.titre), l]));
  const remplacees: string[] = [];
  const absentes: string[] = [];
  const resultat = cartes.map((carte) => {
    const lue = index.get(cleTitre(carte.titre)) ?? index.get(cleTitre(carte.wikipedia));
    if (!lue) {
      absentes.push(carte.titre);
      return carte;
    }
    remplacees.push(carte.titre);
    return { ...carte, titre: lue.titre, description: lue.description, source: 'reelle' as const };
  });
  return { cartes: resultat, remplacees, absentes };
}

/** Cartes de la sauvegarde absentes du jeu (candidates à de nouvelles références) : titre et description seulement. */
export function cartesAReferencer(lues: readonly CarteLue[], cartes: readonly CarteReference[] = CARTES_REFERENCE): CarteLue[] {
  const connus = new Set(cartes.flatMap((c) => [cleTitre(c.titre), cleTitre(c.wikipedia)]));
  return lues.filter((l) => !connus.has(cleTitre(l.titre)));
}
