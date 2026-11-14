/** Classe commune des boutons de la section Thèmes des Réglages. */
export const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

/** Ajoute la valeur à la liste si elle n’y est pas, la retire sinon. */
export const basculer = (liste: string[], valeur: string): string[] =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
