---
name: responsive-captures
description: Captures d'écran Playwright de la page de l'extension aux breakpoints 375/768/1280 et par thème, comme preuves de revue. Utilisé par dev-test, dev-ui et verifier.
---

# Captures responsive

Base : `tests/e2e/extension.spec.ts` écrit dans `test-results/captures/<page>-<theme>-<breakpoint>.png` ; la CI publie l'artefact `captures`.

## Charger l'extension
Une extension ne se charge que dans un contexte persistant : utiliser la fixture de `tests/e2e/extension.ts`, qui lance Chromium avec `dist/` et fournit `pageCollection`. Le build doit être à jour (`npm run test:e2e` le fait).

## Ajouter des captures pour une tâche
Dans un `tests/e2e/<sujet>.spec.ts` :
```ts
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
await pageCollection.emulateMedia({ colorScheme: 'light' });
await pageCollection.setViewportSize({ width, height });
await pageCollection.screenshot({ path: `test-results/captures/<sujet>-<theme>-<bp>.png`, fullPage: true });
```

## Données
Uniquement des collections fictives, importées par la fixture. Jamais de page réelle du compte.

## Lancer
`npx playwright test tests/e2e/<sujet>.spec.ts` après `npm run build`, puis ouvrir les PNG de `test-results/captures/`.
