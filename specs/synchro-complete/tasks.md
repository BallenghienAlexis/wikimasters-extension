# Tâches — Synchronisation complète : étiquettes, enchères et défausse appliquées sur le site

Vagues : V1 : T-001 [P], T-002 [P], T-003 [P] · V2 : T-004 [P], T-005 [P], T-006 [P], T-007 [P], T-008 [P] · V3 : T-009 [P], T-010 [P], T-011 [P] · V4 : T-012 [P], T-013 [P], T-014 [P], T-015 [P], T-016 [P] · V5 : T-017 · V6 : T-018 · V7 : T-019 · V8 : T-020 [P], T-021 [P]*, T-022 [P]*, T-023 [P]*, T-024 [P]*, T-025 [P]* · V9 : T-026

\* Tâches **bloquées par un relevé d'Alexis** (voir « Bloquée par »). Elles ne démarrent pas tant que le point de `contrat-api.md` « Reste à relever » qui les concerne n'est pas écrit. Un type d'action dont un paramètre n'est pas relevé reste « non disponible » (absent de la table du contrat) : il n'est jamais deviné.

## Amendements du 2026-11-11 (décisions d'Alexis, PR de la pose des étiquettes)

- **G3** : le jeton ne part que vers `https://www.wiki-masters.com` **et** l'hôte REST de `src/config/synchro.ts` (`jeton.ts`, `reseau.ts` seuls). **G4** : délai variable, 6 s minimum plus 0 à 4 s tirées hors de `file.ts` (T-011 AC8 levé) ; en-têtes : `Content-Type`, `Accept`, `apikey`, `Content-Profile`, `Authorization`, plus `Prefer` pour la création.
- **T-019** : `fetch` avec `credentials: 'omit'` et `redirect: 'error'` (jeton explicite, aucun cookie), délai de 15 s ; 401, 403, 429 sont classés `echec` avec leur code (la file s'arrête via `CODES_ARRET`), une réponse 2xx hors contrat est `inconnu` (la file s'arrête).
- **Listes de fichiers étendues** : `src/lib/actions.ts`, `src/lib/messages.ts`, `src/lib/contrat.ts`, `src/lib/registre.ts`, `src/app/Synchronisation.tsx`, `src/content/index.ts`, `src/config/synchro.ts`, `src/lib/jeton.ts`, `src/lib/reseau.ts`, `src/lib/file.ts` (écart assumé : `idEtiquette`, session lue à l'envoi, branchement du délai).
- **T-018, T-020, T-026** (e2e complet avec site fictif servant l'hôte REST) restent à faire : voir `retouches.md` § « À reprendre ».

## Ordre imposé par Alexis

1. **V1 à V6 : aucune tâche n'émet de requête.** Types, schéma, lint, table du contrat vide, registre, journal, messages, `jeton.ts` isolé (sans lecture réelle) et son test de confinement, construction du lot, file à cadence fixe 6 000 ms (transport injecté), exécution côté page, aperçu et confirmation de défausse, e2e « 0 requête ».
2. **V7 et suivantes : lots qui appellent le site.** `reseau.ts` (V7), puis non-fuite du jeton, lecture réelle du jeton, défausse, enchère, étiquettes, source des identifiants d'exemplaire (V8, chacune bloquée par ses relevés), e2e complet (V9). T-019 dépend de T-018 : le garde-fou « 0 requête avant Lancer, tout le reste bloqué » est prouvé avant que le module réseau existe.

## Garde-fous communs (à lire par tout dev)

- **G1** Aucun test automatisé ne contacte le vrai site. Unitaire : transport, horloge et source de jeton injectés. E2e : `page.route` sert une page fictive et des réponses fictives conformes à `contrat-api.md`, et **bloque (abort) toute autre requête**. Aucune donnée de `captures-site/` ; ce dossier n'est jamais committé (`git check-ignore captures-site/` doit renvoyer le chemin).
- **G2** Aucune action n'est lancée sans la confirmation prévue : « Lancer » (une validation pour le lot), puis confirmation individuelle de chaque défausse. 0 requête avant « Lancer ».
- **G3** Le jeton de session n'est lu que dans `src/lib/jeton.ts`, importé seulement par `src/lib/reseau.ts`. Jamais stocké, journalisé, affiché, copié dans `chrome.storage`, ni envoyé hors de `https://www.wiki-masters.com`. `collection.html` et le service worker ne le voient jamais.
- **G4** Cadence fixe 6 000 ms ; aucun `Math.random`, `crypto.getRandomValues`, `crypto.randomUUID`, aucun délai variable ; aucun en-tête falsifié (jamais `User-Agent`, `Referer`, `Origin`, `Cookie`). En-têtes fixés : `Content-Type`, `Accept` et, si la table du contrat l'exige pour ce type, l'en-tête d'authentification dont la valeur vient de `jeton.ts`.
- **G5** Les inconnues de « Reste à relever » du contrat ne sont jamais devinées : type « non disponible » tant qu'elles ne sont pas relevées.
- **G6** `click`, `submit`, `requestSubmit`, `dispatchEvent`, `focus` interdits dans le code exécuté sur le site (le piège de focus du dialogue vit dans `src/app/`). Pas de `innerHTML` / `dangerouslySetInnerHTML`. Permission `storage` seule, aucun `host_permissions`. Aucune nouvelle dépendance. `src/styles/tokens.css` et `public/manifest.json` inchangés.
- **G7** L'exception du jeton (AGENTS.md) vaut dans le content script seulement, sans code injecté dans la page (pas de monde principal, pas de `<script>` inséré), en n'extrayant que la valeur du jeton d'accès (jamais de jeton de rafraîchissement ni d'autre cookie).
- Code, commentaires, UI, commits en français (apostrophe ’, espace avant `:`). Commits `type(T-xxx): …`.

| ID | Titre | Couche | Agent | Dépend de | SC | [P] |
|---|---|---|---|---|---|---|
| T-001 | Types partagés `actions.ts` | logique | dev-core | — | SC-015, SC-018 | [P] |
| T-002 | Schéma v2, `idsSite`, migration, exports v1 | données | dev-core | — | SC-019, SC-024 | [P] |
| T-003 | Lint : réseau, cookies/stockage du site, aléatoire | infra | dev-infra | — | SC-001, SC-010, SC-017, SC-018 | [P] |
| T-004 | Table du contrat (types, livrée vide) | logique | dev-core | T-001 | SC-017, SC-020 | [P] |
| T-005 | Registre des étiquettes | logique | dev-core | T-001 | SC-014, SC-026 | [P] |
| T-006 | Journal | logique | dev-core | T-001 | SC-015, SC-016, SC-026 | [P] |
| T-007 | Protocole de messages (liste blanche) | logique | dev-core | T-001 | SC-015, SC-018 | [P] |
| T-008 | `jeton.ts` isolé + test de confinement | logique | dev-core | T-003 | SC-018, SC-017 | [P] |
| T-009 | `lot.ts` : garde-fous, étiquettes, défausses, écartées | logique | dev-core | T-001, T-002, T-004, T-005 | SC-003, SC-004, SC-005, SC-007, SC-024, SC-025 | [P] |
| T-010 | `stockage.ts` : clés registre, journal, exécution | données | dev-core | T-002, T-005, T-006 | SC-011, SC-015, SC-026 | [P] |
| T-011 | `file.ts` : exécuteur à cadence fixe | logique | dev-core | T-001, T-006 | SC-010, SC-011, SC-012, SC-022, SC-023 | [P] |
| T-012 | `lot.ts` : enchères | logique | dev-core | T-009 | SC-006, SC-025 | [P] |
| T-013 | `revision.ts` : revérification et application des résultats | logique | dev-core | T-009, T-005 | SC-014, SC-022 | [P] |
| T-014 | Exécution côté page + port côté content script (sans requête) | logique | dev-core | T-007, T-010, T-011 | SC-013, SC-020, SC-023 | [P] |
| T-015 | UI : aperçu du lot, `Synchronisation.tsx`, montage `App.tsx` | ui | dev-ui | T-004, T-009, T-010 | SC-008, SC-020, SC-021, SC-025 | [P] |
| T-016 | UI : `Journal.tsx` | ui | dev-ui | T-006, T-010 | SC-015, SC-016, SC-021 | [P] |
| T-017 | UI : exécution, progression, `DialogueDefausse.tsx`, montage du journal | ui | dev-ui | T-012, T-013, T-014, T-015, T-016 | SC-009, SC-012, SC-013, SC-016, SC-021 | — |
| T-018 | E2e sans requête (site simulé bloquant) | tests | dev-test | T-017 | SC-008, SC-019, SC-020, SC-021, SC-023, SC-025 | — |
| T-019 | `reseau.ts` + `executant.ts` branché (table vide) | logique | dev-core | T-018, T-004, T-007, T-008, T-014 | SC-011, SC-017, SC-018 | — |
| T-020 | Test de non-fuite du jeton | tests | dev-test | T-019, T-011, T-006, T-008 | SC-015, SC-018 | [P] |
| T-021 | `jeton.ts` : lecture réelle (**bloquée**) | logique | dev-core | T-019, T-020 | SC-002, SC-018 | [P] |
| T-022 | Défausse : entrée du contrat (**bloquée**) | logique | dev-core | T-019 | SC-002, SC-009, SC-011, SC-014, SC-017 | [P] |
| T-023 | Enchère : entrée du contrat et réglages (**bloquée**) | logique | dev-core | T-019, T-012 | SC-002, SC-006, SC-011, SC-017 | [P] |
| T-024 | Étiquettes : entrées du contrat et réglages (**bloquée**) | logique | dev-core | T-019, T-009 | SC-002, SC-007, SC-011, SC-016, SC-017 | [P] |
| T-025 | Source des identifiants d'exemplaire (**bloquée**) | logique | dev-core | T-019, T-002 | SC-002, SC-024 | [P] |
| T-026 | E2e complet avec site simulé | tests | dev-test | T-020 à T-025 (tâches non arrêtées par SC-002) | SC-008, SC-009, SC-012, SC-013, SC-015, SC-016, SC-021 | — |

Couverture des SC : SC-001 (T-003, relevés) · 002 (T-021 à T-025) · 003/004/005 (T-009) · 006 (T-012, T-023) · 007 (T-009, T-024) · 008 (T-015, T-018, T-026) · 009 (T-017, T-022, T-026) · 010 (T-003, T-011) · 011 (T-010, T-011, T-019, T-022 à T-024) · 012 (T-011, T-017, T-026) · 013 (T-014, T-017, T-026) · 014 (T-005, T-013) · 015 (T-006, T-007, T-020) · 016 (T-006, T-016, T-017, T-024) · 017 (T-003, T-004, T-019) · 018 (T-003, T-008, T-020, T-021) · 019 (T-002, T-018) · 020 (T-014, T-015, T-018) · 021 (T-015, T-016, T-017, T-018) · 022 (T-011, T-013) · 023 (T-011, T-014, T-018) · 024 (T-002, T-009, T-025) · 025 (T-009, T-012, T-018) · 026 (T-005, T-006, T-010).

Contrôles : aucun fichier n'apparaît dans deux tâches d'une même vague (vérifié vague par vague) ; graphe acyclique (chaque dépendance pointe vers une vague strictement antérieure). Fichiers carrefour : `src/lib/collection.ts` (T-002 seul), `eslint.config.mjs` (T-003 seul), `src/lib/stockage.ts` (T-002 en V1, T-010 en V3), `src/lib/lot.ts` (T-009 en V3, T-012 en V4), `src/app/Synchronisation.tsx` (T-015 en V4, T-017 en V5), `src/content/executant.ts` et `src/content/index.ts` (T-014 en V4, T-019 en V7), `src/lib/jeton.ts` (T-008 en V2, T-021 en V8).

---

## T-001 — Types partagés `actions.ts`
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P]
- **SC couverts** : SC-015, SC-018 (aucun champ ne peut porter un jeton) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/actions.ts` (créé)
  - `tests/unit/actions.test.ts` (créé)
- **Critères d'acceptation**
  1. `src/lib/actions.ts` exporte `TYPES_ACTION` (`'lecture' | 'creation-etiquette' | 'retrait-etiquette' | 'pose-etiquette' | 'enchere' | 'defausse'`), `TypeAction`, `Action` (union discriminée par `type`, avec `idCarte`, paramètres typés, `idExemplaire` pour les actions par exemplaire), `Lot` (actions ordonnées + `ecartees`), `CarteEcartee` + `RaisonEcart` (`'non-reliee' | 'identifiant-en-conflit' | 'en-attente-place' | 'action-non-disponible' | 'prix-invalide' | 'prix-superieur-valeur' | 'valeur-absente' | 'nom-trop-long' | 'homonyme' | 'exemplaires-non-relies'`), `ResultatAction` (`classe: 'reussie' | 'echec' | 'arret' | 'inconnu'`, `codeHttp: number | null`, `cause` en libellé fixe), `EntreeJournal`, `Registre`, `EtatExecution`, `TypesDisponibles = ReadonlySet<TypeAction>`.
  2. Aucun type n'a de champ pouvant porter un jeton, un en-tête, un cookie ou un corps de réponse brut.
  3. Aucune dépendance à `chrome.*`.
- **Tests attendus**
  - `tests/unit/actions.test.ts` : `TYPES_ACTION` contient exactement les 6 types (AC1) ; `expectTypeOf` : `ResultatAction` et `EntreeJournal` n'ont aucune clé parmi `jeton`, `token`, `headers`, `entetes`, `cookie`, `corps`, `body` (AC2).
- **Brief de contexte**
  - *Pourquoi* : tout le lot (construction, file, journal, messages) partage ces types ; ils figent les frontières anti-fuite du jeton (SC-015, SC-018).
  - *État actuel* : `src/lib/collection.ts` définit `Carte`, `Statut`, `LIBELLES_STATUT` (l.8-20). Aucun type d'action n'existe.
  - *À faire* : types seuls (le seul code runtime est `TYPES_ACTION`). Une carte est identifiée par son `id` local `rareté|titre`. Les actions « par exemplaire » (pose, retrait, défausse, enchère) portent un seul `idExemplaire: string` (un `user_card_id`). `EntreeJournal` : horodatage ISO 8601, `idCarte`, `titre`, `type`, paramètres (nom d’étiquette ou prix), résultat (`reussie | echouee | passee | interrompue | inconnu | en-cours`), `codeHttp` (nullable), `idLot`. **Pas** d’identifiant d’exemplaire sur le site dans l’entrée de journal (SC-015). `Registre` : étiquettes créées (nom → id d’étiquette du site) et couples (idExemplaire, nom d’étiquette) ; `version` numérique.
  - *Contrats* : AGENTS.md (code en français, TS strict). G3.
  - *Pièges* : ne pas importer `chrome`. Pas de classe ; types et constantes.
  - *Vérifier* : `npm run check && npm run build`

## T-002 — Schéma v2, `idsSite`, migration, exports v1
- **Couche** : données · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P]
- **SC couverts** : SC-019, SC-024 (champ) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/collection.ts`
  - `src/lib/exports.ts`
  - `src/lib/stockage.ts`
  - `tests/unit/collection.test.ts`
  - `tests/unit/exports.test.ts`
