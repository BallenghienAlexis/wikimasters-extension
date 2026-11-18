# Banc d’essai des thèmes

Jeu de référence et harnais de scoring pour comparer des méthodes de déduction des thèmes (étiquettes) des cartes WikiMasters.
Rien ici ne touche à la logique de production.

## Contenu

- `cartes-reelles.ts` : **277 cartes réelles** tirées de la collection d’Alexis (sauvegarde du 2026-11-18, tirage au sort fixe) : titre et description du site **seulement** (jamais identifiant, rareté, quantité, prix, note, ami). 75 n’ont aucune description sur le site (cas réel, ~30 % de la collection) ; les thèmes de ces cartes sont déduits du titre seul (`fiabilite: 'moyenne'`). Contient les cas relevés (Four crématoire, Cambuses nord-américaines = fourgon-frein donc Train, Longmorn, Maitrank, Solution de Dakin, Adolf Hitler, Vera Salvequart, Der Angriff, Regelbau 602, Novelists…).
- `sauvegarde.ts` : conversion d’une sauvegarde de l’extension : `lireSauvegarde` (titre + description seulement), `appliquerDescriptions` (remplace les descriptions du jeu par les vraies, garde les thèmes), `cartesAReferencer` (cartes de la sauvegarde absentes du jeu, pour l’étendre).
- `cartes.ts` : cartes **reconstruites** (298, célèbres : descriptions d’après des pages publiques, moins réalistes que les réelles) ; `CARTES_REFERENCE` = reconstruites + réelles. Avant : 317 cartes (titre, description courte du site, page Wikipédia, 1 à 4 thèmes de référence du catalogue de `src/lib/themes.ts`, justification), classées par catégorie (personne, œuvre, organisation, lieu, objet, événement, notion, espèce, homonymie, nom propre). Les cas piégeux (`piege: true`) portent le plus souvent des `interdits` (pas toujours : certains pièges n’ont pas de faux thème nommable) : le faux thème exact relevé par Alexis (Four crématoire → Animaux, Wagon → Voiture, Jaguar → félin…).
- `types.ts` : `CarteReference`, `FonctionDeduction`.
- `scoring.ts` : `evaluer(fonction)` (asynchrone, une carte à la fois), `scorerPredictions(titre → thèmes)` (prédictions déjà calculées, par exemple lues d’un JSON), `formaterRapport`.
- `production.ts` : la déduction actuelle comme ligne de base.

## Utiliser le harnais depuis un POC

```ts
import { evaluer, formaterRapport } from './scoring';

const rapport = await evaluer(async ({ titre, description, wikipedia }) => {
  // … ta méthode : renvoie des identifiants du catalogue (ex. ['metalcore'])
  return [];
}, { source: 'reelle', fiabiliteMin: 'moyenne' });
console.log(formaterRapport(rapport, 'mon POC'));
```

`npx vitest run tests/unit/benchmark-themes.test.ts` valide le jeu et affiche la ligne de base de production.

## Mesures

- **précision** = thèmes corrects / (corrects + faux) ; **rappel** = corrects / attendus ; **faux thèmes** = 1 − précision.
- Un thème en `acceptables` (parent, voisin défendable) est neutre : ni correct ni faux.
- **« sans thème » à tort** : cartes de référence non vide dont la déduction est vide.
- **pièges déclenchés** : cartes avec `interdits` dont un thème interdit a été prédit.
- Pas de thème fiable ? `themes: []` dans la référence : toute proposition compte alors comme fausse proposition (`tauxFauxSurCartesVides`).

## Mettre à jour avec une nouvelle sauvegarde

```ts
import { readFileSync } from 'node:fs';
import { appliquerDescriptions, cartesAReferencer, lireSauvegarde } from './sauvegarde';

const lues = lireSauvegarde(readFileSync('wm-sauvegarde.json' /* ignoré par git */, 'utf8'));
const { cartes, remplacees, absentes } = appliquerDescriptions(lues);
const nouvelles = cartesAReferencer(lues); // candidates à de nouvelles références
```

Le fichier de sauvegarde lui-même ne doit **pas** être commité.

## Limites connues

- Les cartes **reconstruites** ont des descriptions inventées d’après des pages publiques : plus riches que celles du site, elles flattent les méthodes à base de mots-clés. Préférer `source: 'reelle'` pour comparer. Les cartes `a-verifier` (Malibu, Crayon, Shoobidoo Labs…) n’existent pas dans la collection : leur description reste à confirmer ou à retirer.
- Les thèmes de référence sont un jugement (pas une vérité du site) ; ils ne contiennent jamais les parents. Le catalogue peut évoluer : le test vérifie que chaque thème existe.
- Les 277 cartes réelles sont un échantillon (202 avec description, 75 sans, tirage fixe) ; la collection est bien plus grande. Thèmes de référence = jugement, comme pour le reste.

## Ligne de base (production, titre + description, sans cache Wikipédia ni Wikidata)

| Jeu | Cartes | Précision | Rappel | « Sans thème » à tort |
|---|---|---|---|---|
| Réelles | 277 | 94,9 % | 49,2 % | 33,6 % |
| Reconstruites | 298 | 94,9 % | 66,1 % | 12,4 % |
| Complet | 575 | 94,9 % | 58,1 % | 22,6 % |

Sur les cartes réelles la déduction de production ne trouve rien pour un tiers des cartes avec les seules données du site : c’est l’écart que les POC (page Wikipédia complète, Wikidata, vote) doivent combler. La production réelle utilise en plus le cache Wikipédia, que ce harnais ne reconstitue pas : une méthode qui lit Wikipédia doit être comparée à cette ligne de base **et** à la production avec cache.
