# Classes Wikidata en repli et règles anti-faux thèmes (2026-11-19)

Reprise en production des recommandations des POC thèmes (PR #197, #199 et rapport « faux thèmes » du 2026-11-19), demandée par Alexis.

## Ce qui change

1. **Wikidata en repli** : quand les règles locales (définition, mots-clés, titre, description) ne donnent aucun thème, les thèmes se déduisent des classes de l’entité Wikidata (instance de, métier, genre, sport, sous-classe de, remontée de 7 niveaux) par une table classe → thème (`src/lib/tableWikidata.ts`, environ 340 classes). Un thème local n’est jamais remplacé.
2. **Catégories Wikipédia en confirmation seulement** : elles confirment ou précisent un thème déjà établi, elles n’en ajoutent plus de secondaire (rôles secondaires des personnes exclus). Dernier recours seulement si rien d’autre n’existe.
3. **Seuil de 60 %** au lieu de 40 % (accepté par Alexis), meilleur poids plafonné à 5.
4. **Noms propres de lieux neutralisés** avant la recherche de mots-clés : Saint-X, Mont-X, Lac-X, Fond du Lac, Pays-Bas, outre-mer, -sur-Mer.

Réseau : aucune permission ni hôte nouveau. La lecture de l’entité demande plus de propriétés dans la requête existante, et les ancêtres des classes se lisent par lots de 50 identifiants, même cadence (1 requête par seconde), mêmes arrêts 403 et 429. Les ancêtres lus sont mémorisés (clé `grapheWikidata`, 25 000 entités au plus) : une classe n’est jamais redemandée. `VERSION_REGLES` passe à 4 : la lecture de fond relit une fois les cartes déjà en cache.

## Mesure sur les 277 cartes réelles du banc (titre + description, graphe Wikidata récolté le 2026-11-19)

| Méthode | Précision | Rappel | F1 | Sans thème à tort |
|---|---|---|---|---|
| Avant : production | 94,9 | 49,2 | 64,8 | 33,6 |
| Après : production, sinon Wikidata | 90,4 | 59,5 | 71,7 | 14,6 |
| Wikidata seul (information) | 87,2 | 54,2 | 66,8 | 25,0 |

Rejouer : `AVANT=<copie de src avant la reprise> npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts mesure-production`.

## Limites

- Le banc ne contient pas les pages Wikipédia : l’effet des catégories en confirmation, du seuil de 60 % et des noms de lieux sur des pages réelles se juge sur les cas de `tests/unit/themes-anti-faux.test.ts` et sur le diagnostic du 2026-11-19 (seuil 60 % : environ 83 % de précision pour 70 % de rappel sur le jeu de 313 cartes avec pages). `mesure-pages.test.ts` mesure l’avant/après avec des pages collectées.
- Le rappel mesuré est « dans l’échantillon » : la table a été guidée par la fréquence des classes d’un export réel de 1 077 cartes, sans regarder les cartes de référence, mais reste réglée sur ce type de contenu.
- Le graphe mémorisé pèse environ 1 à 2 Mo après lecture de toute la collection ; le stockage local de l’extension est limité à 10 Mo.
