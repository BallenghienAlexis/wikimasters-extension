# POC thèmes — méthode hybride par accord entre signaux

Statut : **POC isolé, non branché sur la production** (rien dans `src/`, aucune permission, aucune dépendance ajoutée). Tout vit dans `specs/poc-themes/poc/`.

## Ce qui est livré, et ce qui ne l'est pas

| | État |
|---|---|
| Cinq signaux indépendants (`signaux.ts`) et deux règles de vote (`vote.ts`) | Livré, testé |
| Banc d'essai : précision, rappel, faux thèmes, abstentions (`evaluation.ts`, `poc.test.ts`) | Livré, testé |
| Collecteur de pages réelles Wikipédia + Wikidata (`collecter.mjs`) | Livré, **lecteurs testés sur réponses factices, jamais exécuté contre le vrai réseau** |
| Mesure sur des cartes réelles de WikiMasters | **Non faite** : voir ci-dessous |
| Modèle local gratuit mesuré | **Non fait** : étude de faisabilité seulement |

**Pourquoi pas de mesure réelle.** Le conteneur de développement n'a pas accès à `fr.wikipedia.org` ni `www.wikidata.org` (le proxy refuse la connexion, vérifié). Le jeu de test annoncé dans `tests/benchmark-themes/` n'existait pas encore sur `main` au moment du travail. J'ai donc écrit un **mini-jeu provisoire de 20 cartes, dont les pages Wikipédia sont rédigées à la main** (`poc/jeu-provisoire.json`, origine « ecrit-a-la-main »). Ces textes imitent Wikipédia mais ne sont pas des relevés : les chiffres ci-dessous ne prouvent rien sur la qualité réelle, ils ne servent qu'à vérifier que le banc fonctionne et à faire apparaître des défauts de principe.

## Les signaux

Chaque signal ne regarde qu'une source et propose des thèmes du catalogue ; il ne décide rien.

1. `site` : définition de la description de la carte sur WikiMasters.
2. `definition` : première phrase (« X est un… ») de l'introduction Wikipédia.
3. `wikidata` : courte description et libellés des classes (P31, P106, P136, P641).
4. `categories` : catégories visibles de la page (sans maintenance).
5. `lexical` : classifieur local léger sur **toute l'introduction** : un thème est retenu s'il est porté par la première phrase ou par au moins deux phrases, et s'il pèse 40 % du meilleur.

Règle de vote : un signal qui propose un thème soutient aussi ses ancêtres ; un thème est posé si son score atteint le seuil ; le plus précis l'emporte sur ses ancêtres ; 4 thèmes au plus ; veto des thèmes « physiques » (animal, véhicule, astre, lieu, science) pour une personne, une œuvre, une organisation, un produit ou une notion, sauf si la définition ou Wikidata les portent ; sinon liste vide = « sans thème fiable » (jamais « À classer » ni « Autres »).

- **V1** : au moins 2 signaux sur 5.
- **V2** : définition et Wikidata pèsent 2, les autres 1, seuil 3.
- **V3** : V2, et s'il ne retient rien, les thèmes de la production actuelle ne passent que s'ils sont portés par la définition.
- **A** : production actuelle (`themesPrincipaux`), alimentée par les mêmes données.

## Résultats sur le mini-jeu provisoire (20 cartes écrites à la main : indicatif seulement)

| Méthode | Précision | Rappel | Faux thèmes / posés | Cartes avec faux thème | Sans thème | Abstentions correctes |
|---|---|---|---|---|---|---|
| A production actuelle | 80 % | 80 % | 2 / 20 (10 %) | 2 / 20 | 3 / 20 | 2 / 2 |
| V1 accord de 2 signaux | 81 % | 85 % | 2 / 21 (10 %) | 2 / 20 | 3 / 20 | 2 / 2 |
| V2 pondéré | 80 % | 80 % | 2 / 20 (10 %) | 2 / 20 | 3 / 20 | 2 / 2 |
| V3 V2 + repli par la définition | 80 % | 80 % | 2 / 20 (10 %) | 2 / 20 | 3 / 20 | 2 / 2 |

