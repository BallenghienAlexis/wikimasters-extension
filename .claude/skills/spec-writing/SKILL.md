---
name: spec-writing
description: Rédiger et relire une spec SDD WM Collection - questions fermées, visuels, critères SC testables, relecture adversaire. Utilisé par les agents spec et refine.
---

# Rédaction de spec

## Bloc QUESTIONS (format de retour vers la session principale)
```
QUESTIONS
1. <question fermée, 1 ligne> | options: <A (recommandé)> / <B> / <C> | pourquoi: <impact utilisateur en 1 ligne>
2. …
VISUELS: specs/<feature>/wireframes/variante-1.html, variante-2.html (+ Mermaid dans la réponse)
```
4 questions au plus par tour, 2 tours au plus. Une question ouverte (« que voulez-vous ? ») est interdite : propose toujours des options.

## Ce qu'on challenge
- **Cas limites** de l'extension : collection vide ou de plusieurs milliers de cartes, très longs titres, fichier importé invalide, structure du site modifiée, quota de `chrome.storage`, service worker endormi, largeur 375 px, clavier seul, lecteur d'écran.
- **Alternatives** : solution plus simple ? existante dans le code ?
- **Impact utilisateur** : qui voit quoi, que perd-on (rétrocompatibilité des données stockées et des exports).
- **Vie privée** : la feature lit-elle ou stocke-t-elle plus que le strict nécessaire ?
- **Cadre WikiMasters** : la feature agit-elle sur le site à la place d'Alexis ? Si oui, le risque de bannissement est écrit dans la spec et validé au gate.

## Visuels
- Wireframe ASCII dans la spec pour la structure ; HTML autonome (sans dépendance externe) pour comparer 2-3 variantes de design, avec les couleurs réelles de `src/styles/tokens.css`.
- Mermaid (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`) dès qu'il y a un flux ou des états.

## Critères de succès
Un SC est **testable** s'il nomme : la page ou le module, l'action, le résultat observable, et le seuil. Il doit pouvoir devenir un test Vitest ou Playwright.
- ✗ « Le thème clair est agréable. »
- ✓ « SC-004 : sur `collection.html` en thème clair, chaque paire texte/fond listée dans design.md a un contraste ≥ 4,5:1 (texte normal). »

## Relecture adversaire (refine)
Pour chaque phrase : peut-on l'implémenter de deux façons différentes ? Deux SC se contredisent-ils ? Un SC est-il invérifiable sans jugement humain ? Une contrainte manque-t-elle (perf, a11y, rétrocompat, `prefers-reduced-motion`) ? Tranche quand l'intention d'Alexis est claire et note l'hypothèse.
