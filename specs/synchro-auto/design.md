# Design — Synchronisation automatique

Entrées : `spec.refined.md`. Tokens existants uniquement (`ink`, `paper`, `muted`, `line`, `garder`, `echanger`, `vendre`), aucune nouvelle couleur.

## D-01 — Section « Synchronisation automatique » (page de gestion)
- Un interrupteur (`role="switch"`, `aria-checked`) « Synchronisation automatique », **désactivé par défaut**, libellé et état annoncés, activable au clavier (Espace).
- Dessous, une ligne d'état en texte, jamais seulement en couleur : « Désactivée » · « En attente d’un onglet WikiMasters » · « En cours : page 12 sur 134 » · « Terminée à 16 h 42 » · « Arrêtée : le site a refusé (403) ».
- Dernière synchro : date et heure, nombre de cartes ajoutées, étiquettes lues, prix relevés.
- Un bouton « Arrêter » visible pendant une synchro (arrêt immédiat), sans confirmation.
- Typographie française (’, espace avant `:`).

## D-02 — Écarts d'étiquettes
- Liste « Écarts avec le site » (carte, étiquette attendue, étiquette présente) ; vide : « Aucun écart. ». Lecture seule, aucun bouton qui écrive sur le site.

## D-03 — Journal
- Les synchros alimentent le journal existant (début, fin, arrêt et cause), sans corps de réponse ni identifiant de session.

## Responsive et accessibilité
- 375, 768 et 1280 px, thèmes clair et sombre ; contrastes AA ; `prefers-reduced-motion` coupe l'animation de progression.