- **Critères d'acceptation**
  1. `VERSION_SCHEMA` vaut 2 ; chaque `Carte` porte `idsSite: string[] | null` (`null` = inconnu, jamais de tableau vide, identifiants distincts).
  2. `migrerCollection` v1 → v2 conserve 100 % des champs existants et met `idsSite: null` ; idempotente (v2 inchangée).
  3. `analyserStockage` accepte v1 (migrée) et v2 ; `analyserImport` n’accepte que le fichier d’échange `version: 1` et ignore tout `idsSite` présent.
  4. `fusionnerImport` conserve `idsSite` de la carte existante.
  5. `versJson` écrit `version: 1` sans `idsSite` ; un export est relisible par l’import ; colonnes CSV inchangées.
  6. Fonctions d’accès exportées : `idsSiteDe(carte)`, `definirIdsSite(collection, id, ids)`, `retirerIdSite(collection, id, idExemplaire)` (remet `null` au dernier), `ajouterIdSite`. Identifiant valide : chaîne non vide, ≤ 200 caractères.
  7. `stockage.ts` migre à la lecture sans écraser une donnée illisible (comportement actuel conservé).
- **Tests attendus**
  - `tests/unit/collection.test.ts` : migration v1→v2 propriété par propriété, idempotence (AC2) ; import v1 avec `idsSite` ignoré, `version: 2` refusée à l’import (AC3) ; fusion conserve `idsSite` (AC4) ; accesseurs, tableau vide → `null`, doublon/identifiant invalide rejetés (AC1, AC6).
  - `tests/unit/exports.test.ts` : `versJson` en v1 sans `idsSite`, aller-retour, CSV identique (AC5).
  - Le comportement « illisible jamais écrasé » (AC7) est testé avec un faux `chrome.storage` dans `tests/unit/collection.test.ts` si `stockage.ts` s’y prête, sinon par une fonction pure extraite et exportée de `collection.ts`.
- **Brief de contexte**
  - *Pourquoi* : SC-019 (migration sans perte) et SC-024 (le modèle des identifiants d’exemplaire, `user_card_id` désigne un exemplaire, H36/H43).
  - *État actuel* : `collection.ts:3` `VERSION_SCHEMA = 1` ; `Carte` l.22 ; `analyserImport` l.104 (teste `version !== VERSION_SCHEMA`) ; `fusionnerImport` l.124 ; `terminerEnchere` l.159. `exports.ts` : `versJson`, CSV. `stockage.ts` : seul module qui touche `chrome.storage.local`.
  - *À faire* : introduire `VERSION_ECHANGE = 1` pour le fichier d’échange, séparer `analyserStockage` / `analyserImport`. Les autres fonctions (`appliquerEdition`, `retirerCarte`, `terminerEnchere`) conservent `idsSite`. Les identifiants viennent uniquement du site (G5 : le modèle est encapsulé par les fonctions d’accès, pour pouvoir changer sans toucher aux appelants).
  - *Contrats* : AGENTS.md « le schéma de stockage porte un numéro de version : tout changement fournit une migration » ; fichier d’échange `{ "version": 1, "cartes": [...] }`. Aucune donnée réelle dans les tests (fixtures fictives).
  - *Pièges* : `chrome.*` absent dans Vitest ; `collection.ts` reste sans `chrome.*`. Ne pas toucher aux colonnes CSV.
  - *Vérifier* : `npx vitest run tests/unit/collection.test.ts tests/unit/exports.test.ts && npm run check && npm run build`

## T-003 — Lint : réseau, cookies/stockage du site, aléatoire
- **Couche** : infra · **Agent** : dev-infra
- **Dépend de** : — · **Parallélisable** : [P]
- **SC couverts** : SC-001 (vérification `git check-ignore`), SC-010 (aléatoire), SC-017, SC-018 (b) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `eslint.config.mjs`
  - `tests/unit/lint-reseau.test.ts` (créé)
- **Critères d'acceptation**
  1. `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` sont interdits dans tout `src/` **sauf `src/lib/reseau.ts`** (formes `globalThis.fetch`, `window['fetch']` comprises).
  2. `document.cookie`, `cookieStore`, `localStorage`, `sessionStorage`, `indexedDB` (y compris `window['localStorage']`, `globalThis.document.cookie`) sont interdits dans tout `src/` **sauf `src/lib/jeton.ts`**, où seule la LECTURE est permise (T-021 l’ajoute). Les ÉCRITURES sont interdites partout, `jeton.ts` compris : `setItem`, `removeItem`, `clear`, affectation `document.cookie =`, `cookieStore.set` / `cookieStore.delete`, écritures `indexedDB`.
  3. `import … from '…/jeton'` est interdit sauf depuis `src/lib/reseau.ts` (`no-restricted-imports`/patterns) ; `no-console` actif dans `src/lib/jeton.ts` et `src/lib/reseau.ts`.
  4. `Math.random`, `crypto.getRandomValues`, `crypto.randomUUID` interdits dans `src/lib/file.ts`, `src/lib/reseau.ts`, `src/lib/jeton.ts`.
  5. `click`, `submit`, `requestSubmit`, `dispatchEvent`, `focus` restent interdits dans le code exécuté sur le site ; `npm run lint` passe sur le code existant.
  6. `git check-ignore captures-site/` renvoie le chemin (vérification, rapportée dans la PR ; si ce n’est pas le cas, escalader : `.gitignore` n’est pas dans la liste).
- **Tests attendus**
  - `tests/unit/lint-reseau.test.ts` : lance l’API `ESLint` (dépendance existante) sur des fichiers témoins en mémoire (`lintText` avec `filePath` simulé) : `fetch` dans `src/lib/x.ts` → erreur, dans `src/lib/reseau.ts` → OK (AC1) ; chaque accès cookie/stockage hors `jeton.ts` → erreur, lecture dans `jeton.ts` → OK, écriture (`setItem`, `removeItem`, `clear`, `document.cookie =`, `cookieStore.set`) dans `jeton.ts` → erreur (AC2) ; import de `jeton` depuis `src/content/x.ts` et `src/app/x.tsx` → erreur, depuis `reseau.ts` → OK ; `console.log` dans `reseau.ts` → erreur (AC3) ; `Math.random` dans `file.ts` → erreur (AC4) ; `.click()` dans `src/content/` → erreur (AC5).
