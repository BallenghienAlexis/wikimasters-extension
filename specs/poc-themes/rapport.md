# POC thèmes — méthode hybride par accord entre signaux

Statut : **POC isolé, non branché sur la production** (rien dans `src/`, aucune permission, aucune dépendance ajoutée). Tout vit dans `specs/poc-themes/poc/`.

## Ce qui est livré, et ce qui ne l'est pas

| | État |
|---|---|
| Cinq signaux indépendants (`signaux.ts`) et deux règles de vote (`vote.ts`) | Livré, testé |
| Banc d'essai : précision, rappel, faux thèmes, abstentions (`evaluation.ts`, `poc.test.ts`) | Livré, testé |
| Collecteur de pages réelles Wikipédia + Wikidata (`collecter.mjs`) | Livré, exécuté sur les 317 cartes depuis le conteneur (réseau ouvert depuis le 2026-11-17 soir ; 429 de Wikimedia sur IP partagée, attente de `Retry-After` via `POC_ATTENDRE_429=1`, `NODE_USE_ENV_PROXY=1` pour que Node passe par le proxy) |
| Branchement sur le banc d'essai commun (`benchmark.test.ts`) | Livré et exécuté |
| Mesure sur le jeu commun avec pages Wikipédia et Wikidata réelles (313 cartes) | **Faite le 2026-11-18** (section « Résultats sur le jeu commun ») |
| Modèle local gratuit mesuré | **Non fait** : étude de faisabilité seulement |

