// Gardes de validation et utilitaires de texte partagés (sans `chrome.*`, sans effet de bord).
// Regroupe des fonctions qui étaient recopiées dans plusieurs modules de validation.

/** Objet simple (ni `null`, ni tableau). */
export const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Entier sûr positif ou nul. */
export const estEntier = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

/** Coupe une chaîne à `max` points de code (sans casser une paire de substitution). */
export const tronquer = (s: string, max: number): string => Array.from(s).slice(0, max).join('')