- **Brief de contexte**
  - *Pourquoi* : rétablir, en plus strict, le garde-fou réseau retiré le 2026-11-07, et préparer le confinement du jeton (SC-017, SC-018).
  - *État actuel* : `eslint.config.mjs:14` et `:25` configurent `no-restricted-syntax` ; `:31` interdit `click`, `submit`, `requestSubmit`, `dispatchEvent`, `focus` dans le code du site. Aucune règle réseau ni stockage.
  - *À faire* : combiner `no-restricted-globals`, `no-restricted-properties`, `no-restricted-syntax` (sélecteurs pour les accès par chaîne/globalThis) et `no-restricted-imports`, avec des blocs `files:`/`ignores:` par chemin. Les exceptions (`reseau.ts`, `jeton.ts`) sont posées dès maintenant, même si ces fichiers n’existent pas encore. Dans `jeton.ts`, l’exception ne couvre que la lecture : un bloc `files: ['src/lib/jeton.ts']` réactive l’interdiction des écritures listées en AC2.
  - *Contrats* : AGENTS.md (lint). G3, G4, G6, G7. Le test sert de modèle au futur `confinement-jeton.test.ts` (T-008).
  - *Pièges* : ne pas casser les tests (`tests/` hors `src/`), ni `src/app/` ; vérifier que le code existant passe. Les règles par sélecteur AST doivent couvrir `window['localStorage']`.
  - *Vérifier* : `npx vitest run tests/unit/lint-reseau.test.ts && npm run check && git check-ignore captures-site/`

## T-004 — Table du contrat (types, livrée vide)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001 · **Parallélisable** : [P]
- **SC couverts** : SC-017, SC-020 (table vide) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/contrat.ts` (créé)
  - `src/lib/contrat/lecture.ts` (créé)
  - `src/lib/contrat/defausse.ts` (créé)
  - `src/lib/contrat/enchere.ts` (créé)
  - `src/lib/contrat/etiquettes.ts` (créé)
  - `tests/unit/contrat.test.ts` (créé)
- **Critères d'acceptation**
  1. `contrat.ts` exporte `EntreeContrat` (`methode`, `modeleChemin`, `construireChemin(action)`, `construireCorps(action)`, `auth: { entete: string } | null`, `validerReponse(statut, json) → 'reussie' | 'hors-contrat'`), `TableContrat = Partial<Record<TypeAction, EntreeContrat>>`, `TABLE_CONTRAT` et `typesDisponibles(table = TABLE_CONTRAT): TypesDisponibles`.
  2. `TABLE_CONTRAT` est **vide** : chaque fichier `contrat/<type>.ts` exporte, pour l’instant, `export const ENTREES_xxx: Partial<Record<TypeAction, EntreeContrat>> = {}`, agrégés par `contrat.ts`. `typesDisponibles()` renvoie un ensemble vide.
  3. `contrat.ts` ne contient aucune URL ni nom d’en-tête.
- **Tests attendus**
  - `tests/unit/contrat.test.ts` : table vide → `typesDisponibles()` vide (AC2) ; avec une table factice injectée, ne renvoie que les types présents (AC1) ; `grep`-test : le source de `contrat.ts` ne contient pas `/api/` ni `/rest/` (AC3).
- **Brief de contexte**
  - *Pourquoi* : toute action du lot dépend de cette table (SC-017) ; vide, elle rend chaque type « non disponible » (SC-020) sans deviner le contrat. Un fichier par famille permet de remplir les trois types en parallèle plus tard (T-022 à T-025).
  - *État actuel* : rien. `contrat-api.md` liste les chemins mais ils ne doivent PAS être codés ici.
  - *À faire* : types et agrégateur uniquement. `construireChemin` doit recevoir un identifiant déjà validé et encoder avec `encodeURIComponent` (la validation est dans `reseau.ts`, T-019).
  - *Contrats* : G4, G5. Aucun chemin n’entre dans la table avant le relevé de ses points.
  - *Pièges* : ne pas importer `jeton.ts` ici (interdit par le lint, T-003). Le champ `auth` ne contient que le nom d’en-tête, jamais une valeur.
  - *Vérifier* : `npx vitest run tests/unit/contrat.test.ts && npm run check && npm run build`

## T-005 — Registre des étiquettes
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001 · **Parallélisable** : [P]
- **SC couverts** : SC-014 (registre), SC-026 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/registre.ts` (créé)
  - `tests/unit/registre.test.ts` (créé)
- **Critères d'acceptation**
  1. Fonctions pures : `registreVide()`, `enregistrerEtiquette(r, nom, idEtiquette)`, `poserCouple(r, idExemplaire, nom)`, `retirerCouple`, `couplesDe(r, idExemplaire)`, `purgerExemplaire(r, idExemplaire)`, `purgerCarte(r, idsExemplaires)`, `validerRegistre(brut)` (rejet de toute forme inattendue, identifiants non vides ≤ 200).
  2. Au plus 2 couples par exemplaire relié, plus une entrée par étiquette créée (borne SC-026) : un 3e couple pour un même exemplaire est refusé.
  3. `validerRegistre` renvoie `null` pour un objet illisible et n’altère jamais l’entrée.
- **Tests attendus**
  - `tests/unit/registre.test.ts` : ajout/retrait/purge (AC1), borne 2 couples (AC2), formes invalides rejetées (AC3), immuabilité.
- **Brief de contexte**
  - *Pourquoi* : seul le registre autorise les retraits ; l’extension ne touche jamais une étiquette qu’elle n’a pas posée (H7, SC-007 (e)).
  - *État actuel* : rien.
  - *À faire* : structure `{ version: 1, etiquettes: Record<string,string>, couples: Array<{ex: string, nom: string}> }` (ou équivalent typé par `Registre` de `actions.ts`). Logique pure ; la persistance est en T-010.
  - *Contrats* : AGENTS.md (logique sans `chrome.*`). Données fictives.
  - *Pièges* : ne jamais étaler un objet reçu dans le résultat (construction champ par champ).
  - *Vérifier* : `npx vitest run tests/unit/registre.test.ts && npm run check`

## T-006 — Journal
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001 · **Parallélisable** : [P]
- **SC couverts** : SC-015, SC-016 (couple le plus récent), SC-026 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/journal.ts` (créé)
  - `tests/unit/journal.test.ts` (créé)
- **Critères d'acceptation**
  1. `ouvrirEntree(journal, champs)` ajoute une entrée « en cours » ; `completerEntree(journal, id, resultat)` la complète ; `cloreInterrompues(journal, idLot)` clôt les « en cours » en « interrompue, résultat inconnu, à vérifier sur le site ».
  2. FIFO : au-delà de 1 000 entrées, la plus ancienne sort.
  3. Les entrées sont construites champ par champ à partir d’une liste fermée (horodatage ISO 8601, idCarte, titre, type, paramètres, résultat, code HTTP) ; une clé inconnue de l’entrée reçue n’est jamais recopiée ; aucun identifiant d’exemplaire du site, aucun jeton, aucun en-tête, aucun corps brut.
  4. `validerJournal(brut)` rejette toute forme inattendue ; `dernierePoseParCouple(journal)` renvoie l’entrée de pose réussie la plus récente par couple (carte, étiquette).
  5. Avec 1 000 entrées aux longueurs maximales (titre 300, ami 300), le JSON sérialisé pèse ≤ 1 Mo.
- **Tests attendus**
  - `tests/unit/journal.test.ts` : AC1 à AC5 ; entrée avec champ parasite (`jeton`, `authorization`) → champ absent de la sortie sérialisée.
- **Brief de contexte**
  - *Pourquoi* : trace locale de tout ce que l’extension fait sur le compte (G3 spec, SC-015) ; l’entrée « en cours » précède l’envoi pour laisser une trace d’une interruption (H23).
  - *État actuel* : rien.
  - *À faire* : logique pure, horloge injectée (`maintenant: () => Date`). Identifiant d’entrée : compteur + horodatage, jamais `crypto.randomUUID`.
  - *Contrats* : G3, G4. Libellés d’échec en français fixes (« résultat inconnu, à vérifier sur le site », « jeton de session absent : reconnectez-vous sur le site »).
  - *Pièges* : `chrome.*` absent ; persistance en T-010.
  - *Vérifier* : `npx vitest run tests/unit/journal.test.ts && npm run check`

## T-007 — Protocole de messages (liste blanche)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001 · **Parallélisable** : [P]
- **SC couverts** : SC-015, SC-018 (c) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/messages.ts` (créé)
  - `tests/unit/messages.test.ts` (créé)
- **Critères d'acceptation**
  1. Messages du port page ↔ content script : `bonjour` (content → page), `ordre` (page → content : type + paramètres), `resultat` (content → page : `ResultatAction`), `arret`.
  2. `validerOrdre(brut)` et `validerResultat(brut)` appliquent une liste blanche de champs : tout champ inconnu = message rejeté (`null`) ; identifiants non vides ≤ 200 caractères ; type ∈ `TYPES_ACTION`.
  3. Aucun message n’a de champ libre (pas de `unknown`, `any`, `Record<string, unknown>` dans les types exportés).
- **Tests attendus**
  - `tests/unit/messages.test.ts` : ordre valide accepté ; champ parasite (`headers`, `token`) rejeté ; type inconnu rejeté ; résultat avec corps brut rejeté (AC1, AC2) ; `expectTypeOf` sur l’absence de champ libre (AC3).
- **Brief de contexte**
  - *Pourquoi* : la page ne voit jamais le jeton (G3) ; la liste blanche garantit qu’aucun canal entre contextes ne peut le transporter.
  - *État actuel* : rien ; `src/background.ts` n’est pas concerné.
  - *À faire* : fonctions pures de validation + constructeurs de messages. Pas de `chrome.runtime` ici.
  - *Contrats* : G3. Le résultat contient `classe`, `codeHttp`, `cause` fixe, rien d’autre.
  - *Pièges* : le service worker n’y participe pas.
  - *Vérifier* : `npx vitest run tests/unit/messages.test.ts && npm run check`

