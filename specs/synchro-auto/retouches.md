# Retouches — synchro-auto

## À reprendre
- `src/lib/ordonnanceur.ts` (arrêt anticipé, test d'égalité de l'écart) : si, en même temps et dans des pages non lues, une carte ancienne gagne un exemplaire et une autre en perd un, les deux écarts s'annulent et l'arrêt a lieu ; ces deux changements ne sont corrigés qu'à la prochaine lecture complète. Risque faible (égalité exacte exigée). Piste : lecture complète périodique (toutes les N synchros ou après X jours). Relevé à la revue de la PR #54.

## À reprendre : bouton « Relancer la synchro » (PR #76)

- `src/content/synchroAuto.ts` (`relancer`) : refuser aussi la relance quand `etat.arretJusqua` est dans le futur et que le statut n’est pas un arrêt manuel ou un 403 (pause posée par le relevé d’affluence après un 401 ou 429, statut resté « terminé »).
- `src/content/synchroAuto.ts` (`relancer`) : la limite d’une relance par minute se lit puis s’écrit sans verrou ; vérifier `derniereRelance` après la prise du bail.
- `src/app/SynchroAuto.tsx` : relier le texte d’avertissement au bouton (`id` + `aria-describedby`).
- `src/app/SynchroAuto.tsx:19` et `tests/unit/synchro-auto-ui.test.ts:10` : `NB` contient une espace ordinaire au lieu d’une insécable (déjà le cas sur main) ; PR séparée.
- Captures aux 3 breakpoints de l’état « arrêt » avec le bouton, et test e2e du bouton.
