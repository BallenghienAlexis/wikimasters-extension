# Banc d’essai des thèmes

Jeu de référence et harnais de scoring pour comparer des méthodes de déduction des thèmes (étiquettes) des cartes WikiMasters.
Rien ici ne touche à la logique de production.

## Contenu

- `cartes.ts` : 317 cartes (titre, description courte du site, page Wikipédia, 1 à 4 thèmes de référence du catalogue de `src/lib/themes.ts`, justification), classées par catégorie (personne, œuvre, organisation, lieu, objet, événement, notion, espèce, homonymie, nom propre). Les cas piégeux (`piege: true`) portent le plus souvent des `interdits` (pas toujours : certains pièges n’ont pas de faux thème nommable) : le faux thème exact relevé par Alexis (Four crématoire → Animaux, Wagon → Voiture, Jaguar → félin…).
- `types.ts` : `CarteReference`, `FonctionDeduction`.
- `scoring.ts` : `evaluer(fonction)` (asynchrone, une carte à la fois), `scorerPredictions(titre → thèmes)` (prédictions déjà calculées, par exemple lues d’un JSON), `formaterRapport`.
- `production.ts` : la déduction actuelle comme ligne de base.

## Utiliser le harnais depuis un POC

```ts
import { evaluer, formaterRapport } from './scoring';

const rapport = await evaluer(async ({ titre, description, wikipedia }) => {
  // … ta méthode : renvoie des identifiants du catalogue (ex. ['metalcore'])
  return [];
}, { fiabiliteMin: 'moyenne' });
console.log(formaterRapport(rapport, 'mon POC'));
```

`npx vitest run tests/unit/benchmark-themes.test.ts` valide le jeu et affiche la ligne de base de production.

## Mesures

- **précision** = thèmes corrects / (corrects + faux) ; **rappel** = corrects / attendus ; **faux thèmes** = 1 − précision.
- Un thème en `acceptables` (parent, voisin défendable) est neutre : ni correct ni faux.
- **« sans thème » à tort** : cartes de référence non vide dont la déduction est vide.
- **pièges déclenchés** : cartes avec `interdits` dont un thème interdit a été prédit.
- Pas de thème fiable ? `themes: []` dans la référence : toute proposition compte alors comme fausse proposition (`tauxFauxSurCartesVides`).

## Limites connues

- Les descriptions sont **reconstruites** d’après des pages publiques (style Wikidata), pas lues sur le compte ni sur le site : elles peuvent différer de celles de WikiMasters. Les cartes `fiabilite: 'a-verifier'` (Cambuses nord-américaines, Malibu, Crayon…) ont une description ou un thème à confirmer ; `fiabiliteMin: 'moyenne'` ou `'haute'` les écarte.
- Les thèmes de référence sont un jugement (pas une vérité du site) ; ils ne contiennent jamais les parents. Le catalogue peut évoluer : le test vérifie que chaque thème existe.
- Aucun accès à la collection réelle depuis cette session : pour l’étendre avec des cartes réelles, ajouter des lignes à `cartes.ts` avec la description exacte du site.

## Ligne de base (production, titre + description, sans cache Wikipédia)

Précision 94,4 %, rappel 65,3 %, faux thèmes 5,6 %, « sans thème » à tort 12,0 % (309 cartes). Ce score est **optimiste** : les descriptions du jeu sont complètes et riches en mots-clés, alors que celles du site sont souvent plus courtes ou vides. Ne comparer que des méthodes évaluées sur le même jeu.