## T-008 — `jeton.ts` isolé + test de confinement
- **Couche** : logique · **Agent** : dev-core (tests écrits d’abord par dev-test)
- **Dépend de** : T-003 · **Parallélisable** : [P]
- **SC couverts** : SC-018 (a, b), SC-017 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/jeton.ts` (créé)
  - `tests/unit/jeton.test.ts` (créé)
  - `tests/unit/confinement-jeton.test.ts` (créé)
- **Critères d'acceptation**
  1. `jeton.ts` exporte `enteteAuthentification(url: string, origineOnglet: string, nomEntete: string, source: SourceJeton = SOURCE_NON_RELEVEE): { nom: string; valeur: string } | null`. **Il ne lit encore aucun stockage, cookie ni variable de la page** : `SOURCE_NON_RELEVEE` renvoie toujours `null` (l’endroit du jeton n’est pas relevé, G5).
  2. Refuse (renvoie `null` sans appeler `source`) si l’origine de `url` n’est pas `origineOnglet` ou si `origineOnglet` n’est pas `https://www.wiki-masters.com`.
  3. Aucun cache : `source` est appelée à chaque appel. Aucune variable de module ne garde la valeur. Aucun `console`, aucune écriture, aucun `chrome.*`.
  4. Le test de confinement lance ESLint sur des fichiers témoins hors `jeton.ts` et exige une erreur pour chacun : `localStorage`, `window['sessionStorage']`, `globalThis.document.cookie`, `cookieStore`, `indexedDB`, import de `jeton.ts` depuis `src/content/executant.ts`, depuis `src/app/x.tsx`, depuis `src/lib/lot.ts` ; et aucune erreur pour l’import depuis `src/lib/reseau.ts`.
  5. Un test lit le source de `jeton.ts` et vérifie l’absence d’ÉCRITURES et de sorties : `setItem`, `removeItem`, `clear`, `document.cookie =`, `cookieStore.set` / `cookieStore.delete`, `fetch`, `chrome.`, `console`. Il n’interdit PAS la LECTURE (`localStorage`, `sessionStorage`, `document.cookie` en lecture), que T-021 ajoute : ce test doit rester vrai après T-021. Le lint (T-003 AC2) interdit de son côté les écritures même dans `jeton.ts`.
- **Tests attendus**
  - `tests/unit/jeton.test.ts` : source fictive qui renvoie un jeton témoin : valeur renvoyée seulement pour l’origine exacte (AC2) ; appels répétés → source appelée à chaque fois (AC3) ; défaut → `null` (AC1) ; test de source sans écriture ni sortie (AC5).
  - `tests/unit/confinement-jeton.test.ts` : AC4.
- **Brief de contexte**
  - *Pourquoi* : isoler d’abord le module et son confinement, avant tout appel au site. La lecture réelle est T-021 (bloquée par le relevé de l’endroit du jeton).
  - *État actuel* : le lint (T-003) interdit déjà les accès au stockage du site hors de ce fichier, les écritures partout, et l’import de ce fichier hors de `reseau.ts`.
  - *À faire* : l’API acceptant une `source` injectée permet les tests avec un jeton témoin fictif (ex. `'jeton-temoin-fictif'`). La valeur renvoyée n’est jamais journalisée ni mise dans un message d’erreur. Le test de source (AC5) ne doit contenir aucune assertion qui deviendrait fausse quand T-021 ajoutera la lecture.
  - *Contrats* : AGENTS.md « Ne jamais faire » (jeton lu en mémoire dans un seul module). G3, G5, G7.
  - *Pièges* : ne pas deviner où vit le jeton (cookie, stockage, mémoire de la page) ; si l’endroit exige du code dans le monde principal de la page, T-021 escalade (SC-002 (a), H41).
  - *Vérifier* : `npx vitest run tests/unit/jeton.test.ts tests/unit/confinement-jeton.test.ts && npm run check`

## T-009 — `lot.ts` : garde-fous, étiquettes, défausses, écartées
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001, T-002, T-004, T-005 · **Parallélisable** : [P]
- **SC couverts** : SC-003, SC-004, SC-005, SC-007 (a à e), SC-024, SC-025 (unitaire, partie) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/lot.ts` (créé)
  - `tests/unit/lot.test.ts` (créé)
- **Critères d'acceptation**
  1. Signature : `construireLot(collection, registre, config, disponibles: TypesDisponibles): Lot`. Fonction pure, sans `chrome.*`, sans appel à l’assistant de tri (SC-005 : le statut stocké décide).
  2. Une carte `favori: true` ne produit aucune action, ni étiquette, ni retrait, ni défausse, même avec étiquette obsolète au registre (SC-003) ; `a-trier` : idem (SC-004). Les étiquettes obsolètes de ces cartes sont signalées (H18).
  3. Carte `idsSite: null` → écartée « non reliée au site » ; identifiant présent dans deux cartes → les deux « identifiant en conflit » (H47).
  4. Étiquettes (SC-007) pour chaque exemplaire relié, hors favori / `a-trier` / `defausser` : « Statut · <libellé> » (y compris `vendre` en attente de place) ; si `echanger` et `ami` non vide après `trim` : « Ami · <nom> » ; retrait de tout couple du registre non attendu ; aucun doublon d’un couple déjà au registre ; aucun retrait d’un couple absent ; au plus une création par nom, avant la première pose, aucune pour un nom déjà au registre.
  5. Défausse : `defausser` → une action par exemplaire relié, dans l’ordre de `idsSite`, au plus `quantite` ; surplus d’exemplaires non reliés signalé « exemplaires non reliés au site » (H46) ; aucun retrait d’étiquette avant défausse (H19).
  6. Un type absent de `disponibles` n’est pas généré : la carte est listée « action non disponible ».
  7. Ordre H9 : lecture, créations, retraits, poses, enchères, défausses ; dans un groupe, `id` croissant puis ordre de `idsSite`.
  8. Les noms d’étiquette dépassant `config.longueurMaxEtiquette` (nombre ou `null` = inconnue) ne produisent aucune action et sont signalés « nom trop long » ; un nom qui reprend un homonyme connu (`config.nomsExistants`) est signalé.
  9. 5 000 cartes fictives : construction < 500 ms.
- **Tests attendus**
  - `tests/unit/lot.test.ts` : un test par SC (SC-003 à SC-005, SC-007 a–e, SC-024 « non reliée/conflit ») et par H16 à H19, H46 ; ordre H9 ; types non disponibles ; 5 000 cartes < 500 ms (AC9). Avec `disponibles` complet fictif pour exercer la logique.
- **Brief de contexte**
  - *Pourquoi* : le lot calcule ce qui sera envoyé ; une erreur ici a des effets définitifs (G4 spec).
  - *État actuel* : `src/lib/tri.ts` exporte `prixDepart` ; `collection.ts` exporte `LIBELLES_STATUT` (l.11), `Carte`, accesseurs `idsSite` (T-002) ; `actions.ts` (T-001) types ; `registre.ts` (T-005).
  - *À faire* : exporter `Config` (limites, `maxVentesSimultanees` lu pour T-012) et un utilitaire `exemplairesAttendus`. L’enchère est ajoutée par T-012 dans le même fichier ; laisser un point d’extension clair (`construireEncheres` appelé mais renvoyant `[]` jusque-là, ou fonction injectée) pour que T-012 n’ait qu’à l’implémenter.
  - *Contrats* : garde-fous non négociables de `spec.refined.md` § 4. Libellés avec typographie française. Aucune donnée réelle.
  - *Pièges* : tri stable pour la déterminisme ; aucun appel `chrome.*` ; ne pas muter la collection.
  - *Vérifier* : `npx vitest run tests/unit/lot.test.ts && npm run check`

## T-010 — `stockage.ts` : clés registre, journal, exécution
- **Couche** : données · **Agent** : dev-core
- **Dépend de** : T-002, T-005, T-006 · **Parallélisable** : [P]
- **SC couverts** : SC-011 (b, échec d’écriture), SC-015, SC-026 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/stockage.ts`
  - `tests/unit/stockage.test.ts` (créé)
- **Critères d'acceptation**
  1. Trois clés versionnées, absentes des exports : `registre`, `journal`, `execution` ; lecture validée (`validerRegistre`, `validerJournal`, validateur d’`EtatExecution`) ; une valeur illisible n’est jamais écrasée (renvoie une erreur lisible, pas de réécriture).
  2. Les écritures remontent l’échec (promesse rejetée / résultat `ok: false`) pour que l’exécuteur s’arrête (SC-011 (b)).
  3. Un signal de reconnexion (clé `signalSynchro`) lisible/écrivable pour la reconnexion des content scripts.
  4. Aucune clé ne contient de jeton ; `stockage.ts` reste le seul module hors `chrome.*` à toucher `chrome.storage.local`.
- **Tests attendus**
  - `tests/unit/stockage.test.ts` avec faux `chrome.storage.local` : lecture/écriture de chaque clé (AC1), donnée illisible non écrasée (AC1), échec d’écriture simulé remonté (AC2), clés énumérées ne contiennent aucune clé du type jeton (AC4).
- **Brief de contexte**
  - *Pourquoi* : persistance du registre, du journal et de l’état d’exécution (SC-015, SC-026) ; l’échec d’écriture arrête le lot.
  - *État actuel* : `stockage.ts` lit/écrit la collection (migration branchée par T-002). Registre et journal sont en logique pure (T-005, T-006).
  - *À faire* : réutiliser les validateurs ; ne pas dupliquer leur logique.
  - *Contrats* : AGENTS.md (`stockage.ts` seul module à toucher `chrome.storage.local`), G3.
  - *Pièges* : `chrome` est absent dans Vitest : fournir un faux dans le test (`globalThis.chrome`). Écritures concurrentes de plusieurs onglets : écrire des valeurs complètes, pas de fusion implicite.
  - *Vérifier* : `npx vitest run tests/unit/stockage.test.ts && npm run check && npm run build`

## T-011 — `file.ts` : exécuteur à cadence fixe
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-001, T-006 · **Parallélisable** : [P]
- **SC couverts** : SC-010, SC-011 (a, b), SC-012 (logique), SC-022 (appel), SC-023 (unitaire) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/file.ts` (créé)
  - `tests/unit/file.test.ts` (créé)
- **Critères d'acceptation**
  1. Dépendances **injectées** : `horloge` (now + attente à échéance absolue), `transport(ordre) → ResultatAction`, `confirmer(action) → 'defausser' | 'passer' | 'arreter'`, `reverifier(action) → 'ok' | 'passee'`, `appliquer(action, resultat)`, `journal` (ouvrir/compléter). Aucune dépendance à `chrome.*`, `fetch`, `jeton.ts`, `reseau.ts`.
  2. Cadence : début de requête = max(début précédent + 6 000 ms, réponse précédente, confirmation). Réponse et confirmation rapides → intervalle 6 000 ms (± 50), jamais < 5 950 ms ; au plus 10 requêtes dans toute fenêtre de 60 s ; action passée ou arrêtée faute de jeton n’avance pas la date.
  3. Une seule requête en vol ; une seule exécution (`demarrer` refusé tant qu’une exécution est en cours).
  4. Arrêt : 3e échec cumulé (passées exclues) ; première occurrence de 401, 403, 429, forme hors contrat, redirection, délai de 30 s, erreur réseau, échec d’écriture, jeton absent ; arrêt manuel (aucune requête émise plus de 100 ms après `arreter()`) ; résultat « inconnu » ne modifie pas l’état local.
  5. Ajout en fin de file possible pendant l’exécution (retraits du journal).
  6. Revérification avant chaque requête (`reverifier`) ; si « passée », aucune requête, journal « passée (carte modifiée) ».
  7. Défausse : `confirmer` est appelé avant toute requête de défausse ; « passer » → journal « passée », aucune requête ; « arreter » → fin comme un arrêt manuel.
  8. Aucun `Math.random` / `crypto.*` aléatoire ni délai variable (le lint de T-003 le vérifie).
- **Tests attendus**
  - `tests/unit/file.test.ts` (horloge simulée) : intervalle exact (AC2), cas réponse lente, fenêtre de 60 s, passées sans effet de cadence, 3 échecs, chaque cas d’arrêt immédiat (AC4), arrêt manuel < 100 ms, 2e `demarrer` refusé (AC3), ajout en fin de file (AC5), revérification (AC6), défausse sans confirmation = 0 requête (AC7).
- **Brief de contexte**
  - *Pourquoi* : cœur du rythme et des arrêts ; cadence fixe, aucune simulation de comportement humain (G4).
  - *État actuel* : `journal.ts` (T-006) fournit ouvrir/compléter. `actions.ts` fournit `ResultatAction`.
  - *À faire* : exporter `creerFile(deps)` avec `demarrer(actions)`, `ajouter(actions)`, `arreter()`, état observable (`EtatExecution`). Échéances en **temps absolu** (minuteurs ralentis en onglet masqué ne rendent jamais plus rapide). Délai de 30 s : l’abandon est côté transport (`reseau.ts`, T-019) ; la file traite le résultat `inconnu`.
  - *Contrats* : SC-010, SC-011, SC-012, SC-022, SC-023 de `spec.refined.md`. G2, G4.
  - *Pièges* : double émission après délai : jamais de relance. Pas de reprise automatique après interruption.
  - *Vérifier* : `npx vitest run tests/unit/file.test.ts && npm run check`

## T-012 — `lot.ts` : enchères
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-009 · **Parallélisable** : [P]
- **SC couverts** : SC-006, SC-025 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/lot.ts`
  - `tests/unit/lot-encheres.test.ts` (créé)
