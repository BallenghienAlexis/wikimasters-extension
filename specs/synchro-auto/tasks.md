# Tâches — Synchronisation automatique

Vagues : V1 : T-201 [P], T-202 [P] · V2 : T-203 [P], T-204 [P] · V3 : T-205 · V4 : T-206 · V5 : T-207 · V6 : T-208

## Garde-fous communs (à lire par tout dev)
- **G1** Aucun test ne contacte le vrai site. Unitaire : transport et horloge injectés. E2e : `page.route` sert des réponses **fictives** conformes à `releve-api.md` et abandonne toute autre requête.
- **G2** `GET` uniquement. Aucun `POST`, `PUT`, `PATCH`, `DELETE`. Jamais la route `/sales` sans `?scope=summary`.
- **G3** Aucun en-tête ajouté (ni `Authorization`, ni jeton), `credentials: 'same-origin'`, aucune lecture de cookie ni du jeton ; `jeton.ts` n'est pas importé.
- **G4** Intervalle minimal 200 ms plus gigue injectée de 0 à 100 ms (avenants des 2026-11-11 et 2026-11-12), aucun plafond par minute, une seule requête en vol, arrêt sur 401/403/429 et après 3 échecs, aucune reprise avant 30 min. Aucune valeur aléatoire.
- **G5** `click`, `submit`, `requestSubmit`, `dispatchEvent`, `focus` interdits dans le code du site. Pas de `innerHTML`. Permission `storage` seule, aucun `host_permissions`.
- **G6** Option activée par défaut depuis le 2026-11-11 (avenant) : 0 requête si le joueur la désactive.
- **G7** Données fictives dans les tests ; jamais de contenu de `captures-site/`.
- Code, commentaires, UI, commits en français. Commits `type(T-xxx): …`.

| ID | Titre | Couche | Agent | Dépend de | SC | [P] |
|---|---|---|---|---|---|---|
| T-201 | Validation et conversion des réponses | logique | dev-core | — | SC-010, SC-012, SC-013 | [P] |
| T-202 | Schéma : étiquettes du site, préférence, bail | données | dev-core | — | SC-007, SC-009, SC-012 | [P] |
| T-203 | Ordonnanceur incrémental | logique | dev-core | T-201, T-202 | SC-003 à SC-006, SC-008, SC-013 | [P] |
| T-204 | Écarts d'étiquettes | logique | dev-core | T-202 | SC-014 | [P] |
| T-205 | Exécuteur du content script et déclencheurs | infra | dev-core | T-203 | SC-002, SC-007 | |
| T-206 | Interface de synchronisation automatique | ui | dev-ui | T-204, T-205 | SC-002, SC-014 | |
| T-207 | E2e sur site fictif et captures | tests | dev-test | T-206 | SC-002 à SC-007 | |
| T-208 | `AGENTS.md` et `README.md` | docs | dev-core | T-207 | — | |

---

## T-201 — Validation et conversion des réponses
- **Couche** : logique · **Agent** : dev-core · **Dépend de** : — · **[P]**
- **SC** : SC-010, SC-012, SC-013
- **Fichiers concernés** : `src/lib/lectureApi.ts`, `tests/unit/lectureApi.test.ts`
- **Critères d'acceptation**
  1. `analyserStats(json)` renvoie `{ total, totalUnique, etiquettes: [{ id, nom, couleur, nbCartes }] }` ou `null` si la forme est inattendue.
  2. `analyserPage(json)` renvoie les cartes converties (`rareté|titre` comme identifiant local, `idsSite`, `quantite`, `favori`, `etiquettesSite`) ; une carte de forme inattendue est ignorée et comptée ; `collection: []` signale la fin.
  3. `analyserPrix(json, rarete)` renvoie `average` si c'est un entier ≥ 0 pour la rareté demandée, sinon `null`.
  4. Rien n'est jamais copié depuis un champ non listé (liste blanche).
- **Tests attendus** : `tests/unit/lectureApi.test.ts` (AC1 à AC4) avec réponses fictives.
- **Brief** : *Pourquoi* : sécuriser la lecture (SC-010). *État actuel* : `lecteur.ts` lit le DOM. *À faire* : fonctions pures, sans `chrome.*` ni `fetch`. *Contrats* : formes de `releve-api.md`. *Pièges* : `id` ≠ `card_id` ; identifiant local = `rareté|titre` (AGENTS.md). *Vérifier* : `npm run check && npm run build`.

