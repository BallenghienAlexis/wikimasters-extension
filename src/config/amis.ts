// Amis d'échange et thèmes qu'ils aiment : liste de départ, **vide dans le code livré**.
// Chacun renseigne ses amis dans la page de gestion (préférences stockées localement) ; aucun ami n'est en dur.
// Un mainteneur peut y ajouter des amis pour son usage perso (sans les committer) : au premier chargement des
// préférences (puis à chaque hausse de VERSION_AMIS_INITIAUX), ces amis sont fusionnés dans les préférences
// déjà enregistrées : un ami absent est ajouté, un ami présent reçoit les thèmes qui lui manquent. Rien n'est jamais retiré.
// Les identifiants de thèmes sont ceux de `src/lib/themes.ts`.
import type { Ami } from '../lib/tri';

/** À incrémenter quand on ajoute un ami ou un thème ici, pour que la fusion soit refaite une fois. */
export const VERSION_AMIS_INITIAUX = 1;

export const AMIS_INITIAUX: Ami[] = [];