- **Critères d'acceptation**
  1. Places libres = `max(0, maxVentesSimultanees − nombre de cartes en-vente)` ; au plus ce nombre d’actions d’enchère, au plus une par carte, sur un seul exemplaire (le premier de `idsSite`, **seulement** si `config.lienCardId` l’autorise ; défaut : type « enchère » non disponible, H45).
  2. Prix de départ = `prixCible` sinon `prixDepart(valeurMarchande)` (`tri.ts`) ; tri par prix décroissant, puis valeur marchande décroissante, puis `id` croissant.
  3. Aucune enchère, avec raison dans `ecartees`, dans les cas : `valeurMarchande` absente (le repli par rareté ne suffit pas), prix absent ou < 1, prix ≥ valeur marchande, carte non reliée. Au-delà des places : « en attente d’une place libre », sans action. Type absent de `disponibles` : « action non disponible ».
  4. Pour un statut `vendre`, la carte garde ses étiquettes d’AC T-009 (H16).
  5. Construction du lot de 5 000 cartes fictives (avec enchères) < 500 ms.
- **Tests attendus**
  - `tests/unit/lot-encheres.test.ts` : places libres (y compris négatif → 0), tri et départage, chaque raison d’écart, attente de place, enchère non disponible (AC1 à AC5).
- **Brief de contexte**
  - *Pourquoi* : SC-006 ; une enchère est définitive côté site (non annulable par l’extension).
  - *État actuel* : T-009 a créé `construireLot` avec un point d’extension pour les enchères ; `tri.ts` exporte `prixDepart` ; `FileVente.tsx` calcule déjà les places libres de la même façon (à lire pour rester cohérent).
  - *À faire* : implémenter l’extension. Ne pas modifier `config/prix.ts` (T-023).
  - *Contrats* : H3, H4, H5, H13 à H15, H45. G5 : le lien `card_id` ↔ `user_card_id` n’est pas relevé, on ne le devine pas.
  - *Pièges* : `estPrixValide` accepte 0 (ne pas s’y fier).
  - *Vérifier* : `npx vitest run tests/unit/lot.test.ts tests/unit/lot-encheres.test.ts && npm run check`

## T-013 — `revision.ts` : revérification et application des résultats
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-009, T-005 · **Parallélisable** : [P]
- **SC couverts** : SC-014, SC-022 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/revision.ts` (créé)
  - `tests/unit/revision.test.ts` (créé)
- **Critères d'acceptation**
  1. `reverifierAction(action, collection, registre, config): 'ok' | 'passee'` : « passée » si la carte n’existe plus, est devenue favori, a changé de statut, de prix de départ ou d’ami, ou si l’identifiant d’exemplaire visé n’est plus dans son `idsSite`.
  2. `appliquerResultat(collection, registre, action, resultat) → { collection, registre }` : enchère réussie → statut `en-vente`, quantité et `idsSite` inchangés ; défausse réussie → identifiant retiré de `idsSite` (`null` s’il n’en reste aucun), couples purgés, quantité −1, carte retirée à 0 avec toutes ses entrées du registre ; création réussie → identifiant d’étiquette au registre ; pose / retrait → couple ajouté / retiré.
  3. Échec, passée, inconnu, arrêt : état strictement inchangé (même références).
- **Tests attendus**
  - `tests/unit/revision.test.ts` : chaque cas de AC1 (carte modifiée après l’aperçu : 0 requête) et AC2 ; AC3.
- **Brief de contexte**
  - *Pourquoi* : l’aperçu est figé (H24) ; la revérification rattrape les modifications faites ensuite, et l’état local ne bouge qu’après un succès.
  - *État actuel* : fonctions d’édition dans `collection.ts` (`retirerCarte` l.153, `terminerEnchere` l.159), accesseurs `idsSite` (T-002), `registre.ts` (T-005).
  - *À faire* : réutiliser les fonctions existantes, ne pas modifier `collection.ts`.
  - *Contrats* : SC-014, SC-022 ; H17 à H19, H38.
  - *Pièges* : une défausse d’un exemplaire ne doit jamais descendre la quantité sous 0.
  - *Vérifier* : `npx vitest run tests/unit/revision.test.ts && npm run check`

## T-014 — Exécution côté page + port côté content script (sans requête)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-007, T-010, T-011 · **Parallélisable** : [P]
- **SC couverts** : SC-013, SC-020 (conditions), SC-023 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/app/execution.ts` (créé)
  - `src/content/executant.ts` (créé)
  - `src/content/index.ts`
  - `tests/unit/execution.test.ts` (créé)
  - `tests/unit/executant.test.ts` (créé)
- **Critères d'acceptation**
  1. Côté content script : `executant.ts` ouvre un port `chrome.runtime.connect` et envoie `bonjour` ; reçoit un `ordre`, le valide (`messages.ts`) puis appelle une fonction `emettre` **injectée dont la valeur par défaut renvoie un résultat `echec` « action non disponible » sans aucune requête** (T-019 branchera `reseau.ts`). Les ordres ne viennent QUE du port de l’extension : jamais de `window.postMessage` / `addEventListener('message')`, ni d’un événement DOM ou `CustomEvent` de la page (la page du site est hostile). `src/content/index.ts` démarre `executant`. Ni `click`, ni `focus`, ni accès au stockage du site.
  2. Côté page (`execution.ts`) : un port n’est accepté que si `port.sender?.id === chrome.runtime.id` ET si `port.sender.url` a pour origine exacte `https://www.wiki-masters.com` ; sinon il est refusé (déconnecté) et ne compte pas. Comptage des ports acceptés et vivants par `sender.tab.id` → `nbOngletsWikiMasters` ; déconnexion pendant l’exécution = interruption (onglet fermé ou rechargé) ; clé de signal de reconnexion (via `stockage.ts`) pour qu’un onglet déjà ouvert se reconnecte.
  3. Verrou `navigator.locks` pour une seule exécution entre onglets de `collection.html` ; à l’ouverture, un état « en cours » sans verrou détenu est clos « interrompue » (SC-013) via `cloreInterrompues`.
  4. `execution.ts` fournit à `file.ts` le `transport` (ordre → port → résultat classé) et expose raisons de désactivation de « Lancer » : aucun onglet, plusieurs onglets, exécution en cours.
  5. Fermer ou recharger `collection.html` interrompt l’exécution, qui ne reprend jamais seule.
- **Tests attendus**
  - `tests/unit/execution.test.ts` (faux `chrome.runtime`, faux `navigator.locks`, faux stockage) : comptage 0/1/2 onglets, déconnexion → interruption, second `demarrer` refusé, clôture « interrompue » au démarrage (AC2, AC3, AC5) ; port avec `sender.id` étranger ou absent, `sender.url` d’une autre origine (ex. `https://www.wiki-masters.com.exemple.test`, `http://www.wiki-masters.com`) → refusé et non compté (AC2).
  - `tests/unit/executant.test.ts` : ordre invalide rejeté ; ordre valide → `emettre` par défaut → résultat « action non disponible », aucun `fetch` appelé (espion) (AC1) ; un `window.postMessage` ou un `CustomEvent` portant un ordre valide est ignoré : `emettre` n’est pas appelé (AC1).
- **Brief de contexte**
  - *Pourquoi* : pose le pilotage page ↔ content script avant tout appel au site ; ici encore **aucune requête** n’est émise.
  - *État actuel* : `src/content/index.ts` lit les cartes de `/collection` et pose les repères (`lecteur.ts`). `src/background.ts` ne change pas. `file.ts` (T-011) attend un `transport` injecté.
  - *À faire* : `emettre` est un paramètre de `demarrerExecutant({ emettre })` ; cadrage de compatibilité avec la lecture existante (ne pas casser `index.ts`). Le content script n’écoute que le port ouvert par lui-même (`chrome.runtime`) ; aucun écouteur `message` sur `window`, aucun écouteur d’événement personnalisé.
  - *Contrats* : architecture du plan (page pilote, content script émet, service worker inchangé et éphémère : aucun état en mémoire). Identifiant de lot : horodatage + compteur. G2, G3, G6, G7.
  - *Pièges* : `chrome.*`, `navigator.locks` absents dans Vitest ; content script « orphelin » après rechargement de l’extension (message invitant à recharger l’onglet) ; pas de `chrome.tabs`.
  - *Vérifier* : `npx vitest run tests/unit/execution.test.ts tests/unit/executant.test.ts && npm run check && npm run build`

## T-015 — UI : aperçu du lot, `Synchronisation.tsx`, montage `App.tsx`
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-004, T-009, T-010 · **Parallélisable** : [P]
- **SC couverts** : SC-008 (rendu), SC-020, SC-021, SC-025 · **Règles design** : D-01 à D-18, D-28 à D-31, D-33 à D-42
- **Fichiers concernés** (liste fermée) :
  - `src/app/Synchronisation.tsx` (créé)
  - `src/app/App.tsx`
  - `tests/unit/synchronisation.test.ts` (créé, logique pure extraite : libellés, totaux, raisons de désactivation, pagination)
