# AGENTS.md — WM Collection

Source de vérité pour tout agent (humain ou IA) qui travaille sur ce dépôt. Elle tient aussi lieu de **constitution** du workflow Spec-Driven Development (SDD) : en cas de conflit entre un autre document et celui-ci, c'est celui-ci qui gagne.

WM Collection est une extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes du jeu [WikiMasters](https://www.wiki-masters.com). Elle n'est ni affiliée à l'éditeur (Shoobidoo Labs inc.), ni destinée à être publiée pour l'instant.

## Cadre d'usage WikiMasters

État relevé le 2026-11-06 : pas d'API publique, et `Disallow: /api/` dans le `robots.txt`.

**« Édition » désigne donc l'édition locale** : statut, prix cible et note de chaque carte, stockés dans l'extension. Rien n'est modifié sur le site.

**Lecture du site** : quand le joueur ouvre `/collection`, le content script lit les cartes affichées et y pose un repère avec sa décision. Il ne clique pas, ne change pas de page et ne fait aucune requête : le joueur tourne les pages et agit lui-même. Les règles ne parlent pas explicitement du scraping : c'est une zone grise, assumée par Alexis, avec un risque non nul.

**Verrou réseau** : aucune requête. Il repose sur le manifeste (pas de `host_permissions`, CSP `connect-src 'none'`), le lint (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `chrome.cookies`, `chrome.scripting` interdits dans `src/` ; `click`, `submit`, `dispatchEvent`, `focus` interdits dans le code exécuté sur le site) et les tests e2e.

Aucun code ne cherche à masquer une automatisation : pas de délais aléatoires, de simulation de comportement humain ni de contournement de détection.

Tout code qui clique, envoie un formulaire ou appelle l'API interne du site à la place du joueur exige une décision explicite d'Alexis, écrite dans la spec de la feature.

## Stack

- Extension **Chrome Manifest V3** · **Vite 8** · **React 19** · **TypeScript strict**.
- **Tailwind CSS 4** via `@tailwindcss/vite`. Les tokens vivent dans `src/styles/tokens.css`.
- Tests : **Vitest** (unitaires, `tests/unit/`) et **Playwright** (e2e sur l'extension chargée dans Chromium, `tests/e2e/`).
- Node 22 ou plus, npm. Pas de serveur ni de base de données.

## Commandes

| Besoin | Commande |
|---|---|
| Installer | `npm ci` |
| Rebuild automatique de `dist/` | `npm run dev` |
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| Tests unitaires | `npm test` |
| Un seul fichier / un seul test | `npx vitest run tests/unit/collection.test.ts` · `npx vitest run -t "doublons"` |
| Build | `npm run build` |
| E2e et captures (build compris) | `npm run test:e2e` |
| Tout sauf build et e2e | `npm run check` |

Charger l'extension : `chrome://extensions` › mode développeur › « Charger l'extension non empaquetée » › dossier `dist/`.

## Architecture

- `public/manifest.json` : manifeste. Permission `storage` seulement, aucun `host_permissions` ; content script limité à WikiMasters.
- `src/content/index.ts` : content script, construit à part (`vite.content.config.ts`). `public/repere.css` : style des repères.
- `src/lib/lecteur.ts` : lecture du texte des cartes affichées. Toute carte de forme inattendue est ignorée.
- `src/lib/synchro.ts` : suivi des pages lues et de la prochaine à ouvrir.
- `src/background.ts` : service worker. Le clic sur l'icône ouvre `collection.html` dans un onglet. Il est éphémère : aucun état en mémoire.
- `collection.html` + `src/app/` : page de gestion (React). Composants `React.FC` + export par défaut, un par fichier.
- `src/lib/collection.ts` : modèle et logique pure (validation, édition, filtres, doublons). Sans `chrome.*`.
- `src/lib/exports.ts` : export CSV et JSON. Logique pure.
- `src/lib/themes.ts` : thèmes déduits du titre et de la description par mots-clés, recalculés sans être stockés.
- `src/lib/tri.ts` et `src/app/AssistantTri.tsx` : assistant de tri (mes thèmes, thèmes des amis, aperçu). Règles dans l'ordre : favori ou thème à moi → garder ; thème d'un ami → échanger ; valeur inconnue → à trier ; valeur sous le seuil → défausser ; sinon → vendre au prix de la matrice. Propositions locales uniquement, sans jamais remplacer une décision manuelle (`decidePar: 'moi'`).
- `src/app/FileVente.tsx` : ventes à lancer selon les places libres, de la plus chère à la moins chère. Le joueur indique lui-même ce qu'il a mis aux enchères.
- `src/config/prix.ts` : **réglages à renseigner par Alexis** : seuil de défausse, limite d'enchères simultanées, valeur de repli par rareté, matrice valeur marchande → prix de départ.
- **Valeur marchande** : moyenne affichée dans la fenêtre « Mettre aux enchères », propre à chaque carte. Relevée quand le joueur ouvre cette fenêtre, ou saisie à la main.
- `src/lib/stockage.ts` : **seul** module de `src/lib` qui touche à `chrome.storage.local`.
- **Données** : elles entrent par la lecture de `/collection` (identifiant `rareté|titre`, le site n'en expose pas d'autre) ou par import d'un fichier JSON (`{ "version": 1, "cartes": [...] }`). La quantité ne compte que les exemplaires présents sur la même page.
- Le schéma de stockage porte un numéro de version : tout changement fournit une migration.

## Design

Tokens sous forme de rôles (`ink` = fond, `paper` = texte, `muted`, `line`) et de couleurs de statut (`garder`, `echanger`, `vendre`). Thèmes clair et sombre par `prefers-color-scheme`, en redéfinissant les variables. `prefers-reduced-motion` coupe les animations.

## Conventions

- Code, commentaires, textes d'interface, commits, PR : **en français**. Typographie française dans l'UI (apostrophe ’, espaces avant `:`).
- Couleurs : uniquement via les tokens de `src/styles/tokens.css`. Toute nouvelle couleur passe d'abord par `design.md` de la feature.
- Tests : `tests/unit/<module>.test.ts` pour `src/lib/*`, `tests/e2e/<sujet>.spec.ts` pour les parcours et captures. Le contexte navigateur vient de `tests/e2e/extension.ts`.
- Commits : Conventional Commits en français, `type(extension): message à l'infinitif présent` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`). Dans le workflow SDD : `type(T-xxx): …`.

## Workflow SDD (résumé)

Repris de LifeLog. Artefacts par feature dans `specs/<feature>/` : `spec.md` → `spec.refined.md` → `design.md` + `plan.md` → `tasks.md` → PR par tâche → `verification.md`, état dans `STATUS.md`. Modèles dans `specs/_templates/`. Commande : `/sdd <besoin>`.

### Règles de PR

- Une tâche = une branche `feat/T-xxx-slug` = un worktree `.worktrees/T-xxx-slug` = une PR titrée `T-xxx: …`, labels `sdd`, `couche:<couche>`, `statut:<statut>`.
- Corps de PR : modèle `.github/pull_request_template.md` (tâche, SC couverts, preuves, checklist).
- Merge uniquement en **squash**, branche supprimée, et seulement si : CI `ci` verte **et** verdicts `reviewer` et `security-reviewer` = APPROVED (exception : les PR de documents de l'orchestrateur, voir plus bas).
- Ce gate est appliqué **par l'orchestrateur**. Les garde-fous sont le hook `.claude/hooks/garde-fous.mjs` et cette règle.
- Boucle dev ↔ revue : 3 itérations au plus, puis escalade (issue `sdd-escalade`).
- Fin de run sans intervention : les hypothèses non bloquantes de `refine` sont adoptées par défaut ; les points mineurs des revues passent par une tâche `T-9xx retouches` (ou sont déclinés avec leur raison) ; puis vérification, merge sur `main` avec le même gate, et suppression des branches et worktrees du run. Les PR de documents de l'orchestrateur passent par la CI et `security-reviewer`, sans `reviewer`. Alexis n'intervient qu'à la validation de la spec, en cas d'escalade, ou si GitHub refuse réellement une opération.
- **Dépôt** : `BallenghienAlexis/wikimasters-extension`, privé. Seul le commit initial a été poussé directement sur `main`, car la branche n'existait pas encore.

### Definition of Done (une tâche)

1. Les critères d'acceptation de la tâche sont couverts par des tests écrits **avant** le code et qui passent.
2. `npm run check` et `npm run build` passent ; `npm run test:e2e` passe si la tâche touche l'UI.
3. Tâche UI : captures aux 3 breakpoints jointes à la PR, contrat de `design.md` respecté, navigable au clavier, contrastes AA.
4. Aucun fichier hors de la liste « fichiers concernés » de la tâche n'est modifié.
5. Les deux revues sont APPROVED et la CI est verte.

### Ne jamais faire

- Pousser sur `main`, forcer un push sur une branche partagée, merger sans CI verte ou avec `--admin`.
- Agir sur le site à la place du joueur hors du cadre ci-dessus.
- Lire, stocker ou journaliser un mot de passe, un cookie ou un jeton de session du site. Envoyer des données à un serveur tiers.
- Charger du code distant, utiliser `eval` ou assouplir la CSP du manifeste. Ajouter une permission sans la justifier dans la PR.
- Committer `.env*` ou `captures-site/` (pages réelles du compte). Utiliser des données fictives dans les tests et fixtures.
- Afficher une donnée importée ou lue sur le site avec `dangerouslySetInnerHTML` ou `innerHTML`.
- Désactiver, sauter ou mettre en quarantaine un test pour obtenir une CI verte.
- Faire le travail d'un autre agent (un dev ne modifie pas la spec, un reviewer ne corrige pas le code).
