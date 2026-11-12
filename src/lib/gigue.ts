/**
 * Délai variable ajouté à l’intervalle minimal entre deux requêtes (décision d’Alexis du 2026-11-11) :
 * des cadences trop régulières déclenchent plus facilement erreurs et sanctions côté serveur.
 * L’intervalle minimal de 6 s, le plafond de 10 requêtes par minute et les arrêts sur 401, 403 ou 429
 * restent inchangés : la gigue ne fait qu’allonger l’attente, jamais la raccourcir.
 * La source d’aléa est injectée dans la file et l’ordonnanceur, qui restent purs et testables.
 */
export const GIGUE_MAX_MS = 500;

/** Millisecondes supplémentaires, entre 0 (inclus) et `GIGUE_MAX_MS` (exclu). */
export const gigueAleatoire = (): number => Math.floor(Math.random() * GIGUE_MAX_MS);
