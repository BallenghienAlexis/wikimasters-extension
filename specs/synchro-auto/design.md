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


## Avenant du 2026-11-11
Décision d’Alexis (voir AGENTS.md) : synchronisation automatique **activée par défaut**, `GET /api/marketplace/mine` ajouté au périmètre de lecture, délai variable (gigue de 0 à 6 s) ajouté à l’intervalle de 6 s. L’écriture sur le site est autorisée ; ses contrats attendent les relevés de `specs/synchro-complete/releves-a-faire.md`. En cas d’écart avec le texte ci-dessus, AGENTS.md prime.

## Avenant du 2026-11-12 : cadence actuelle

Décisions d’Alexis du 2026-11-12, livrées (PR #72 à #76) ; `AGENTS.md` prime. Les passages de ce document qui parlent de 6 s, de 10 par minute, de 134 pages en 14 min ou d’un plafond par fenêtre de 60 s sont remplacés par ce qui suit.

- **Cadence** : 0,2 s au minimum entre deux requêtes (`INTERVALLE_MS`) plus une gigue de 0 à 0,1 s (`gigue.ts`, injectée dans l’ordonnanceur), **sans plafond par minute**, une seule requête en vol, une seule synchro à la fois (bail dans `chrome.storage.local`). SC-005 se lit : deux requêtes sont séparées d’au moins 0,2 s ; une seule synchro à la fois, même avec plusieurs onglets. Une lecture complète de 134 pages dure donc quelques dizaines de secondes (134 × environ 0,25 s) au lieu de 14 min, et un lot d’écriture prend le bail pour toute sa durée.
- **Arrêts** : 401, 403, 429 ou 3 échecs arrêtent la synchro ; aucune reprise automatique avant 30 min. Inchangé.
- **Relance explicite** : le bouton « Relancer la synchro » (PR #76) est proposé seulement après un arrêt manuel ou un 403 ; il passe outre la pause de 30 min et le délai de 30 min depuis la dernière synchro, avec un avertissement, au plus une relance par minute commune aux onglets (`derniereRelance`). Après un 401, un 429 ou des échecs, la pause est gardée. Le bail, l’option désactivée et les arrêts automatiques restent en vigueur.
- **Relevé d’affluence** (`affluence-site`) : une requête au plus toutes les 30 min, 0,2 s après la précédente (au lieu de 6 s).
- **Écarts d’étiquettes** : une carte `en-vente` n’attend aucune étiquette (PR #71) ; `calculerEcarts` doit l’ignorer (voir `retouches.md` de `synchro-complete`).
- **Interface** : le bouton « Relancer la synchro » et son avertissement figurent dans `SynchroAuto.tsx` ; captures et e2e restent à faire (`retouches.md`).