**Historique.** Le premier jet a été écrit sans accès à Wikipédia ni Wikidata (proxy fermé) : le mini-jeu provisoire de 20 cartes, dont les pages étaient rédigées à la main, ne servait qu'à valider le banc. Le réseau s'est ouvert ensuite : les 317 cartes du jeu commun (`tests/benchmark-themes/`, PR #193) ont été collectées avec `collecter.mjs` et mesurées, voir « Résultats sur le jeu commun ». Seuls ces derniers chiffres comptent.

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
- **V4** : V2 avec ancrage (un thème doit être porté par la définition, Wikidata ou la description du site). **V5** : V4 et seuil relatif de 60 % du meilleur score. **V6** : un seul signal classificatoire suffit, seuil relatif de 60 %. **V7** : production sur titre + description, sinon V6.
- **A** : production actuelle (`themesPrincipaux`), alimentée par les mêmes données.

## Résultats sur le jeu commun (313 cartes de fiabilité moyenne ou haute, pages réelles collectées le 2026-11-18)

Mesures par `evaluer` (`tests/benchmark-themes/`), sortie brute dans `resultats-benchmark.txt`. « Production » = titre + description du site seuls, comme la ligne de base du jeu ; « A » = production alimentée en plus par les signaux Wikipédia et Wikidata de la page (ce que fait la production quand son cache est rempli).

| Méthode | Précision | Rappel | F1 | Sans thème à tort | Pièges déclenchés |
|---|---|---|---|---|---|
| Production (titre + description) | 95,1 % | 65,2 % | 77,4 % | 12,5 % | 0 % |
| A production + pages Wikipédia/Wikidata | 72,7 % | 75,5 % | 74,0 % | 1,6 % | 0 % |
| V1 accord de 2 signaux | 67,4 % | 72,4 % | 69,8 % | 8,9 % | 0 % |
| V2 pondéré (seuil 3) | 70,0 % | 65,7 % | 67,8 % | 11,1 % | 0 % |
| V4 V2 + ancrage (définition, Wikidata ou site) | 70,0 % | 65,7 % | 67,8 % | 11,1 % | 0 % |
| V5 V4 + 60 % du meilleur score | 80,7 % | 58,2 % | 67,6 % | 11,1 % | 0 % |
| V6 un signal classificatoire + 60 % du meilleur | 85,6 % | 64,6 % | 73,7 % | 5,2 % | 0 % |
| **V7 production titre+description, sinon V6** | 90,1 % | 68,8 % | **78,0 %** | 3,6 % | 0 % |

Pour comparaison (rapporté par le fil du POC B, PR #197, non remesuré ici) : Wikidata seul 91,3 % / 63,6 % ; hybride Wikidata puis production 91,3 % / 71,9 % / 3,2 % sans thème à tort.

**Conclusions**

1. **Le vote « au moins deux signaux » ne marche pas.** V1, V2 et V4 sont moins précis que la production seule (67 à 70 % contre 95 %) : l'idée de départ est invalidée sur ce jeu. Raison : les faux thèmes dominants ne sont pas des erreurs de mot isolées mais des rôles secondaires que plusieurs signaux confirment (littérature pour Hitler, éducation pour Einstein, arts pour Kurt Cobain, politique pour Victor Hugo). Les catégories Wikipédia d'une personne listent tous ses rôles, et le texte complet répète les mêmes mots : les signaux s'accordent donc sur un thème secondaire. Plus de signaux ne donne pas plus de précision.
2. **Ce qui aide est de ne faire confiance qu'à ce que la page dit être le sujet** (définition, classes Wikidata, description) et d'écarter ce qui pèse moins de 60 % du meilleur thème (V6 : 85,6 % contre 72,7 % pour A, à rappel proche). C'est la même logique que le POC B, qui fait mieux (91,3 % de précision à 71,9 % de rappel).
3. **Aucune de mes méthodes ne bat le meilleur résultat du POC B.** V7 gagne un peu en F1 sur la production (78,0 % contre 77,4 %) en divisant par plus de trois les cartes sans thème à tort, mais perd 5 points de précision. Je ne recommande pas de brancher le vote.
4. **Alerte sur la production avec pages (A) : 27 % de faux thèmes** sur ce jeu quand le cache Wikipédia est rempli, contre 5 % sans. Ce sont presque tous des thèmes secondaires posés en plus du principal (littérature ×14, éducation ×9, idées ×7, arts ×7, politique ×7 pour A). À vérifier dans le fil qui suit les faux thèmes : la pondération de `themesPrincipaux` laisse passer des thèmes de catégories jusqu'à 4 par carte.

**Limites** : le jeu est un jugement (thèmes de référence 1 à 4 sans parents ; un thème secondaire défendable compte comme faux s'il n'est pas dans `acceptables`), ses descriptions sont reconstruites et riches en mots-clés (la ligne de base « titre + description » est optimiste), 313 cartes. Les pages ont été lues le 2026-11-18 : Wikipédia change. Le jeu réel d'Alexis (export de sa collection) reste à mesurer.

## Mini-jeu provisoire (20 cartes écrites à la main, avant l'accès réseau : indicatif seulement)

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

## Faisabilité d'un modèle gratuit plus fiable que Gemini Nano

Rien ci-dessous n'a été mesuré ici ; ce sont des pistes à évaluer, avec ce que chacune impose.

| Piste | Gratuit | Automatique | Ce qu'elle impose |
|---|---|---|---|
| Gemini Nano (Prompt API de Chrome) | oui | oui | Déjà essayé par Alexis : instable, thèmes trop généraux (relevé du 2026-11-15). À garder comme arbitre au mieux, pas comme classeur. |
| Embeddings multilingues dans le navigateur (transformers.js + ONNX, type e5-small) : thème le plus proche d'une définition | oui | oui | Exécuter du WebAssembly dans l'extension demande `wasm-unsafe-eval` dans la CSP, ce que `AGENTS.md` interdit sans décision d'Alexis ; poids à télécharger (serveur tiers, nouvelle `host_permission`) ou à embarquer (plusieurs dizaines de Mo). Précision non connue. |
| Script sur le PC d'Alexis (Node, ou petit modèle local type Ollama) qui lit le fichier d'export existant et rend le JSON d'import | oui | oui, une fois par lot, résultat en cache par titre | Aucune permission ni CSP à changer : il réutilise le circuit « Exporter / Importer » déjà en place. Dépend du matériel du PC ; qualité à mesurer sur le vrai jeu. |

Ma recommandation, à valider sur le vrai jeu : **ne pas viser un modèle seul**, mais ajouter le script PC (dernière piste) comme signal du vote, avec la table d'identifiants Wikidata comme second signal sans lexique.

## Reproduire et rejouer sur d'autres cartes

Le jeu commun est `tests/benchmark-themes/` (PR #193, 317 cartes) ; `benchmark.test.ts` le branche sur `evaluer` et `formaterRapport`.

1. Exporter les cartes : `POC_EXPORT_CARTES=/chemin/hors/depot/cartes.json npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts`.
2. Collecter les pages : `NODE_USE_ENV_PROXY=1 POC_ATTENDRE_429=1 node specs/poc-themes/poc/collecter.mjs cartes.json pages.json` (sur un PC avec internet, `NODE_USE_ENV_PROXY` est inutile). 3 à 4 requêtes `GET` par carte, 1 par seconde, un seul fil, seul le titre de la page est envoyé, reprise automatique en relançant. Sur les 317 cartes, la collecte a tourné le 2026-11-18 depuis le conteneur : l'adresse sortante est partagée avec d'autres fils et Wikimedia a répondu des 429 (attente de `Retry-After`).
3. Mesurer : `POC_PAGES=pages.json POC_RAPPORT=resultats.txt npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts` (`POC_ANALYSE=analyse.txt` écrit aussi les faux thèmes les plus fréquents par méthode ; celui du 2026-11-18 est dans `analyse-faux-themes.txt`, c'est la source des décomptes cités en conclusion 4).

Sans `POC_PAGES`, seule la production (titre + description) est mesurée.

**Attention.** `POC_ATTENDRE_429=1` déroge à la règle de production « arrêt sur 429 » (`AGENTS.md`, ligne Wikipédia / Wikidata) : il sert à ce script de recherche, hors extension, et ne doit pas être repris dans le code de l'extension. Si le script est rejoué sur l'export réel de la collection d'Alexis, écrire `cartes.json`, `pages.json` et `*.reprise.jsonl` **hors du dépôt** : ils contiendraient des données du compte et ne doivent jamais être commités.

## Suites proposées

1. Ne pas brancher le vote. Garder du POC l'enseignement : ancrer les thèmes sur la définition, Wikidata et la description, et limiter les thèmes secondaires (seuil relatif).
2. Enquêter sur les 27 % de faux thèmes de la production avec pages remplies (point 4 ci-dessus) : c'est probablement le levier le plus rentable, et il touche `themesPrincipaux`.
3. Table d'identifiants Wikidata → thème (`idsClassesWikidata` est déjà collecté) comme signal sans lexique, avec le POC B.
4. Mesurer sur l'export réel de la collection d'Alexis quand il existe.
