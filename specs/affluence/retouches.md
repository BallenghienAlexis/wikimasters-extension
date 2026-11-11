# Retouches — affluence

## À reprendre
- `tests/e2e/assistant.spec.ts:65` et `:109` : la regex accepte les trois conseils car le test dépend de l’heure réelle. Figer l’horloge avec `page.clock.setFixedTime` pour viser un conseil précis (le choix du conseil est déjà couvert par les tests unitaires de `conseillerDelai`).
