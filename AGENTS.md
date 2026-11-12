# AGENTS.md — WM Collection

Source de vérité pour tout agent (humain ou IA) qui travaille sur ce dépôt. Elle tient aussi lieu de **constitution** du workflow Spec-Driven Development (SDD) : en cas de conflit entre un autre document et celui-ci, c'est celui-ci qui gagne.

WM Collection est une extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes du jeu [WikiMasters](https://www.wiki-masters.com). Elle n'est ni affiliée à l'éditeur (Shoobidoo Labs inc.), ni destinée à être publiée pour l'instant.

## Cadre d'usage WikiMasters

État relevé le 2026-11-06 : pas d'API publique, et `Disallow: /api/` dans le `robots.txt`. Les règles de la communauté (section 3) interdisent les bots, scripts, macros, tout outil qui joue, ouvre des paquets, échange ou interagit à la place du joueur, ainsi que la rétro-ingénierie et l'interception du trafic pour obtenir un avantage. Les conditions d'utilisation (section 6) prévoient un bannissement pour automatisation.

**« Édition » désigne donc l'édition locale** : statut, prix cible et note de chaque carte, stockés dans l'extension. Rien n'est modifié sur le site.

**Lecture du site** : quand le joueur ouvre `/collection`, le content script lit les cartes affichées et y pose un repère avec sa décision. Il ne clique pas, ne change pas de page et ne fait aucune requête (hors synchronisation automatique, activée par défaut depuis le 2026-11-11, décrite plus bas) : le joueur tourne les pages et agit lui-même. Les règles ne parlent pas explicitement du scraping : c'est une zone grise, assumée par Alexis, avec un risque non nul.

**Pas de verrou réseau** (levé par Alexis le 2026-11-07, il limitait trop les fonctionnalités) : la CSP n'interdit plus `connect-src`, le lint n'interdit plus `fetch`. Le risque de bannissement est assumé. Restent en place : permission `storage` seule (plus `host_permissions` limité à `fr.wikipedia.org`, voir la vérification Wikipédia ci-dessous), pas d'`eval` ni de code distant, et `click`, `submit`, `dispatchEvent`, `focus` interdits dans le code exécuté sur le site tant qu'une spec n'a pas décidé explicitement d'agir à la place du joueur. Les repères insérés dans la page laissent une empreinte (`wm-*`) que le site pourrait détecter : choix assumé par Alexis.

**Déclaration d’Alexis non vérifiée (6 novembre 2026)** : Alexis rapporte que WikiMasters lui a indiqué, sur son forum, que la section 3 des règles autorise l’automatisation « dans la limite de 1 requête par 100 ms ». La page officielle lue par Claude le même jour ne contient pas cette phrase, et Alexis n’a pas fourni de lien. Elle n’est donc **pas** retenue comme autorisation et ne change aucune règle ici ; les cadences des specs restent en vigueur (celle du 2026-11-12 est décrite plus bas). Si Alexis fournit une preuve (lien ou capture montrant l’émetteur et la date), ce cadre est à mettre à jour.

La règle qui interdisait de masquer une automatisation a été retirée par Alexis le 2026-11-07 : chaque spec décide de ses limites (celle de `synchro-complete` : 0,2 s au minimum entre deux requêtes plus un délai variable de 0 à 0,1 s depuis le 2026-11-12 (6 s et 0 à 4 s auparavant), et aucun en-tête falsifié).

**Lecture automatique de l’API (décision d’Alexis du 2026-11-09)** : Alexis autorise, pour la fonction « Synchronisation automatique » (spec `synchro-auto`), des requêtes `GET` en lecture seule vers `/api/` malgré le `Disallow` du `robots.txt` : `my-collection` et `my-collection/stats` (collection et étiquettes), puis `marketplace/cards/<id>/sales?scope=summary` (prix du marché, jamais la route sans `scope=summary`). Le risque de bannissement est rappelé et assumé. Garde-fous :
- Les requêtes partent du content script, vers l’origine du site, avec les cookies de session de même origine envoyés par le navigateur. Cette fonction ne lit **aucun** jeton ni cookie (`jeton.ts` n’est pas importé), n’ajoute aucun en-tête et ne stocke rien de la session.
- Un onglet WikiMasters doit être ouvert ; le service worker n’appelle jamais le site.
- Fonction **activée par défaut depuis le 2026-11-11** (interrupteur dans la page de gestion). Intervalle minimal de 0,2 s entre deux requêtes (plus une gigue aléatoire de 0 à 0,1 s, depuis le 2026-11-12), sans plafond par minute, une seule requête en vol, une seule synchro à la fois (bail dans `chrome.storage.local`).
- Arrêt immédiat sur 401, 403 ou 429, ou après 3 échecs ; aucune reprise avant 30 min.
- Les décisions manuelles (`decidePar: 'moi'`) et les valeurs saisies à la main ne sont jamais écrasées ; les étiquettes du site ne servent qu’à afficher des écarts, sans rien corriger sur le site.
- Toute autre route de `/api/`, et toute écriture, restent soumises à la règle ci-dessous.

**Écriture sur le site autorisée (décision d’Alexis du 2026-11-11)** : Alexis autorise l’extension à agir sur le site à sa place : mise aux enchères (`POST /api/marketplace`), défausse (`POST /api/user-cards/<id>/discard`), pose et retrait d’étiquettes (`/rest/v1/*`, hébergé sur le projet Supabase du site, avec lecture en mémoire du jeton et de la clé d’API publique du site si le relevé l’exige), et la lecture de `GET /api/marketplace/mine` dans la synchronisation. Le risque de bannissement est rappelé et assumé. Cette décision lève, pour ces routes, l’interdiction d’envoyer des données vers l’hôte Supabase du site et permet pour ces seules routes les en-têtes `apikey`, `authorization`, `content-type`, `prefer` et `content-profile` (liste fermée, tout autre en-tête reste interdit) ; tout autre serveur tiers reste interdit. Conditions :
- **Cadence la plus rapide (Alexis, 2026-11-12, resserrée l’après-midi du même jour : « le plus court possible, pour toutes les actions »)** : pour toutes les requêtes (lectures de la synchro, étiquettes, enchères, défausses, relevé d’affluence), 0,2 s au minimum entre deux débuts de requête plus un supplément aléatoire de 0 à 0,1 s, **aucun plafond par minute** (supprimé sur demande d’Alexis), une seule requête en vol pour la synchro automatique et pour les lectures, défausses et enchères ; **poses et retraits d’étiquettes en parallèle, par défaut** (Alexis, 2026-11-12 : « Met le parallèle en défaut »), 3 en vol au plus (`CONCURRENCE_MAX` = 4 en plafond dans `src/lib/file.ts`, 4 ordres en attente au plus dans `src/app/execution.ts`), chaque ordre portant un identifiant de corrélation dans le protocole page ↔ content script ; les débuts de requête restent espacés de 0,2 s au minimum plus la gigue. Un lot d’écriture prend le bail de la synchro automatique pour toute sa durée (et inversement il ne démarre pas si la synchro tourne), afin de ne pas additionner les débits (`INTERVALLE_MS`, `SUPPLEMENT_MAX_MS` dans `src/lib/file.ts`, `GIGUE_MAX_MS` dans `src/lib/gigue.ts`). Cela remplace les anciennes valeurs (6 s, 10 par minute, gigue de 0 à 4 ou 6 s). Les seuls garde-fous restants sont les arrêts ci-dessous. Arrêts inchangés : 401, 403, 429 (et 409 sur enchère ou défausse), 3 échecs, pause de 30 min. En parallèle, un arrêt bloque tout nouveau départ ; les requêtes déjà en vol (3 au plus) vont à leur terme, si bien que le seuil de 3 échecs peut être dépassé de 2 au plus. Risque de bannissement fortement accru, rappelé à Alexis et assumé par lui.
- **Délais variables** : un délai aléatoire (gigue de 0 à 0,1 s, `src/lib/gigue.ts`) s’ajoute à l’intervalle minimal de 0,2 s entre deux requêtes, en lecture comme en écriture, pour éviter erreurs et sanctions. La gigue n’allonge jamais l’attente ; pas de plafond par minute, arrêt sur 401, 403, 429 ou 3 échecs inchangés.
- **Synchronisation automatique activée par défaut** (le joueur peut la couper) ; les écritures dont le contrat n’est pas relevé restent « action non disponible » (enchère et défausse sont câblées depuis le 2026-11-11) : `specs/synchro-complete/releves-a-faire.md`.
- Les routes d’écriture se décrivent dans `src/lib/contrat/*` ; une route non relevée reste « action non disponible » et n’est jamais devinée.
- Les relevés réseau (authentification d’écriture, hôte Supabase) sont faits par Claude, sur le PC d’Alexis, sans manipulation de sa part, sauf l’accord préalable d’Alexis sur chaque écriture de test (carte ou étiquette choisie par lui, enchère annulée par lui) : voir `specs/synchro-complete/releves-a-faire.md`.

**Écriture des étiquettes sur le site (décision d’Alexis du 2026-11-10)** : Alexis autorise la spec `synchro-complete` (T-019 à T-026) à poser, créer et retirer des étiquettes via `POST /rest/v1/tags`, `POST /rest/v1/user_card_tags` et `DELETE /rest/v1/user_card_tags`, y compris sur l’hôte Supabase du site (exception ciblée à « serveur tiers » : cet hôte seul, jamais un autre). Le jeton de session et l’en-tête `apikey` public du site peuvent être envoyés à cet hôte seulement, lus en mémoire au moment de la requête, jamais stockés ni journalisés. Les étiquettes sont **supposées visibles des autres joueurs** : l’aperçu l’indique. **Délai variable (Alexis, 2026-11-11)** : entre deux requêtes d’écriture, 0,2 s au minimum plus un supplément aléatoire de 0 à 0,1 s depuis le 2026-11-12 (6 s et 0 à 4 s auparavant) tiré hors de `file.ts` (source injectée) ; l’absence de plafond par minute et l’arrêt après 3 erreurs ou sur 401, 403, 429 restent. Le risque de bannissement est rappelé et assumé. Le contrat est relevé (`contrat-api.md`, 2026-11-11) : hôte `cyrxjeppjqsxxjayfrur.supabase.co`, en-têtes `apikey` (clé publique du site, **en dur** dans `src/config/synchro.ts`, décision d’Alexis du 2026-11-11), `Authorization: Bearer <jeton>`, `Content-Profile`, `Content-Type`, `Accept`, et `Prefer: return=representation` pour la création. **Lecture de la session** : `jeton.ts` lit le cookie `sb-…-auth-token` (en un ou plusieurs morceaux) en mémoire à chaque requête et n’en extrait que `access_token` et l’identifiant du joueur (`sub`, utilisé pour `user_id` à la création d’une étiquette) ; jamais `refresh_token` ni `user`, un jeton expiré arrête l’envoi. Aucun test ne contacte le vrai site. Enchères et défausse suivent la décision du 2026-11-11 ci-dessus.

**Vérification Wikipédia (décision d’Alexis du 2026-11-11)** : Alexis autorise des requêtes `GET` en lecture seule vers `https://fr.wikipedia.org/w/api.php` (catégories et indicateur d’homonymie de la page) pour affiner les thèmes des cartes. Il s’agit d’un service tiers public : seul le **titre de la carte** est envoyé, jamais une donnée du compte, un cookie ou un jeton (`credentials: 'omit'`). Garde-fous :
- Automatique (décision d’Alexis du 2026-11-11, plus de bouton) : quand une carte est consultée, c’est-à-dire affichée dans la liste de la page de gestion, son titre est vérifié s’il n’est pas déjà en cache. Seules les cartes affichées sont interrogées, dans une file unique par page (`creerPlanificateur`) qui survit au démontage du composant. `src/app/verifierWikipedia.ts` est le **seul** fichier de l’application qui appelle `fetch`, et `host_permissions` ne contient que `https://fr.wikipedia.org/*`.
- Une requête à la fois, une par seconde ; arrêt sur 403 ou 429, ou après 3 échecs ; la vérification reste alors suspendue jusqu’au rechargement de la page. La page de gestion indique en permanence que les titres des cartes affichées sont vérifiés.
- Résultats mis en cache dans `chrome.storage.local` (clé `wikipedia`, 30 jours) ; `themesDeCarte` ajoute ces thèmes aux mots-clés sans rien retirer ni écraser une décision manuelle (`decidePar: 'moi'`).

**Lecture de l’activité du marché (décision d’Alexis du 2026-11-11, « j’autorise les requêtes get »)** : Alexis autorise, pour l’analyse d’affluence (spec `affluence-site`), un `GET` en lecture seule vers **une** route de listing du marché, réglée dans `src/config/affluence.ts` (`routeMarche`, relevée par Alexis le 2026-11-11 : `/api/marketplace?page=1&limit=50&sort=recent&mine=1`, champ `created_at` ; `mine=1` est à tester, il limite peut-être le listing à ses enchères). Le risque de bannissement est rappelé et assumé. Garde-fous : mêmes que la synchronisation automatique (content script, même origine, cookies du navigateur, aucun en-tête, aucun jeton lu ; fonction active seulement si la synchronisation automatique l’est ; une requête au plus toutes les 30 min, après un délai de 0,2 s depuis la requête précédente (6 s avant le 2026-11-12) ; arrêt immédiat et pause de 30 min sur 401, 403 ou 429). Seuls des horodatages sont retenus : aucun nom de joueur, aucune carte, aucun montant.

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

- `public/manifest.json` : manifeste. Permission `storage` seulement, `host_permissions` limité à `https://fr.wikipedia.org/*` (vérification Wikipédia) ; content script limité à WikiMasters.
- `src/content/index.ts` : content script, construit à part (`vite.content.config.ts`). `public/repere.css` : style des repères.
- `src/lib/lecteur.ts` : lecture du texte des cartes affichées. Toute carte de forme inattendue est ignorée.
- `src/lib/synchro.ts` : suivi des pages lues et de la prochaine à ouvrir.
- `src/background.ts` : service worker. Le clic sur l'icône ouvre `collection.html` dans un onglet. Il est éphémère : aucun état en mémoire.
- `collection.html` + `src/app/` : page de gestion (React). Composants `React.FC` + export par défaut, un par fichier.
- `src/lib/collection.ts` : modèle et logique pure (validation, édition, filtres, doublons). Sans `chrome.*`.
- `src/lib/exports.ts` : export CSV et JSON. Logique pure.
- `src/lib/themes.ts` : thèmes déduits du titre et de la description par mots-clés, recalculés sans être stockés, complétés par la surcouche Wikipédia. `src/lib/wikipedia.ts` (URL, lecture de la réponse, catégories → thèmes, cache) et `src/app/verifierWikipedia.ts` + `VerificationWikipedia.tsx` (exécuteur et bouton).
- `src/lib/tri.ts` et `src/app/AssistantTri.tsx` : assistant de tri (mes thèmes, thèmes des amis, aperçu). Règles dans l'ordre : favori ou thème à moi → garder ; thème d'un ami → échanger ; valeur inconnue → à trier ; valeur sous le seuil → défausser ; sinon → vendre au prix de la matrice. Propositions locales uniquement, sans jamais remplacer une décision manuelle (`decidePar: 'moi'`).
- `src/lib/lot.ts`, `src/lib/registre.ts` et `src/lib/apercuEtiquettes.ts` : étiquettes attendues par exemplaire, dans l'ordre « Statut · … », « #À échanger <nom> » (carte `echanger` : l'ami de la carte, puis chaque ami qui suit un thème de la carte ; remplace « Ami · <nom> »), puis les thèmes du plus précis au plus général, avec les limites du site (par exemplaire, par compte). Le registre (v2) ne retient que les étiquettes posées par l'extension : seules celles-là peuvent être retirées. `apercuEtiquettes.ts` regroupe les étiquettes prévues, les totaux et la durée pour l'aperçu. Création, pose et retrait des étiquettes sont envoyés par `src/lib/reseau.ts` (seul importeur de `src/lib/jeton.ts`, appelé depuis le content script) vers l’hôte REST de `src/config/synchro.ts`, via la table `src/lib/contrat/etiquettes.ts`, uniquement après « Lancer ». Une carte **en vente** (aux enchères) n’est plus dans la collection du joueur et le site refuse (403) toute pose sur son exemplaire : `lot.ts` ne lui envoie aucune étiquette (raison « en vente sur le site »). Enchère (`POST /api/marketplace`, durée 1 h, champ `card_id` du corps = identifiant de l’**exemplaire** possédé, le même que pour la défausse ; relevé du 2026-11-11 sur une mise manuelle) et défausse (`POST /api/user-cards/<id>/discard`) passent par la même table (`contrat/enchere.ts`, `contrat/defausse.ts`, `hote: 'site'`) : requête vers l’origine du site depuis le content script, cookies du navigateur, `Content-Type` seul, ni jeton ni clé lus. Sans identifiant d’exemplaire relié, l’enchère reste « action non disponible ». Un **409** sur une enchère ou une défausse arrête le lot (cause lisible ; le corps de la réponse n’est jamais recopié), et le plafond de places du lot tient compte des enchères en cours et du maximum relevés sur le site (`marketplace/mine`). **Plafond de défausse** (Alexis, 2026-11-11) : une carte dont la valeur marchande est inconnue ou supérieure à 5 (`PLAFOND_VALEUR_DEFAUSSE`, `src/config/prix.ts`) n’est jamais défaussée par l’extension, même décidée à la main (écartée avec une raison, revérifiée avant l’envoi) ; l’aperçu affiche la valeur.
- `src/config/amis.ts` : amis initiaux et leurs thèmes, fusionnés une seule fois dans les préférences déjà enregistrées par `stockage.ts` (sans jamais rien retirer).
- `src/app/FileVente.tsx` : ventes à lancer selon les places libres, de la plus chère à la moins chère. Le joueur indique lui-même ce qu'il a mis aux enchères.
- `src/lib/affluence.ts` et `src/config/affluence.ts` : conseil de délai de mise en vente selon les heures fortes (créneaux par défaut réglables, puis déduits des évènements `debut`/`fin` que le joueur note via les boutons de « Ventes », clé `ventes` de `stockage.ts`, 500 entrées au plus). Les heures fortes viennent aussi du relevé `affluenceSite` (horodatages du listing du marché, 2 000 au plus) quand `routeMarche` est renseignée (c’est le cas).
- `src/config/prix.ts` : **réglages à renseigner par Alexis** : seuil de défausse, limite d'enchères simultanées, matrice valeur marchande → prix de départ.
- **Valeur marchande** : moyenne affichée dans la fenêtre « Mettre aux enchères », propre à chaque carte. Relevée quand le joueur ouvre cette fenêtre, ou saisie à la main.
- **Synchronisation automatique** (lecture seule, voir le cadre d’usage) : `src/lib/lectureApi.ts` valide et convertit les réponses de l’API (stats, pages, prix), liste blanche des champs, forme inattendue ignorée. `src/lib/ordonnanceur.ts` est la logique pure du plan incrémental (`stats` → pages en `sort=added`, plus récent d’abord, avec arrêt à la première page identique quand seules de nouvelles cartes sont arrivées, et repli sur `sort=rarity` en lecture complète si l’ordre par date n’est pas confirmé → prix), cadence, budget, arrêts, bail ; horloge et transport injectés. `GET /api/marketplace/mine` est lu en fin de synchro (non bloquant, résultat dans `ventesSite` de l’état). `src/lib/gigue.ts` fournit le délai variable injecté dans l’ordonnanceur et la file. `src/lib/ecarts.ts` calcule les écarts entre étiquettes attendues et étiquettes lues sur le site. `src/content/synchroAuto.ts` est l’exécuteur du content script, **seul** fichier de `src/content` qui appelle `fetch`. `src/app/SynchroAuto.tsx` est la section de la page de gestion (interrupteur, état, écarts).
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