- **Critères d'acceptation**
  1. Section « Synchronisation avec WikiMasters » avec bandeau de risque (préfixe « ! », règles § 3, CGU § 6, `robots.txt` « Disallow: /api/ », risque accepté le 07/11/2026) placé **avant** « Lancer » dans l’ordre du document.
  2. Aperçu : tableau (carte rareté + titre, type d’action, détail : nom d’étiquette, prix de départ et valeur marchande, « défausse » avec « exemplaire k sur n »), totaux par type, durée estimée (nombre de requêtes × 6 s, arrondi à la minute supérieure), cartes écartées avec raison, cadence « 10 actions par minute · arrêt après 3 erreurs ».
  3. « Lancer les N actions » désactivé (`aria-disabled` + `aria-describedby` vers la raison) : aucun onglet, plusieurs onglets (« Plusieurs onglets WikiMasters sont ouverts : gardez-en un seul. »), exécution en cours, aucune action disponible (table vide). Les actions de type non disponible sont listées « action non disponible » et ne comptent pas dans N. Lot sans action : « Aucune action à envoyer ».
  4. Lot calculé une fois (mémoïsé) à l’ouverture de l’aperçu, rendu paginé, totaux sur tout le lot.
  5. **Ouvrir l’aperçu et cliquer sur un bouton désactivé n’émet aucune requête et ne lit pas le jeton.** Dans ce lot, « Lancer » appelle un `onLancer` fourni en prop (câblé en T-017).
  6. Navigable au clavier, cibles ≥ 44 px, aucun `innerHTML`, texte non fiable rendu avec `break-words`, aucune couleur en dur.
- **Tests attendus**
  - `tests/unit/synchronisation.test.ts` : libellés, durée (1 à 6 actions → 1 min, 11 → 2 min), raisons de désactivation, pagination (AC2 à AC4).
  - E2e et captures dans T-018 (AC1, AC3, AC5, AC6).
- **Brief de contexte**
  - *Pourquoi* : voir exactement ce qui sera envoyé avant d’agir (G2 spec), 0 requête tant que « Lancer » n’est pas activé.
  - *État actuel* : `src/app/App.tsx` monte la page de gestion ; `FileVente.tsx` donne les conventions de composant (`React.FC` + export par défaut, un par fichier, `CLASSE_BOUTON`). `lot.ts` (T-009/T-012) produit `Lot` ; `contrat.ts` (T-004) fournit `typesDisponibles()` (vide aujourd’hui).
  - *À faire* : suivre `design.md` (section « Aperçu du lot », « Bandeau de risque », « Boutons ») ; D-04 : boutons nouveaux avec `border-muted` / `border-paper`. Ne pas modifier `FileVente.tsx` ni `tokens.css` (D-01). La zone d’exécution et le journal sont montés en T-017.
  - *Contrats* : D-xx ci-dessus ; AGENTS.md (UI en français, typographie ’ et espaces avant `:`). G2, G6.
  - *Pièges* : 5 000 cartes (mémoïser, paginer) ; contrastes AA dans les 2 thèmes (D-34).
  - *Vérifier* : `npx vitest run tests/unit/synchronisation.test.ts && npm run check && npm run build`

## T-016 — UI : `Journal.tsx`
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-006, T-010 · **Parallélisable** : [P]
- **SC couverts** : SC-015, SC-016, SC-021 · **Règles design** : D-05, D-19 à D-27, D-30 à D-32, D-35 à D-44
- **Fichiers concernés** (liste fermée) :
  - `src/app/Journal.tsx` (créé)
  - `src/app/DialogueVider.tsx` (créé)
  - `tests/unit/journal-ui.test.ts` (créé, logique pure extraite)
- **Critères d'acceptation**
  1. Liste (`<ol>`) horodatée : carte, type, paramètres, résultat en toutes lettres, code HTTP. Texte non fiable en texte brut.
  2. « Retirer l’étiquette » sur la pose réussie la plus récente de chaque couple (carte, étiquette) dont un exemplaire porte encore l’étiquette au registre ; `aria-label` unique (D-30) ; désactivé avec raison (sans onglet WikiMasters, ou type « retrait » non disponible — **vrai aujourd’hui**). Clic → `onRetirer(couple)` (prop câblée en T-017).
  3. Enchères et défausses réussies : mention « Non annulable par l’extension », aucun bouton d’annulation.
  4. « Vider » ouvre `DialogueVider` (D-32, focus piégé, Échap = Annuler) ; vider ne touche ni au registre ni à la collection.
  5. Clavier seul ; 44 px ; contrastes AA.
- **Tests attendus**
  - `tests/unit/journal-ui.test.ts` : sélection des entrées avec bouton, raisons de désactivation, mentions (AC2, AC3).
  - E2e et captures dans T-018 et T-026.
- **Brief de contexte**
  - *Pourquoi* : trace consultable de tout ce que l’extension a fait (G3 spec) et geste manuel de retrait.
  - *État actuel* : `journal.ts` (T-006) fournit `dernierePoseParCouple` ; aucune UI de journal.
  - *À faire* : composant contrôlé par props (`entrees`, `registre`, `retraitDisponible`, `ongletPret`, `onRetirer`, `onVider`). Le piège de focus du dialogue « Vider » est dans `src/app/` (autorisé). Pas de bibliothèque de focus.
  - *Contrats* : `design.md` sections « Journal », « Dialogue Vider le journal ». D-05, D-41, D-44.
  - *Pièges* : `Journal.tsx` n’est pas monté ici (montage en T-017 pour éviter un conflit sur `Synchronisation.tsx`).
  - *Vérifier* : `npx vitest run tests/unit/journal-ui.test.ts && npm run check && npm run build`

## T-017 — UI : exécution, progression, `DialogueDefausse.tsx`, montage du journal
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-012, T-013, T-014, T-015, T-016 · **Parallélisable** : —
- **SC couverts** : SC-009, SC-012, SC-013, SC-016, SC-021 · **Règles design** : D-10 à D-12, D-19 à D-27, D-32, D-35 à D-39, D-43, D-44
- **Fichiers concernés** (liste fermée) :
  - `src/app/Synchronisation.tsx`
  - `src/app/DialogueDefausse.tsx` (créé)
  - `tests/unit/dialogue-defausse.test.ts` (créé, logique pure : focus initial, résolution des touches)
- **Critères d'acceptation**
  1. « Lancer » câble `onLancer` : construit `creerFile` (T-011) avec `transport` et verrou de `execution.ts` (T-014), `reverifier` / `appliquer` de `revision.ts` (T-013), stockage via `stockage.ts`. Tant que la table du contrat est vide, « Lancer » reste désactivé (AC3 de T-015) : aucune requête.
  2. Zone d’exécution : `role="status"` + `aria-live="polite"`, barre `role="progressbar"`, « En cours : k / N · e erreurs », « Arrêter » ; Échap arrête quand le focus est dans la zone et qu’aucun dialogue n’est ouvert. États de fin : terminé, arrêté (avec cause en libellé fixe), interrompu.
  3. `DialogueDefausse` : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, focus piégé, focus initial sur « Passer », Échap = Passer, clic hors boîte sans effet, trois boutons « Défausser cette carte » / « Passer » / « Arrêter le lot », focus rendu à l’origine ; « Défausser cette carte » n’est ni dans un formulaire ni déclenché par Entrée à l’ouverture (D-43).
  4. `Journal` monté dans la section ; « Retirer l’étiquette » ajoute les retraits à la file (fin de file si exécution en cours, sinon lot à part sans aperçu) ; désactivé tant que le type « retrait » est non disponible.
  5. Aucune animation ni transition (D-39).
- **Tests attendus**
  - `tests/unit/dialogue-defausse.test.ts` : focus initial, résolution Échap/Entrée (AC3).
  - E2e et captures dans T-018 (partie sans requête) et T-026 (parcours complet).
- **Brief de contexte**
  - *Pourquoi* : confirmer chaque défausse individuellement (G2) et pouvoir arrêter à tout moment (SC-012).
  - *État actuel* : `Synchronisation.tsx` (T-015) a l’aperçu et `onLancer` en prop ; `Journal.tsx` (T-016) ; `execution.ts` et `file.ts`.
  - *À faire* : ne modifier que les fichiers listés. Ne pas appeler `reseau.ts` ni `jeton.ts` (la page ne voit jamais le jeton, G3). La confirmation de défausse est fournie à `file.ts` via `confirmer`, qui ouvre le dialogue et retourne la décision.
  - *Contrats* : D-xx ci-dessus ; `design.md` sections « Zone d’exécution », « Dialogue de défausse ». G2, G6 (le piège de focus vit dans `src/app/`).
  - *Pièges* : fermer `collection.html` interrompt l’exécution (H26) ; dialogue modal et région live : une seule annonce par changement d’état.
  - *Vérifier* : `npx vitest run tests/unit/dialogue-defausse.test.ts && npm run check && npm run build`

## T-018 — E2e sans requête (site simulé bloquant)
- **Couche** : tests · **Agent** : dev-test
- **Dépend de** : T-017 · **Parallélisable** : —
- **SC couverts** : SC-008 (0 requête), SC-019, SC-020, SC-021, SC-023 (e2e partie), SC-025 (e2e) · **Règles design** : D-08, D-33
- **Fichiers concernés** (liste fermée) :
  - `tests/e2e/synchro-sans-requete.spec.ts` (créé)
  - `tests/e2e/site-simule.ts` (créé : helper `page.route`)
  - `tests/e2e/fixtures/collection-fictive.json` (créé)
  - `tests/e2e/fixtures/page-collection-fictive.html` (créé)
- **Critères d'acceptation**
  1. Le helper `site-simule.ts` sert une page `/collection` fictive sur `https://www.wiki-masters.com` et **abort toute autre requête** (y compris `/api/**` et `/rest/**` vers cette origine et toute autre origine) tout en **comptant** les requêtes tentées vers `/api/` et `/rest/`.
  2. Ouvrir l’aperçu : 0 requête vers `/api/` ou `/rest/` ; rappel du risque avant « Lancer » ; cartes écartées avec raison ; « Aucune action à envoyer » pour une collection vide.
  3. « Lancer » désactivé avec le bon message pour : 0 onglet WikiMasters, 1 onglet (désactivé car table vide), 2 onglets.
  4. Import / export JSON `version: 1` sans perte (`idsSite` absent de l’export).
  5. Aperçu de 5 000 cartes fictives affiché < 500 ms après le clic.
  6. Captures de l’aperçu et du journal à 375, 768 et 1280 px, thèmes clair et sombre, jointes à la PR.
  7. Un test échoue si une requête sortante autre que celles servies par `page.route` est détectée.
- **Tests attendus**
  - `tests/e2e/synchro-sans-requete.spec.ts` : AC2 à AC7.
