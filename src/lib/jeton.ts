// Seul module autorisé à lire le jeton de session du site (AGENTS.md, « Ne jamais faire »).
// Le jeton n’est jamais gardé, journalisé, stocké ni renvoyé ailleurs qu’à l’appelant.
// L’endroit du jeton n’est pas encore relevé : la lecture réelle viendra avec T-021.

export type SourceJeton = () => string | null;

/** Source par défaut : ne lit rien. */
export const SOURCE_NON_RELEVEE: SourceJeton = () => null;

const ORIGINE_SITE = 'https://www.wiki-masters.com';

function origineDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * En-tête d’authentification pour une requête vers l’origine du site, ou `null`.
 * La source n’est appelée qu’après les contrôles d’origine, et à chaque appel.
 */
export function enteteAuthentification(
  url: string,
  origineOnglet: string,
  nomEntete: string,
  source: SourceJeton = SOURCE_NON_RELEVEE,
): { nom: string; valeur: string } | null {
  if (origineOnglet !== ORIGINE_SITE) return null;
  if (origineDe(url) !== origineOnglet) return null;
  const valeur = source();
  if (!valeur) return null;
  return { nom: nomEntete, valeur };
}