### Suivi et communication (Alexis ne cherche jamais)

- Alexis ne va **jamais** chercher l'état d'avancement d'un fil, d'une PR ou d'un agent, ni ce qu'on attend de lui : tout passe par le coordinateur, qui le relaie dans le chat du projet.
- Chaque fil (session de travail) termine **chaque réponse** par un bloc « Ce dont j'ai besoin d'Alexis » : questions numérotées, ou « Rien ». Une demande noyée dans le texte ne compte pas.
- Un point reporté (mineur de revue, retouche) est écrit **avec son détail** (fichier:ligne, point) dans `specs/<feature>/retouches.md` § « À reprendre », commité. Une PR ne dit jamais « non traité » sans renvoyer à cette liste (section « Reste à faire » du modèle de PR).
- Si un fil ne retrouve pas ce qu'on lui demande, il le dit au coordinateur avec ce qu'il a cherché, sans renvoyer Alexis fouiller.

### Definition of Done (une tâche)

1. Les critères d'acceptation de la tâche sont couverts par des tests écrits **avant** le code et qui passent.
2. `npm run check` et `npm run build` passent ; `npm run test:e2e` passe si la tâche touche l'UI.
3. Tâche UI : captures aux 3 breakpoints jointes à la PR, contrat de `design.md` respecté, navigable au clavier, contrastes AA.
4. Aucun fichier hors de la liste « fichiers concernés » de la tâche n'est modifié.
5. Les deux revues sont APPROVED et la CI est verte.

