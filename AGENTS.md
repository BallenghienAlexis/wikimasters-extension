# AGENTS.md — WM Collection

Source de vérité pour tout agent (humain ou IA) qui travaille sur ce dépôt. Elle tient aussi lieu de **constitution** du workflow Spec-Driven Development (SDD) : en cas de conflit entre un autre document et celui-ci, c'est celui-ci qui gagne.

WM Collection est une extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes du jeu [WikiMasters](https://www.wiki-masters.com). Elle n'est ni affiliée à l'éditeur (Shoobidoo Labs inc.), ni destinée à être publiée pour l'instant.

## Cadre d'usage WikiMasters

État relevé le 2026-11-06 : pas d'API publique, et `Disallow: /api/` dans le `robots.txt`. Les règles de la communauté (section 3) interdisent les bots, scripts, macros, tout outil qui joue, ouvre des paquets, échange ou interagit à la place du joueur, ainsi que la rétro-ingénierie et l'interception du trafic pour obtenir un avantage. Les conditions d'utilisation (section 6) prévoient un bannissement pour automatisation.

**« Édition » désigne donc l'édition locale** : statut, prix cible et note de chaque carte, stockés dans l'extension. Rien n'est modifié sur le site.

Tout code qui clique, envoie un formulaire ou appelle l'API interne du site à la place du joueur exige une décision explicite d'Alexis, écrite dans la spec de la feature, avec le risque de bannissement rappelé. Si WikiMasters ouvre une API ou donne un accord écrit, ce cadre est à mettre à jour ici.

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

- `public/manifest.json` : manifeste. Permission `storage` seulement ; aucun `host_permissions` tant qu'aucune feature ne lit le site.
- `src/background.ts` : service worker. Le clic sur l'icône ouvre `collection.html` dans un onglet. Il est éphémère : aucun état en mémoire.
- `collection.html` + `src/app/` : page de gestion (React). Composants `React.FC` + export par défaut, un par fichier.
- `src/lib/collection.ts` : modèle et logique pure (validation, édition, filtres, doublons). Sans `chrome.*`.
- `src/lib/exports.ts` : export CSV et JSON. Logique pure.
- `src/lib/stockage.ts` : **seul** module de `src/lib` qui touche à `chrome.storage.local`.
- **Données** : aujourd'hui, elles entrent par import d'un fichier JSON (`{ "version": 1, "cartes": [...] }`). La lecture de la collection depuis le site n'est pas écrite : elle exige de connaître les vraies pages du jeu, connecté.
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
