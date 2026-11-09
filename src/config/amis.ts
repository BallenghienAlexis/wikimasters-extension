// Amis d'échange et thèmes qu'ils aiment : réglage à renseigner par Alexis, comme `prix.ts`.
// Au premier chargement des préférences (puis à chaque hausse de VERSION_AMIS_INITIAUX), ces amis
// sont fusionnés dans les préférences déjà enregistrées : un ami absent est ajouté, un ami présent
// reçoit les thèmes qui lui manquent. Rien n'est jamais retiré.
// Les identifiants de thèmes sont ceux de `src/lib/themes.ts` (`barrage`, `tibet`, `ukraine`…).
import type { Ami } from '../lib/tri';

/** À incrémenter quand on ajoute un ami ou un thème ici, pour que la fusion soit refaite une fois. */
export const VERSION_AMIS_INITIAUX = 1;

export const AMIS_INITIAUX: Ami[] = [
  { nom: 'Benjamin', themes: ['barrage', 'tibet'] },
  { nom: 'Anatole', themes: ['ukraine'] },
];