### Ne jamais faire

- Pousser sur `main`, forcer un push sur une branche partagée, merger sans CI verte ou avec `--admin`.
- Agir sur le site à la place du joueur hors du cadre ci-dessus.
- Lire, stocker ou journaliser un mot de passe, un cookie ou un jeton de session du site, sauf la lecture en mémoire du jeton de session, dans un seul module désigné (à nommer dans le plan), au moment d'émettre une requête vers l'origine du site, dans le content script, sans code injecté dans la page, en n’extrayant que la valeur du jeton (jamais de jeton de rafraîchissement ni d’autre cookie), sans jamais le stocker, le journaliser, l'afficher, le copier dans `chrome.storage` ni l'envoyer ailleurs qu'à l'origine du site. Envoyer des données à un serveur tiers (exceptions : le titre d'une carte vers `fr.wikipedia.org/w/api.php`, voir § Vérification Wikipédia ; l’hôte Supabase du site pour les étiquettes, décision du 2026-11-11, avec lecture en mémoire du jeton d’accès et de la clé d’API publique du site, jamais d’un jeton de rafraîchissement).
- Charger du code distant, utiliser `eval` ou assouplir la CSP du manifeste. Ajouter une permission sans la justifier dans la PR.
- Committer `.env*` ou `captures-site/` (pages réelles du compte). Utiliser des données réelles du compte dans les tests et fixtures : elles doivent toujours être fictives.
- Afficher une donnée importée ou lue sur le site avec `dangerouslySetInnerHTML` ou `innerHTML`.
- Désactiver, sauter ou mettre en quarantaine un test pour obtenir une CI verte.
- Faire le travail d'un autre agent (un dev ne modifie pas la spec, un reviewer ne corrige pas le code).