## T-202 — Schéma : étiquettes du site, préférence, bail
- **Couche** : données · **Dépend de** : — · **[P]** · **SC** : SC-007, SC-009, SC-012
- **Fichiers concernés** : `src/lib/collection.ts`, `src/lib/stockage.ts`, `tests/unit/collection.test.ts`, `tests/unit/stockage.test.ts`
- **Critères d'acceptation**
  1. `Carte` porte `etiquettesSite: string[]` (noms) ; `VERSION_SCHEMA` passe à 3 avec migration depuis 2 (tableau vide) et test de migration.
  2. Préférence `syncAuto` (booléen, `false` par défaut), `derniereSynchro` (horodatage ou `null`), `bailSynchro` (horodatage d'expiration ou `null`) dans `chrome.storage.local`, lues avec validation.
  3. Les exports CSV et JSON restent compatibles.
- **Tests attendus** : migration v2→v3, valeurs par défaut, lecture d'une valeur invalide.
- **Brief** : *Pourquoi* : porter les étiquettes lues et l'état de la synchro. *Pièges* : `stockage.ts` reste le seul module qui touche `chrome.storage.local`. *Vérifier* : `npm run check && npm run build`.

## T-203 — Ordonnanceur incrémental
- **Couche** : logique · **Dépend de** : T-201, T-202 · **[P]** · **SC** : SC-003 à SC-006, SC-008, SC-013
- **Fichiers concernés** : `src/lib/ordonnanceur.ts`, `tests/unit/ordonnanceur.test.ts`
- **Critères d'acceptation**
  1. Total inchangé depuis la dernière synchro complète → une seule requête (`stats`).
  2. Sinon pages lues dans l'ordre jusqu'à `collection: []` ; arrêt anticipé uniquement si le test de stabilité du tri le permet.
  3. Prix : cartes à décider d'abord, puis valeur absente ou périmée (30 jours) ; une valeur saisie à la main n'est pas écrasée sans signalement.
  4. Cadence 0,2 s plus gigue, sans plafond par minute, une requête en vol (horloge simulée) ; 401/403/429 ou 3 échecs → arrêt, aucune reprise avant 30 min.
  5. Un bail empêche deux synchros simultanées ; `decidePar: 'moi'` jamais modifié.
- **Tests attendus** : un test par critère, horloge et transport injectés.
- **Brief** : *Pourquoi* : cœur du comportement. *État actuel* : `file.ts` fournit les constantes et le modèle d'exécuteur à cadence fixe : les réutiliser, pas les dupliquer. *Pièges* : aucun hasard ; l'état d'arrêt est conservé pour l'interface. *Vérifier* : `npm run check && npm run build`.

## T-204 — Écarts d'étiquettes
- **Couche** : logique · **Dépend de** : T-202 · **[P]** · **SC** : SC-014
- **Fichiers concernés** : `src/lib/ecarts.ts`, `tests/unit/ecarts.test.ts`
- **Critères d'acceptation**
  1. Pour chaque carte, compare les étiquettes attendues (Statut · …, Ami · …, Thème · …, d'après `registre.ts` et `themes.ts`) à `etiquettesSite` et renvoie les écarts (manquante, en trop).
  2. Aucune écriture : fonction pure.
- **Tests attendus** : cas manquante, en trop, aucun écart.
- **Vérifier** : `npm run check && npm run build`.

## T-205 — Exécuteur du content script et déclencheurs
- **Couche** : infra · **Dépend de** : T-203 · **SC** : SC-002, SC-007
- **Fichiers concernés** : `src/content/synchroAuto.ts`, `src/content/index.ts`, `tests/unit/synchro-auto-lint.test.ts`
- **Critères d'acceptation**
  1. Démarre au chargement d'une page du site et toutes les 30 min tant que l'onglet est visible, si `syncAuto` est actif et la dernière synchro a plus de 30 min.
  2. `fetch` en `GET` même origine, sans en-tête ajouté ; seul ce fichier appelle `fetch` ; `jeton.ts` n'est pas importé (test de lint).
  3. Option désactivée → 0 requête.
  4. Arrêt immédiat à la demande (message de l'interface).
- **Brief** : *Pièges* : aucun `click`, `focus`, `dispatchEvent` ; état écrit dans le stockage pour l'interface. *Vérifier* : `npm run check && npm run build`.

## T-206 — Interface de synchronisation automatique
- **Couche** : ui · **Agent** : dev-ui · **Dépend de** : T-204, T-205 · **SC** : SC-002, SC-014 · **D-01 à D-03**
- **Fichiers concernés** : `src/app/SynchroAuto.tsx`, `src/app/App.tsx`
- **Critères d'acceptation** : interrupteur, états, dernière synchro, bouton « Arrêter », écarts et journal selon `design.md` ; clavier, contrastes AA, 3 breakpoints, deux thèmes.
- **Vérifier** : `npm run check && npm run build && npm run test:e2e`.

## T-207 — E2e sur site fictif et captures
- **Couche** : tests · **Agent** : dev-test · **Dépend de** : T-206 · **SC** : SC-002 à SC-007
- **Fichiers concernés** : `tests/e2e/synchro-auto.spec.ts`, `tests/e2e/fixtures/`
- **Critères d'acceptation** : `page.route` sert des réponses fictives et abandonne le reste ; vérifie 0 requête désactivé, requêtes attendues activé, une seule requête si total inchangé, arrêt sur 403 ; captures aux 3 breakpoints.
- **Vérifier** : `npm run test:e2e`.

## T-208 — `AGENTS.md` et `README.md`
- **Couche** : docs · **Dépend de** : T-207
- **Fichiers concernés** : `AGENTS.md`, `README.md`
- **Critères d'acceptation** : le cadre WikiMasters décrit la lecture automatique (décision d'Alexis du 2026-11-09, risque rappelé, cookies de même origine, jeton non lu) ; l'architecture cite les nouveaux fichiers.

## T-901 — Retouches
- **Couche** : logique · **Dépend de** : T-208 · **SC** : SC-007
- **Fichiers concernés** : `AGENTS.md`, `README.md`, `specs/synchro-auto/releve-api.md`, `specs/synchro-auto/STATUS.md`, `tests/e2e/synchro-auto.spec.ts`, `src/lib/lecteur.ts`, `src/lib/lectureApi.ts`, `src/lib/ordonnanceur.ts`, `src/content/synchroAuto.ts`, `tests/unit/ordonnanceur.test.ts`
- **Critères d'acceptation**
  1. `AGENTS.md` : « aucune requête » vaut hors synchronisation automatique (désactivée par défaut).
  2. `README.md` : apostrophes ’ uniformes dans la section Synchronisation automatique ; mention « ou laissez la synchro lire pour vous ».
  3. `releve-api.md` : `page` commence à 0 (50 éléments par page, page hors limites → 200 avec `collection: []`).
  4. E2e « désactivé » : après l'attente, activer la préférence et vérifier que les requêtes partent.
  5. `RARETES` exporté depuis `lecteur.ts` et réutilisé dans `lectureApi.ts`.
  6. Plafond de pages (400) quand `total` est inconnu, avec test.
  7. `catch` silencieux de `synchroAuto.ts` : message générique sans contenu de réponse, ou décliné avec raison.
- **Vérifier** : `npm run check && npm run build && npx playwright test tests/e2e/synchro-auto.spec.ts --trace off`.


## Avenant du 2026-11-11
Décision d’Alexis (voir AGENTS.md) : synchronisation automatique **activée par défaut**, `GET /api/marketplace/mine` ajouté au périmètre de lecture, délai variable (gigue de 0 à 6 s) ajouté à l’intervalle de 6 s. L’écriture sur le site est autorisée ; ses contrats attendent les relevés de `specs/synchro-complete/releves-a-faire.md`. En cas d’écart avec le texte ci-dessus, AGENTS.md prime.

## Avenant du 2026-11-12 : cadence actuelle

Décisions d’Alexis du 2026-11-12, livrées (PR #72 à #76) ; `AGENTS.md` prime. Les passages de ce document qui parlent de 6 s, de 10 par minute, de 134 pages en 14 min ou d’un plafond par fenêtre de 60 s sont remplacés par ce qui suit.

- **Cadence** : 0,2 s au minimum entre deux requêtes (`INTERVALLE_MS`) plus une gigue de 0 à 0,1 s (`gigue.ts`, injectée dans l’ordonnanceur), **sans plafond par minute**, une seule requête en vol, une seule synchro à la fois (bail dans `chrome.storage.local`). SC-005 se lit : deux requêtes sont séparées d’au moins 0,2 s ; une seule synchro à la fois, même avec plusieurs onglets. Une lecture complète de 134 pages dure donc quelques dizaines de secondes (134 × environ 0,25 s) au lieu de 14 min, et un lot d’écriture prend le bail pour toute sa durée.
- **Arrêts** : 401, 403, 429 ou 3 échecs arrêtent la synchro ; aucune reprise automatique avant 30 min. Inchangé.
- **Relance explicite** : le bouton « Relancer la synchro » (PR #76) est proposé seulement après un arrêt manuel ou un 403 ; il passe outre la pause de 30 min et le délai de 30 min depuis la dernière synchro, avec un avertissement, au plus une relance par minute commune aux onglets (`derniereRelance`). Après un 401, un 429 ou des échecs, la pause est gardée. Le bail, l’option désactivée et les arrêts automatiques restent en vigueur.
- **Relevé d’affluence** (`affluence-site`) : une requête au plus toutes les 30 min, 0,2 s après la précédente (au lieu de 6 s).
- **Écarts d’étiquettes** : une carte `en-vente` n’attend aucune étiquette (PR #71) ; `calculerEcarts` doit l’ignorer (voir `retouches.md` de `synchro-complete`).
