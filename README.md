# WM Collection

Extension Chrome (Manifest V3) pour préparer le tri, l’échange et la vente d’une collection de cartes du jeu [WikiMasters](https://www.wiki-masters.com). Projet personnel, **non affilié** à l’éditeur du jeu et non publié sur le Chrome Web Store : on la charge à la main depuis le dossier `dist/`.

> **Avant de l’utiliser avec un vrai compte, lisez [Cadre d’usage et risques](#cadre-dusage-et-risques).** L’extension peut lire et écrire sur le site à votre place, ce que les règles de WikiMasters interdisent. Le risque de bannissement est réel.

## Ce qu’elle fait

Tout se passe dans la page de gestion (clic sur l’icône), organisée en sept onglets : **Tableau de bord**, **Synchro**, **Lots**, **Mise en vente**, **Collection**, **Thèmes** et **Réglages**. L’onglet actif est mémorisé dans le fragment d’URL, et un bandeau d’activité reste visible pendant une synchro ou une exécution.

- **Synchronisation** : tant qu’un onglet WikiMasters est ouvert, l’extension relit toute la collection, les étiquettes et les favoris du site, puis les prix du marché (route `price-history`, relevés de plus de 7 jours rafraîchis). Progression, durée restante, panneau d’erreur (réessayer, sauter, ignorer), journal et bouton « Forcer la synchro » sont dans l’onglet Synchro. Les durées affichées sont estimées d’après la médiane des durées réellement mesurées.
- **Thèmes** : chaque carte reçoit 1 à 4 thèmes déduits du titre et de la description, affinés par Wikipédia et Wikidata (lecture de fond automatique) ; une hiérarchie de familles et de sous-thèmes ; thèmes appris quand une catégorie revient sur au moins 5 cartes ; choix manuel de thèmes par carte. Une carte sans thème fiable reste « à classer » : jamais vendue, défaussée ni échangée. Un classement par l’API Claude (clé saisie à chaque fois) ou un export/import JSON avec prompt intégré aident pour les cartes restantes.
- **Collection** : tableau trié et filtré (thèmes parents et enfants, filtres « Cartes gardées », favoris, doublons), motif du verdict affiché sur chaque carte, étoile de favori choisie à la main (elle prime sur toute règle), prix cible, note, ami et valeur marchande en édition locale, analyses et graphique d’évolution.
- **Lots** : étiquettes (thèmes et « #À échanger <ami> »), favoris, enchères et défausses, avec un aperçu chiffré (actions, durée) ; rien n’est envoyé avant « Lancer ». La pré-coche des enchères et défausses suit des règles (favori, thème gardé, ami, « à classer », valeur inconnue, plafond de défausse) et se recalcule à chaque ouverture de l’onglet ; chaque carte garde son verdict visible et le joueur peut le corriger.
- **Prix de départ et durée** : le prix de départ suit la tendance du marché, relue juste avant chaque enchère ; la durée de l’enchère est de 1 h en heure forte et de 3 h en zone creuse (selon l’affluence observée).
- **Mise en vente** : suivi des enchères en cours et de l’historique, et relance automatique optionnelle (désactivée par défaut) dès qu’une place se libère.
- **Tableau de bord** : chiffres clés, santé de la synchro, calendrier d’activité, répartition des thèmes, destination des cartes et heures d’affluence, tout visible sans repli.
- **Données entre PC** : sauvegarde complète en fichier JSON, et synchro automatique entre PC par un dossier partagé que vous choisissez (Google Drive pour ordinateur, OneDrive…), sans requête réseau de l’extension.

Les données sont stockées localement dans `chrome.storage.local`. Il n’y a ni serveur ni base de données. Les réglages sont dans l’onglet Réglages : synchro automatique, sauvegarde, synchro entre PC, réinitialisation globale, plafond de défausse, mode des étiquettes, étiquettes préexistantes, Wikipédia, classement par l’IA, thèmes et animations.

## Cadre d’usage et risques

Le détail et les décisions datées sont dans [AGENTS.md](AGENTS.md), qui fait foi. En résumé :

- WikiMasters n’a pas d’API publique et son `robots.txt` interdit `/api/`. Ses règles interdisent les bots et scripts qui jouent à la place du joueur.
- L’extension appelle pourtant l’API interne du site (lecture de la collection, des étiquettes, des prix et de vos ventes), et peut mettre aux enchères, défausser et poser ou retirer des étiquettes et des favoris. Les écritures des lots ne partent qu’après votre clic sur « Lancer » ; la relance automatique des mises en vente est la seule exception, et elle est désactivée par défaut. Le propriétaire du projet assume le risque de bannissement ; **vous devez décider du vôtre**.
- Les requêtes sont espacées (0,2 s au minimum plus un délai aléatoire), une seule en vol pour la lecture. La synchronisation automatique est **activée par défaut** (interrupteur dans la page de gestion). Elle s’arrête sur 401, 403 ou 429 (pause de 30 min, « Forcer la synchro » possible) ; les prix et la relance attendent et réessaient au lieu de s’arrêter.
- La vérification anti-bot du site n’est **jamais contournée** : vous la franchissez à la main sur le site.
- L’extension ne stocke jamais de mot de passe, de cookie ni de jeton. Elle lit en mémoire le jeton de session au moment d’une requête d’écriture, et seulement pour l’envoyer au site.
- Serveurs tiers : le titre d’une carte vers `fr.wikipedia.org` et `www.wikidata.org` ; titre et description vers `api.anthropic.com` seulement si vous lancez à la main le classement par l’IA ; l’hôte Supabase du site pour les étiquettes et favoris. Rien d’autre. Les sauvegardes et le dossier partagé ne contiennent ni jeton, ni cookie, ni identifiant d’exemplaire ; ce dossier ne doit être partagé avec personne.

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
3. Cliquez sur l’icône de l’extension : la page de gestion s’ouvre dans un onglet, sur le Tableau de bord.
4. Ouvrez `https://www.wiki-masters.com/collection` connecté à votre compte pour que l’extension lise vos cartes.

Après une modification du code, relancez `npm run build` (ou laissez tourner `npm run dev`, qui reconstruit `dist/` en continu) puis cliquez sur la flèche de rechargement de l’extension dans `chrome://extensions`.

Pour essayer sans compte, les tests e2e écrivent des cartes fictives (`tests/e2e/fixtures/`) dans le stockage de l’extension.

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
| `public/manifest.json` | Manifeste. Permission `storage` seule ; `host_permissions` limité à `fr.wikipedia.org`, `www.wikidata.org` et `api.anthropic.com` ; content script limité à WikiMasters. |
| `src/background.ts` | Service worker (éphémère, sans état) : le clic sur l’icône ouvre `collection.html`. |
| `src/content/` | Content script, construit à part : synchronisation automatique, exécution des ordres d’écriture, suivi des mises en vente et relance (`suiviVentes.ts`). |
| `collection.html` + `src/app/` | Page de gestion en React 19, en sept onglets (`Onglets.tsx`, `definitionOnglets.ts`) : tableau de bord, synchro, lots, mise en vente, collection, thèmes, réglages. |
| `src/lib/` | Logique, pure autant que possible : modèle et filtres (`collection.ts`), thèmes (`themes.ts`, `wikipedia.ts`), verdicts et sélection des lots (`selectionLot.ts`), étiquettes (`lot.ts`, `registre.ts`), prix de départ (`prixTendance.ts`), affluence, synchro (`ordonnanceur.ts`, `lectureApi.ts`), synchro entre PC (`synchroPc.ts`), sauvegarde, file de requêtes, journal. `stockage.ts` est le seul module qui touche `chrome.storage`. |
| `src/lib/contrat/` | Description des routes d’écriture du site (étiquettes, favori, enchère, défausse, lecture). |
| `src/config/` | Réglages : prix et seuils (`prix.ts`), amis (`amis.ts`), hôte et cadence de la synchro, affluence (`affluence.ts`, durées d’enchère). |
| `src/styles/tokens.css` | Tokens Tailwind 4 (couleurs en rôles, thèmes clair et sombre). Toute couleur passe par là. |
| `tests/unit/` · `tests/e2e/` | Vitest (un fichier par module de `src/lib`) · Playwright (parcours et captures ; contexte dans `tests/e2e/extension.ts`). |
| `specs/` | Artefacts du workflow SDD, une feature par dossier. |
| `docs/` | Audits des process, classement par l’IA, classes Wikidata ; `docs/archives/` : journal des sessions Claude Code des 6 au 8 novembre 2026 et ancienne version d’AGENTS.md. |
| `.claude/` | Agents, commandes, skills et hook de garde-fous du workflow SDD. |

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

Les constantes sont dans [src/config/prix.ts](src/config/prix.ts) : plafond de défausse par défaut, nombre d’enchères simultanées et règle du prix de départ selon la tendance du marché (`REGLE_PRIX`, appliquée par `src/lib/prixTendance.ts`). Les durées d’enchère selon l’affluence sont dans `src/config/affluence.ts`. Le plafond de défausse se règle aussi dans Réglages (1 à 20). Les amis et leurs thèmes se saisissent dans l’onglet Thèmes (liste vide au départ ; `src/config/amis.ts` reste vide dans le code livré). Après une modification de configuration, lancez `npm run build` puis rechargez l’extension.

## Sauvegarde complète et synchro entre PC

**Sauvegarde manuelle.** Réglages › « Sauvegarde » écrit un seul fichier JSON (`wm-sauvegarde-AAAA-MM-JJ.json`) avec ce que vous avez saisi (prix cible, note, ami, valeur marchande, favori et thèmes choisis de chaque carte), vos thèmes et amis, le plafond de défausse, le journal des ventes, ainsi qu’une mémoire de synchro (relevés de prix, caches Wikipédia et IA, thèmes appris, étiquettes posées par carte, activité). **Jamais** de jeton, de cookie ni d’identifiant d’exemplaire du site. Sur l’autre PC : « Importer une sauvegarde », lisez l’aperçu (cartes nouvelles, complétées, identiques, en conflit), choisissez quoi faire en cas de conflit, puis « Appliquer ». L’import est refusé tant qu’une synchro est en cours, un fichier invalide ou d’une version plus récente est refusé sans rien modifier, et les prix de plus de 7 jours restent à rafraîchir.

**Synchro entre PC par dossier partagé.** Réglages › « Synchro entre PC » : choisissez sur chaque PC le même dossier synchronisé (Google Drive pour ordinateur, OneDrive…). Chaque PC n’écrit que son propre fichier `wm-sync-<pc>.json` (au plus une fois par minute, seulement si le contenu a changé) et fusionne ceux des autres (au plus toutes les 5 minutes), tant que la page de gestion est ouverte ; la saisie la plus récente gagne en cas de conflit. Elle demande un navigateur qui propose le sélecteur de dossier et peut redemander l’autorisation d’accès au dossier.

## Points à confirmer

- Le détail des durées d’enchère (3 h en zone creuse) n’a pas encore été envoyé au site en réel (voir AGENTS.md).