- **Brief de contexte**
  - *Pourquoi* : prouver que rien ne part avant « Lancer » (SC-008) avant d’écrire le module réseau.
  - *État actuel* : le contexte navigateur vient de `tests/e2e/extension.ts` ; autres e2e existants dans `tests/e2e/`.
  - *À faire* : fixtures **écrites à la main**, fictives (titres, raretés inventés). `captures-site/` jamais lu ni committé.
  - *Contrats* : G1, G2. AGENTS.md (tests e2e : `tests/e2e/<sujet>.spec.ts`).
  - *Pièges* : l’extension doit être chargée ; deux onglets WikiMasters = deux pages routées ; le site simulé doit exposer un contenu compatible avec `lecteur.ts`.
  - *Vérifier* : `npm run test:e2e` (build compris)

## T-019 — `reseau.ts` + `executant.ts` branché (table vide)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-018, T-004, T-007, T-008, T-014 · **Parallélisable** : —
- **SC couverts** : SC-011 (transport), SC-017, SC-018 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/reseau.ts` (créé)
  - `src/content/executant.ts`
  - `tests/unit/reseau.test.ts` (créé)
- **Critères d'acceptation**
  1. `reseau.ts` est le **seul** module qui appelle `fetch` (injectable pour les tests : `emettre(ordre, { fetch, source, origineOnglet, table })`).
  2. Refus **sans rien émettre ni lire le jeton** : origine ≠ `https://www.wiki-masters.com`, type absent de la table (donc « non disponible »), méthode ou chemin hors table, identifiant non vide ≤ 200 caractères invalide.
  3. `encodeURIComponent` des identifiants (chemin et query). En-têtes fixés par le code : exactement `Content-Type`, `Accept`, et — **uniquement** si `entree.auth` est défini — l’en-tête nommé par la table, valeur obtenue de `jeton.ts`. Jamais `User-Agent`, `Referer`, `Origin`, `Cookie`. Un type sans `auth` n’appelle pas `jeton.ts`.
  4. `redirect: 'manual'`, `credentials: 'same-origin'`, délai 30 s par `AbortController`.
  5. Classement : 2xx conforme (`validerReponse`) → `reussie` ; 2xx non conforme → `arret` « hors contrat » ; 401/403/429 → `arret` ; redirection → `arret` ; autre non 2xx → `echec` ; délai ou erreur réseau → `inconnu`. Jeton absent pour un type qui l’exige → `arret` classé 401, **aucune requête**. Aucun corps brut, en-tête ou jeton dans le résultat ni dans un message d’erreur.
  6. `executant.ts` : `emettre` par défaut = `reseau.emettre` (le défaut « non disponible » de T-014 disparaît). Avec la table vide, tout ordre → résultat « action non disponible », 0 `fetch`.
- **Tests attendus**
  - `tests/unit/reseau.test.ts` (fetch et source de jeton **fictifs**, table factice injectée) : chaque refus avec compteurs `fetch`/`source` à 0 (AC2) ; encodage d’un identifiant contenant `/`, `?`, `#`, `%` (AC3) ; ensemble exact des noms d’en-têtes avec et sans `auth` (AC3) ; options de `fetch` (AC4) ; chaque classe de résultat (AC5) ; table réelle vide → aucun `fetch` (AC6).
- **Brief de contexte**
  - *Pourquoi* : premier module qui peut émettre vers le site ; il doit être verrouillé (SC-017) alors même qu’aucun type n’est disponible.
  - *État actuel* : `contrat.ts` (T-004) vide ; `jeton.ts` (T-008) renvoie `null` tant que T-021 n’est pas faite ; `executant.ts` (T-014) a un `emettre` injectable ; lint (T-003) autorise `fetch` uniquement dans `reseau.ts`.
  - *À faire* : aucun chemin ni en-tête codé en dur : tout vient de la table. Aucun `console`. Ne pas conserver la valeur du jeton dans une variable de module ni dans une erreur.
  - *Contrats* : G1 (aucun test ne contacte le vrai site), G3, G4, G5. SC-017, SC-018 de `spec.refined.md`.
  - *Pièges* : en-têtes ajoutés par le navigateur ≠ falsification (tester seulement ceux fixés par le code) ; redirection suivie par erreur = fuite potentielle vers une autre origine.
  - *Vérifier* : `npx vitest run tests/unit/reseau.test.ts && npm run check && npm run build`

## T-020 — Test de non-fuite du jeton
- **Couche** : tests · **Agent** : dev-test
- **Dépend de** : T-019, T-011, T-006, T-008 · **Parallélisable** : [P]
- **SC couverts** : SC-015, SC-018 (c) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `tests/unit/non-fuite-jeton.test.ts` (créé)
- **Critères d'acceptation**
  1. Un lot complet (file + messages + executant + reseau + journal + registre, transport, stockage et horloge **fictifs**, table factice avec `auth`, source de jeton retournant le témoin `'JETON-TEMOIN-FICTIF-0001'`) s’exécute ; la chaîne témoin n’apparaît dans aucun message de port, résultat, message d’erreur, entrée de journal sérialisée, écriture de stockage, appel `console` (espionné), ni dans aucune requête vers une origine autre que `https://www.wiki-masters.com`.
  2. Le jeton n’apparaît que dans l’en-tête d’authentification des requêtes vers l’origine du site pour les types qui l’exigent ; 0 occurrence ailleurs.
  3. Une requête vers une autre origine est refusée avant toute lecture du jeton (la source n’est pas appelée).
  4. Un type sans exigence d’authentification n’appelle pas la source.
- **Tests attendus**
  - `tests/unit/non-fuite-jeton.test.ts` : AC1 à AC4.
- **Brief de contexte**
  - *Pourquoi* : preuve outillée que le jeton ne sort pas du couple `jeton.ts` / `reseau.ts` (SC-018 (c)).
  - *État actuel* : tous les modules de la chaîne existent ; le transport est injecté, **aucun test ne contacte le vrai site** (G1).
  - *À faire* : sérialiser tout ce qui traverse (JSON.stringify de chaque message, entrée, écriture) et chercher le témoin ; ne modifier aucun fichier de `src/`. Si un module fuit, le test échoue et l’anomalie est signalée à l’orchestrateur (le dev-test ne corrige pas le code).
  - *Contrats* : G1, G3. Jeton témoin fictif (H12).
  - *Pièges* : inclure les objets d’erreur (`message`, `stack`) et le résultat d’un abandon par délai.
  - *Vérifier* : `npx vitest run tests/unit/non-fuite-jeton.test.ts && npm run check`

## T-021 — `jeton.ts` : lecture réelle (**bloquée**)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-019, T-020 · **Parallélisable** : [P]
- **Bloquée par** : relevé de l’endroit où le site garde le jeton (stockage du site, cookie non `HttpOnly`, autre ; lisible ou non depuis un content script) et du nom de l’en-tête d’authentification ; passe `refine` R1 sur l’incohérence 1 du plan (SC-017/018/H31 vs option B). **Ne pas démarrer sans ces écrits dans `contrat-api.md`.**
- **SC couverts** : SC-002 (a), SC-018 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/jeton.ts`
  - `tests/unit/jeton.test.ts`
- **Critères d'acceptation**
  1. `SOURCE_REELLE` lit le jeton **uniquement** à l’endroit décrit par `contrat-api.md`, en mémoire, sans cache, sans écriture, en n’extrayant que la valeur du jeton.
  2. Si le jeton n’est lisible que depuis le monde principal de la page : **ne rien coder**, escalade `sdd-escalade` (SC-002 (a), H41). Si c’est un cookie `HttpOnly` de même origine : `jeton.ts` n’est pas utilisé pour ce type (le navigateur le joint seul).
  3. Les tests de T-008 et T-020 passent ; `grep` : aucune autre lecture du stockage du site ailleurs que dans ce fichier.
- **Tests attendus**
  - `tests/unit/jeton.test.ts` : lecture dans un environnement simulé (faux `localStorage` / faux `document.cookie` selon le relevé), absence → `null`, un seul cookie extrait.
- **Brief de contexte**
  - *Pourquoi* : rendre possibles les types qui exigent l’authentification, dans le cadre d’AGENTS.md (« Ne jamais faire »).
  - *État actuel* : T-008 a livré l’API avec source injectée et `SOURCE_NON_RELEVEE`.
  - *À faire* : implémenter seulement ce que le contrat complété décrit ; aucune supposition (G5).
  - *Contrats* : G3, G7. `security-reviewer` renforcé sur cette PR.
  - *Pièges* : ne jamais journaliser, même sous erreur ; ne pas exposer la valeur dans un message d’exception.
  - *Vérifier* : `npx vitest run tests/unit/jeton.test.ts tests/unit/confinement-jeton.test.ts tests/unit/non-fuite-jeton.test.ts && npm run check`

## T-022 — Défausse : entrée du contrat (**bloquée**)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-019 (et T-021 si le contrat exige un jeton) · **Parallélisable** : [P]
- **Bloquée par** : mode d’authentification de `/api/` (cookies de même origine ou jeton, nom de l’en-tête) ; forme de la réponse 200 de la défausse ; forme des erreurs 401, 403, 429. **Ne pas démarrer avant ces relevés.**
- **SC couverts** : SC-002, SC-009, SC-011 (« hors contrat »), SC-014, SC-017 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/contrat/defausse.ts`
  - `tests/unit/contrat-defausse.test.ts` (créé)
- **Critères d'acceptation**
  1. L’entrée `defausse` de la table : `POST /api/user-cards/<user_card_id>/discard`, aucun corps, `auth` selon le relevé, `validerReponse` pour le 200 relevé ; identifiant encodé.
  2. `typesDisponibles()` contient `defausse` ; aucun autre type n’est ajouté.
  3. Une réponse de forme inconnue → `hors-contrat` (arrêt).
- **Tests attendus**
  - `tests/unit/contrat-defausse.test.ts` : chemin, méthode, absence de corps, encodage, en-têtes exacts attendus, validation de la réponse relevée et de formes parasites (AC1 à AC3), avec fixtures **fictives** (G1).
- **Brief de contexte**
  - *Pourquoi* : la défausse est l’action au contrat le plus simple ; première à brancher de bout en bout. Action définitive : chaque défausse est confirmée (G2) par le dialogue de T-017.
  - *État actuel* : `contrat/defausse.ts` exporte une table vide (T-004) ; `contrat-api.md` : `POST /api/user-cards/<user_card_id>/discard` → 200.
  - *À faire* : remplir uniquement ce que le contrat note ; le reste reste inconnu.
  - *Contrats* : G1 à G5. Libellés d’échec fixes de l’extension.
  - *Pièges* : après une défausse, le site appelle `get_my_profile` ; l’extension ne le reproduit pas (H48).
  - *Vérifier* : `npx vitest run tests/unit/contrat-defausse.test.ts && npm run check`

