# WM Collection

Extension Chrome (Manifest V3) pour préparer le tri, l’échange et la vente d’une collection de cartes du jeu [WikiMasters](https://www.wiki-masters.com). Projet personnel, **non affilié** à l’éditeur du jeu et non publié sur le Chrome Web Store : on la charge à la main depuis le dossier `dist/`.

> **Avant de l’utiliser avec un vrai compte, lisez [Cadre d’usage et risques](#cadre-dusage-et-risques).** L’extension peut lire et écrire sur le site à votre place, ce que les règles de WikiMasters interdisent. Le risque de bannissement est réel.

## Ce qu’elle fait

- Lit les cartes de chaque page Collection que vous ouvrez sur WikiMasters et pose un repère avec la décision proposée.
- Déduit les thèmes de chaque carte (mots-clés, puis vérification sur Wikipédia) ; vous gérez vos thèmes et ceux de vos amis.
- Propose un tri : garder, échanger avec un ami, vendre, défausser, à trier.
- Prépare les étiquettes (statut, thème, « #À échanger <ami> ») avec un aperçu, puis les envoie au site si vous cliquez sur « Lancer ».
- Liste les ventes à lancer selon vos places libres et conseille un délai selon les heures de forte affluence.
- Se synchronise avec le site (collection, étiquettes, prix du marché) tant qu’un onglet WikiMasters est ouvert.
- Permet d’éditer chaque carte (statut, prix cible, note), de filtrer, de repérer les doublons, d’importer et d’exporter en CSV ou JSON.

Les données sont stockées localement dans `chrome.storage.local`. Il n’y a ni serveur ni base de données.

## Cadre d’usage et risques

Le détail et les décisions datées sont dans [AGENTS.md](AGENTS.md), qui fait foi. En résumé :

- WikiMasters n’a pas d’API publique et son `robots.txt` interdit `/api/`. Ses règles interdisent les bots et scripts qui jouent à la place du joueur.
- L’extension appelle pourtant l’API interne du site (lecture de la collection, des étiquettes et des prix), et peut mettre aux enchères, défausser et poser ou retirer des étiquettes. Ces actions ne partent qu’après votre clic sur « Lancer ». Le propriétaire du projet assume le risque de bannissement ; **vous devez décider du vôtre**.
- La synchronisation automatique est **activée par défaut** ; l’interrupteur est dans la page de gestion. Elle s’arrête sur une réponse 401, 403 ou 429 ou après 3 échecs.
- L’extension ne stocke jamais de mot de passe, de cookie ni de jeton. Elle lit en mémoire le jeton de session au moment d’une requête d’écriture, et seulement pour l’envoyer au site.
- Aucune donnée n’est envoyée à un serveur tiers, sauf le titre d’une carte vers `fr.wikipedia.org` pour affiner ses thèmes.

## Prérequis

- Node 22 ou plus et npm.
- Google Chrome (ou Chromium) pour charger l’extension.
- Pour les tests e2e : Chromium de Playwright (`npx playwright install chromium`, ajoutez `--with-deps` sous Linux).

## Installation et build

```bash
npm ci
npm run build
```

`npm run build` vide `dist/` puis construit la page de gestion et le content script (deux configurations Vite).

## Charger l’extension dans Chrome

1. Ouvrez `chrome://extensions` et activez le **mode développeur**.
2. Cliquez sur « Charger l’extension non empaquetée » et choisissez le dossier `dist/`.
3. Cliquez sur l’icône de l’extension : la page de gestion s’ouvre dans un onglet.
4. Ouvrez `https://www.wiki-masters.com/collection` connecté à votre compte pour que l’extension lise vos cartes.

Après une modification du code, relancez `npm run build` (ou laissez tourner `npm run dev`, qui reconstruit `dist/` en continu) puis cliquez sur la flèche de rechargement de l’extension dans `chrome://extensions`.

Pour essayer sans compte, importez `tests/e2e/fixtures/collection-fictive.json` depuis la page de gestion.

## Commandes npm

| Besoin | Commande |
|---|---|
| Installer | `npm ci` |
| Build | `npm run build` |
| Rebuild automatique de `dist/` | `npm run dev` |
| Lint (ESLint) | `npm run lint` |
| Types (TypeScript strict) | `npm run typecheck` |
| Tests unitaires (Vitest, `tests/unit/`) | `npm test` |
| Un seul fichier ou un seul test | `npx vitest run tests/unit/collection.test.ts` · `npx vitest run -t "doublons"` |
| Lint + types + tests unitaires | `npm run check` |
| E2e Playwright sur l’extension chargée dans Chromium, avec captures (build compris) | `npm run test:e2e` |
| Garde-fous git du workflow | `node .claude/hooks/garde-fous.test.mjs` |

La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) lance lint, types, tests unitaires, garde-fous, puis build et e2e. Elle doit être verte pour fusionner. Les tests n’utilisent **que des données fictives** et ne contactent jamais le vrai site.

## Structure du code

| Chemin | Rôle |
|---|---|
| `public/manifest.json` | Manifeste. Permission `storage` seule ; `host_permissions` limité à `fr.wikipedia.org` ; content script limité à WikiMasters. |
| `src/background.ts` | Service worker (éphémère, sans état) : le clic sur l’icône ouvre `collection.html`. |
| `src/content/` | Content script, construit à part : lecture des cartes, repères, synchronisation automatique, exécution des ordres d’écriture. |
| `collection.html` + `src/app/` | Page de gestion en React 19 : liste, assistant de tri, aperçu des étiquettes, synchronisation, journal. |
| `src/lib/` | Logique, pure autant que possible : modèle et filtres (`collection.ts`), thèmes, tri, étiquettes (`lot.ts`, `registre.ts`), synchro (`ordonnanceur.ts`, `lectureApi.ts`), file de requêtes, journal. `stockage.ts` est le seul module qui touche `chrome.storage`. |
| `src/lib/contrat/` | Description des routes d’écriture du site (étiquettes, enchère, défausse). |
| `src/config/` | Réglages : prix et seuils (`prix.ts`), amis (`amis.ts`), hôte et cadence de la synchro, affluence. |
| `src/styles/tokens.css` | Tokens Tailwind 4 (couleurs en rôles, thèmes clair et sombre). Toute couleur passe par là. |
| `tests/unit/` · `tests/e2e/` | Vitest (un fichier par module de `src/lib`) · Playwright (parcours et captures ; contexte dans `tests/e2e/extension.ts`). |
| `specs/` | Artefacts du workflow SDD, une feature par dossier. |
| `docs/archives/` | Journal des sessions Claude Code des 6 au 8 novembre 2026. |

Pile : Vite 8, React 19, TypeScript strict, Tailwind CSS 4, Vitest, Playwright.

## Contribuer

1. Lisez [AGENTS.md](AGENTS.md) : c’est la source de vérité (cadre d’usage, conventions, « ne jamais faire »).
2. Créez une branche, puis lancez `npm run check` et `npm run build` avant chaque PR (et `npm run test:e2e` si vous touchez l’interface).
3. Écrivez les tests avant le code. Les données de test sont toujours **fictives** : jamais de pseudo, d’identifiant, de jeton, d’étiquette ni de carte du vrai compte. Ne committez jamais `.env*` ni `captures-site/`.
4. Conventions : code, commentaires, textes d’interface, commits et PR **en français** ; commits au format Conventional Commits (`feat(extension): ajouter …`) ; couleurs uniquement via les tokens ; pas de `dangerouslySetInnerHTML` ni de `eval`.
5. Ouvrez une PR en suivant [`.github/pull_request_template.md`](.github/pull_request_template.md). Fusion en squash, CI verte requise, pas de push direct sur `main`.
6. Toute fonction qui clique, envoie un formulaire ou appelle l’API interne du site à la place du joueur exige une décision écrite du propriétaire du projet (voir AGENTS.md).

### Workflow SDD (Spec-Driven Development)

Les grosses fonctions passent par un pipeline de documents dans `specs/<feature>/` : `spec.md` → `spec.refined.md` → `design.md` + `plan.md` → `tasks.md` → une PR par tâche → `verification.md`, avec l’état dans `STATUS.md`. Les modèles sont dans `specs/_templates/`. Les rôles d’agents Claude Code sont dans `.claude/agents/`, les commandes dans `.claude/commands/` (`/sdd <besoin>` lance le pipeline) et le hook `.claude/hooks/garde-fous.mjs` bloque les push vers `main`, les push forcés et `gh pr merge --admin`. Une contribution manuelle peut s’en tenir aux étapes 2 à 5 ci-dessus, mais une nouvelle fonction qui touche au site doit avoir sa spec.

## Régler les prix

Tout se trouve dans [src/config/prix.ts](src/config/prix.ts) : seuil de défausse, limite d’enchères, matrice valeur marchande → prix de départ. Les amis et leurs thèmes se saisissent dans la page de gestion (liste vide au départ ; `src/config/amis.ts` reste vide dans le code livré) : renseignez les vôtres. Après une modification, lancez `npm run build` puis rechargez l’extension.

## Format d’import

```json
{
  "version": 1,
  "cartes": [
    { "id": "identifiant-unique", "titre": "Titre", "rarete": "Rare", "quantite": 2, "url": "https://exemple.test/carte" }
  ]
}
```

Seuls `id` et `titre` sont obligatoires. Un import met à jour les cartes de même `id` en gardant votre édition locale, sauf si le fichier fournit `statut`, `prixCible` ou `note`.
