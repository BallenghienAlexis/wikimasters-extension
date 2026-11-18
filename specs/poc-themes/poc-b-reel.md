# POC B (Wikidata) rejoué sur l'export réel (2026-11-18)

Export fourni par Alexis : 4 733 cartes. Mesure sur les **277 cartes réelles de référence** (thèmes jugés à la main) et couverture sur un **échantillon de 1 077 cartes** (les 277 + 800 tirées au hasard, graine 7). Le graphe Wikidata complet des 4 733 titres n'a pas été récolté (trop lent derrière le proxy partagé, 1 requête / 1,5 s) ; l'échantillon donne l'ordre de grandeur. Aucune donnée du compte n'est versée au dépôt (seuls restent les 277 titres/descriptions déjà autorisés).

## Résultats sur les 277 cartes réelles

| Méthode | Précision | Rappel | F1 | « Sans thème » à tort |
|---|---|---|---|---|
| Production actuelle | 94,9 % | 49,2 % | 64,8 | 33,6 % |
| POC B seul | 87,4 % | 55,5 % | 67,9 | 23,9 % |
| Hybride B sinon production | 87,3 % | 61,8 % | 72,4 | 14,2 % |
| Hybride production sinon B | 90,5 % | 60,1 % | 72,3 | 14,2 % |

Lecture : sur de vraies descriptions, la production perd beaucoup de rappel (65 % → 49 %), B reste stable. B seul est moins précis (la table a été écrite sur le jeu synthétique ; elle a été complétée depuis par des classes fréquentes de l'échantillon, sans regarder les erreurs de référence). **La meilleure combinaison gratuite et automatique est « production d'abord, B pour compléter »** : 90,5 % de précision, 60,1 % de rappel, soit 12 points de rappel gagnés pour 4 points de précision perdus.

## Couverture sur l'échantillon (1 077 cartes)

- Production non vide : 669 (62 %) ; B non vide : 764 (71 %) ; hybride : 872 (81 %).
- Quand les deux répondent (561) : identiques 414, chevauchement 28, disjoints 119 (les disjoints sont les cartes à revoir en priorité).
- B seul apporte 203 cartes, la production seule 108.
- Reste sans thème : **≈ 19 %**, soit environ **900 cartes sur 4 733**.

## Pourquoi pas 100 %

1. Les thèmes de référence sont l'avis d'un juge : plusieurs thèmes plausibles par carte, l'écart avec le référentiel n'est pas toujours une erreur.
2. Homonymies et noms de famille : « vide » est parfois la bonne réponse (hors thème « noms »).
3. Entités rares sans classe Wikidata utile et sans description (taxons obscurs, blasons, journaux locaux, régiments) : il faut l'introduction ou les catégories Wikipédia.
4. Sujets historiques (guerre, nazis) : peu codés en classes, il faut P361/P607 et des QID de sujets.

Sur les 73 cartes vides de B (277), les causes dominantes : taxons obscurs, entités administratives/historiques, sport régional, homonymies.

## Combinaison proposée (du plus automatique au manuel)

1. Règles actuelles (mots-clés, description du site).
2. Wikidata (méthode B, table de `poc-b/table-classes.mjs`) pour compléter ou départager.
3. Signaux de la page Wikipédia (résumé, catégories : voir `rapport.md`, V7) pour les cartes encore vides.
4. Export IA manuel pour le reste : environ 900 cartes, soit 6 à 7 fichiers de 150.

Objectif réaliste : couverture ≈ 90 % avant l'étape manuelle, précision ≈ 90 %, 100 % seulement après relecture du joueur.

## Rejouer

```
EXPORT=export.json GRAPHE=graphe.json SORTIE=sortie npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts reel
```