## T-023 — Enchère : entrée du contrat et réglages (**bloquée**)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-019, T-012 (et T-021 si jeton) · **Parallélisable** : [P]
- **Bloquée par** : lien `card_id` ↔ `user_card_id` ; mode d’authentification de `/api/` ; bornes de `base_amount` ; durée par défaut du formulaire ; forme de la réponse 201 et des erreurs. **Ne pas démarrer avant ces relevés.**
- **SC couverts** : SC-002 (b, e), SC-006 (bornes), SC-011, SC-017 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/contrat/enchere.ts`
  - `src/config/prix.ts`
  - `tests/unit/contrat-enchere.test.ts` (créé)
- **Critères d'acceptation**
  1. Entrée `enchere` : `POST /api/marketplace`, corps `{ card_id, base_amount, duration_minutes }` ; `card_id` selon le lien relevé ; `base_amount` = prix de départ de l’action ; `duration_minutes` lu dans `prix.ts` (choix parmi 10, 30, 60, 180, 360, 720).
  2. `prix.ts` : réglage de durée (valeur à renseigner par Alexis, défaut = celui du formulaire relevé) et bornes de `base_amount` relevées.
  3. Aucun appel d’annulation d’enchère n’est codé (« non annulable par l’extension »).
  4. `typesDisponibles()` contient `enchere` ; `config.lienCardId` active la génération de T-012.
- **Tests attendus**
  - `tests/unit/contrat-enchere.test.ts` : corps exact, bornes, durée invalide refusée, réponse hors contrat (AC1 à AC4), fixtures fictives.
- **Brief de contexte**
  - *Pourquoi* : mettre aux enchères les cartes `vendre`. Une enchère est définitive côté extension.
  - *État actuel* : `prix.ts` contient le seuil de défausse, la limite d’enchères simultanées, les valeurs de repli, la matrice ; `lot.ts` (T-012) lit `config.lienCardId`.
  - *À faire* : ne rien déduire du lien `card_id` ; si le relevé montre qu’il est impossible à établir, SC-002 (b) : escalade, type « enchère » reste non disponible.
  - *Contrats* : G1 à G5 ; AGENTS.md (`prix.ts` = réglages d’Alexis).
  - *Pièges* : un type de durée hors liste ne doit pas partir.
  - *Vérifier* : `npx vitest run tests/unit/contrat-enchere.test.ts tests/unit/lot-encheres.test.ts && npm run check`

## T-024 — Étiquettes : entrées du contrat et réglages (**bloquée**)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-019, T-009 (et T-021 si jeton) · **Parallélisable** : [P]
- **Bloquée par** : hôte exact de `/rest/v1` (même origine ?) ; en-têtes exigés par `/rest/v1` ; filtre de `DELETE user_card_tags` ; origine de `user_id` ; réponses de création (identifiants renvoyés) ; limites de nombre et de longueur, visibilité des étiquettes ; forme des erreurs. **Ne pas démarrer avant ces relevés.** Si `/rest/v1` est sur une autre origine ou exige un autre en-tête que `Content-Type`, `Accept` et l’en-tête d’authentification, SC-002 (c)/(d) : escalade, aucun code.
- **SC couverts** : SC-002, SC-007 (f), SC-011, SC-016 (retrait), SC-017 · **Règles design** : D-13, D-15, D-17
- **Fichiers concernés** (liste fermée) :
  - `src/lib/contrat/etiquettes.ts`
  - `src/config/synchro.ts` (créé)
  - `tests/unit/contrat-etiquettes.test.ts` (créé)
- **Critères d'acceptation**
  1. Entrées `creation-etiquette` (`POST /rest/v1/tags` avec `user_id`, `name`, `color`), `pose-etiquette` (`POST /rest/v1/user_card_tags` avec `user_card_id`, `tag_id`) et `retrait-etiquette` (`DELETE /rest/v1/user_card_tags` avec le filtre relevé en query, encodé, **sans** supprimer l’étiquette).
  2. `src/config/synchro.ts` : `COULEUR_ETIQUETTE` (champ `color`, réglage d’Alexis), `LONGUEUR_MAX_ETIQUETTE` selon le relevé, et la **source** de `user_id` selon le relevé (la façon de l’obtenir, jamais sa valeur). **`src/config/synchro.ts` ne contient jamais de valeur de `user_id`** (ni littéral, ni exemple réel) : tout décodage du jeton pour en tirer le `user_id` relève d’une nouvelle décision d’Alexis écrite dans la spec ; sans elle, le type reste « non disponible » (escalade).
  3. Validateurs : l’identifiant d’étiquette renvoyé par la création est validé (non vide ≤ 200) avant d’aller au registre ; forme inconnue → `hors-contrat`.
  4. `typesDisponibles()` contient les types dont tous les points sont relevés, et seulement eux.
- **Tests attendus**
  - `tests/unit/contrat-etiquettes.test.ts` : corps, chemins, filtre encodé, absence de suppression de `tags`, validation des réponses (AC1 à AC4), fixtures fictives ; le source de `src/config/synchro.ts` ne contient aucun `user_id` littéral ni décodage de jeton (`atob`, `JSON.parse` du jeton) (AC2).
- **Brief de contexte**
  - *Pourquoi* : appliquer les étiquettes de statut et d’ami sur le site, retirer celles de l’extension.
  - *État actuel* : `lot.ts` (T-009) génère déjà créations / poses / retraits quand les types sont disponibles ; `registre.ts` (T-005) conserve les couples.
  - *À faire* : un type dont un paramètre reste « non relevé » n’entre pas dans la table (G5). Le retrait d’étiquette ne supprime jamais l’étiquette du site. `synchro.ts` décrit où lire `user_id`, sans en contenir ; ne jamais décoder le jeton sans décision d’Alexis écrite dans la spec.
  - *Contrats* : G1 à G5, G7 ; avertissement de visibilité dans l’aperçu si le contrat montre qu’elles sont visibles des autres joueurs (H34, adapté en T-015 par retouche si nécessaire).
  - *Pièges* : le nom d’étiquette ne doit jamais être tronqué (H6).
  - *Vérifier* : `npx vitest run tests/unit/contrat-etiquettes.test.ts tests/unit/lot.test.ts && npm run check`

## T-025 — Source des identifiants d’exemplaire (**bloquée**)
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-019, T-002 (et T-021 si jeton) · **Parallélisable** : [P]
- **Bloquée par** : relevé « `user_card_id` lisible sur `/collection` ou seulement via `GET /api/my-collection` » ; forme des réponses de `my-collection` ; mode d’authentification de `/api/`. **Ne pas démarrer avant ces relevés.**
- **SC couverts** : SC-002 (b), SC-024 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/lecteur.ts`
  - `src/lib/contrat/lecture.ts`
  - `tests/unit/lecteur.test.ts`
  - `tests/unit/contrat-lecture.test.ts` (créé)
- **Critères d'acceptation**
  1. Si les `user_card_id` sont lisibles sur `/collection` : `lecteur.ts` les relève et les rattache à l’exemplaire de la carte `rareté|titre`, validés (non vides ≤ 200, distincts) ; toute forme inattendue est ignorée.
  2. Sinon : entrée `lecture` de la table (`GET /api/my-collection?sort=rarity&page=N&stats=0`, `page` à partir de 0), émise comme **action du lot** après « Lancer » (cadence, journal), jamais avant.
  3. Les identifiants viennent uniquement du site, jamais d’un import. Plusieurs cartes du site partageant le même `rareté|titre` sans moyen de les distinguer → SC-002 (b) : escalade.
- **Tests attendus**
  - `tests/unit/lecteur.test.ts` (extension) et `tests/unit/contrat-lecture.test.ts` : AC1 à AC3 avec fixtures fictives.
- **Brief de contexte**
  - *Pourquoi* : sans identifiants d’exemplaire, toutes les cartes sont « non reliées au site » et le lot est vide.
  - *État actuel* : `lecteur.ts` lit le texte des cartes affichées et ignore toute carte de forme inattendue ; `idsSite` existe depuis T-002.
  - *À faire* : si le chemin choisi exige de modifier d’autres fichiers que la liste fermée (par exemple `content/index.ts` pour persister), l’indiquer à l’orchestrateur pour une retouche plutôt que d’y toucher.
  - *Contrats* : G1, G5 ; le content script ne clique, ne change pas de page.
  - *Pièges* : H47 (identifiant présent dans deux cartes → conflit, jusqu’à la prochaine lecture).
  - *Vérifier* : `npx vitest run tests/unit/lecteur.test.ts tests/unit/contrat-lecture.test.ts && npm run check`

## T-026 — E2e complet avec site simulé
- **Couche** : tests · **Agent** : dev-test
- **Dépend de** : T-020 à T-025 (uniquement celles non arrêtées par SC-002) · **Parallélisable** : —
- **SC couverts** : SC-008, SC-009, SC-012, SC-013, SC-015 (e2e), SC-016, SC-021 · **Règles design** : D-08, D-19 à D-27, D-33
- **Fichiers concernés** (liste fermée) :
  - `tests/e2e/synchro-complete.spec.ts` (créé)
  - `tests/e2e/fixtures/site-contrat-fictif.ts` (créé)
- **Critères d'acceptation**
  1. Le site simulé répond (fixtures **écrites à la main** depuis `contrat-api.md`, jeton témoin fictif) pour les seuls types disponibles ; toute autre requête est abort et fait échouer le test (G1).
  2. Aperçu complet puis « Lancer » : cadence observée ≥ 5 950 ms entre deux requêtes (horloge Playwright), ordre H9.
  3. Dialogue de défausse : 0 requête de défausse sans « Défausser cette carte » ; « Passer » / Échap journalise « passée » ; « Arrêter le lot » arrête ; focus initial sur « Passer ».
  4. « Arrêter » : 0 requête émise plus de 100 ms après le clic.
  5. Interruptions (onglet WikiMasters fermé, `collection.html` rechargée) : aucune reprise, journal « interrompue » + « résultat inconnu, à vérifier sur le site ».
  6. Journal persistant après rechargement ; « Retirer l’étiquette » (si le type est disponible) ; mentions « Non annulable par l’extension ».
  7. Réponses 401, 403, 429 → arrêt immédiat ; le jeton témoin n’apparaît ni dans le DOM, ni dans `chrome.storage`, ni dans le journal exporté.
  8. Captures du dialogue de défausse et de la progression à 375, 768 et 1280 px, 2 thèmes.
- **Tests attendus**
  - `tests/e2e/synchro-complete.spec.ts` : AC2 à AC8.
- **Brief de contexte**
  - *Pourquoi* : preuve de bout en bout des SC dont le comportement est livré en V4-V8.
  - *État actuel* : helper `tests/e2e/site-simule.ts` (T-018) bloque tout sauf ce qui est servi.
  - *À faire* : ne tester que les types réellement disponibles ; les autres restent « non disponible » dans l’aperçu.
  - *Contrats* : G1 à G4. `captures-site/` jamais lu ni committé ; contrôle `security-reviewer` des fixtures.
  - *Pièges* : minuteurs ; deux onglets pour le cas « plusieurs onglets » ; ne jamais cibler le vrai site.
  - *Vérifier* : `npm run test:e2e`