Reproduire : `npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts` (détail par carte et par signal dans la sortie ; `POC_SORTIE=fichier` l'écrit).

**Lecture honnête.** Sur ce jeu les méthodes sont indiscernables : 20 cartes, pages écrites par moi, donc trop favorables (la production a déjà corrigé les pièges four crématoire, wagon, lion). Aucune conclusion de supériorité du vote n'est permise. En revanche, trois constats de principe sont solides, car reproductibles avec le code de production :

1. **L'accord entre signaux n'est indépendant que si les signaux n'utilisent pas le même lexique.** Les cinq signaux passent tous par les mêmes motifs de `themes.ts` ; une erreur du lexique est donc « confirmée » par plusieurs signaux et le vote la laisse passer. Exemple vérifié : « opérateur de télécommunications » donne `#Musique classique` (le motif `opera` n'a pas de borne de mot et trouve « *opéra*teur »), « opérateur historique » donne en plus `#Histoire` ; « entreprise » donne `#Société`. Sur « Orange (entreprise) », le vote retient donc `classique` et `societe` (site, Wikidata et catégories s'accordent… sur une erreur). **C'est un défaut du catalogue de production, à corriger à part** (non touché ici, POC isolé).
2. **Le vote ne crée pas de rappel.** « Charles Lindbergh » (aviateur) reste sans thème avec toutes les méthodes : aucun motif ne relie « aviateur » à `#Avion`. Un trou de lexique ne se comble pas en comptant les signaux.
3. **Le seuil de 2 signaux coûte du rappel sur les thèmes précis** : « Hitler » garde `nazis` avec V1 (catégories + lexical) mais le perd avec V2 (deux signaux faibles = 2 < 3). Le choix du seuil est un arbitrage précision/rappel à régler sur le vrai jeu.

## Ce qu'il faut pour trancher : un signal vraiment indépendant

Pour qu'un accord vaille quelque chose, au moins un signal doit ne **pas** reposer sur les motifs de texte du catalogue :

- **Table d'identifiants Wikidata → thème** : la collecte garde déjà les identifiants des classes (`idsClassesWikidata`). Une table courte et vérifiée à la main (film, groupe de musique, constructeur automobile, aéroport, montagne, taxon…) donnerait un signal sans lexique, donc sans erreur de type « opérateur ». Non faite ici : je ne veux pas écrire d'identifiants Wikidata de mémoire sans pouvoir les vérifier.
- **Modèle local** (voir ci-dessous) comme signal supplémentaire, branché par une simple fonction `page → thèmes`.

## Faisabilité d'un modèle gratuit plus fiable que Gemini Nano

Rien ci-dessous n'a été mesuré ici ; ce sont des pistes à évaluer, avec ce que chacune impose.

| Piste | Gratuit | Automatique | Ce qu'elle impose |
|---|---|---|---|
| Gemini Nano (Prompt API de Chrome) | oui | oui | Déjà essayé par Alexis : instable, thèmes trop généraux (relevé du 2026-11-15). À garder comme arbitre au mieux, pas comme classeur. |
| Embeddings multilingues dans le navigateur (transformers.js + ONNX, type e5-small) : thème le plus proche d'une définition | oui | oui | Exécuter du WebAssembly dans l'extension demande `wasm-unsafe-eval` dans la CSP, ce que `AGENTS.md` interdit sans décision d'Alexis ; poids à télécharger (serveur tiers, nouvelle `host_permission`) ou à embarquer (plusieurs dizaines de Mo). Précision non connue. |
| Script sur le PC d'Alexis (Node, ou petit modèle local type Ollama) qui lit le fichier d'export existant et rend le JSON d'import | oui | oui, une fois par lot, résultat en cache par titre | Aucune permission ni CSP à changer : il réutilise le circuit « Exporter / Importer » déjà en place. Dépend du matériel du PC ; qualité à mesurer sur le vrai jeu. |

Ma recommandation, à valider sur le vrai jeu : **ne pas viser un modèle seul**, mais ajouter le script PC (dernière piste) comme signal du vote, avec la table d'identifiants Wikidata comme second signal sans lexique.

## Lancer sur le PC d'Alexis (pages réelles)

1. Préparer `cartes.json` : `[{ "titre": "…", "description": "…", "attendu": ["train"], "toleres": [] }, …]` (le jeu de `tests/benchmark-themes/` une fois disponible ; le format est à adapter, trois lignes).
2. `node specs/poc-themes/poc/collecter.mjs cartes.json jeu-reel.json` : 3 à 4 requêtes `GET` par carte, 1 par seconde, un seul fil, arrêt sur 403/429, reprise automatique en relançant. Seul le titre est envoyé. Pour 200 cartes, compter environ 10 à 15 minutes.
3. `POC_JEU=jeu-reel.json POC_SORTIE=resultats.txt npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts`.

Le collecteur n'a jamais tourné contre le vrai réseau : un premier essai sur 3 cartes est prudent. La forme des réponses suit celle que la production lit déjà (`src/lib/wikipedia.ts`).

## Suites proposées

1. Corriger le lexique de production signalé en 1 (`opera` sans borne, `entreprise` → `societe`) : correctif séparé, petit, avec test.
2. Mesurer A, V1, V2, V3 sur le vrai jeu (collecte sur le PC), ajuster les seuils.
3. Ajouter la table d'identifiants Wikidata et, si Alexis le valide, le script PC avec modèle local comme signaux indépendants ; ne brancher en production qu'une méthode qui bat A sur les faux thèmes **sans** perdre trop de rappel.
