# Retouches — synchro-auto

## À reprendre
- `src/lib/ordonnanceur.ts` (arrêt anticipé, test d'égalité de l'écart) : si, en même temps et dans des pages non lues, une carte ancienne gagne un exemplaire et une autre en perd un, les deux écarts s'annulent et l'arrêt a lieu ; ces deux changements ne sont corrigés qu'à la prochaine lecture complète. Risque faible (égalité exacte exigée). Piste : lecture complète périodique (toutes les N synchros ou après X jours). Relevé à la revue de la PR #54.
