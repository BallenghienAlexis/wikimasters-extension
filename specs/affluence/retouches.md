# Retouches — affluence

## À reprendre
- `tests/e2e/assistant.spec.ts:65` et `:109` : la regex accepte les trois conseils car le test dépend de l’heure réelle. Figer l’horloge avec `page.clock.setFixedTime` pour viser un conseil précis (le choix du conseil est déjà couvert par les tests unitaires de `conseillerDelai`).
- `tests/unit/pilotage-lots.test.ts:116` : la fixture `enchere(n)` porte déjà `dureeMinutes: 180` en entrée, donc rien ne prouve que `avecDureeEnchere` (`src/app/pilotageLots.ts`) calcule la durée à « Lancer ». Donner une fixture d’entrée sans `dureeMinutes` et vérifier 180 (13/11 à 14 h 05, zone creuse), plus un cas en heure forte qui donne 60. (PR #218, revue.)
- `src/content/suiviVentes.ts:199-200` et `:227` : la relance automatique n’a aucun test de la durée. Ajouter un cas dans `tests/unit/suivi-ventes*.test.ts` avec `chargerEvenementsAffluence` injecté et une horloge en zone creuse : `emettre(...).dureeMinutes === 180` et `active.finLe === T + 3 h`. (PR #218, revue.)
