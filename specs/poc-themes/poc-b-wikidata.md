# POC B — thèmes par Wikidata et graphe de classes

Statut : POC isolé, **non branché en production**. Rien dans `src/` n'est modifié.
Jeu de test : `tests/benchmark-themes/` (PR #193, 309 cartes, descriptions reconstruites, pas encore celles du site).

## Méthode

Aucun mot-clé libre, aucune lecture du texte de la carte. Pour chaque carte :

1. Titre de la page Wikipédia → identifiant Wikidata (`pageprops.wikibase_item`, 50 titres par requête). Page d'homonymie → aucun thème.
2. Lecture de l'entité : `P31` (instance de), `P106` (métier), `P136` (genre), `P641` (sport), `P101` (domaine), `P921`, `P361` (partie de), `P17`/`P495` (pays), `P279` (sous-classe), plus `P171` (taxon parent) pour les espèces.
3. Remontée du graphe `P279` (jusqu'à 6 niveaux) jusqu'aux classes de `poc-b/table-classes.mjs` (≈ 340 classes → thèmes du catalogue). Score = poids de la propriété × rang de la valeur ÷ (1 + distance) ; les classes trop générales sont des barrières.
4. Choix : seuil de score, thèmes parents retirés (on garde le plus précis), 4 au plus. Pour une personne, seuls les thèmes proches du meilleur sont gardés (métiers secondaires écartés). Pas de thème atteint = « sans thème fiable » (jamais « à classer »).

## Résultats (309 cartes, `npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts`)

| Méthode | Précision | Rappel | Faux thèmes | « Sans thème » à tort | Pièges déclenchés |
|---|---|---|---|---|---|
| Production (titre + description) | 94,4 % | 65,3 % | 5,6 % | 12,0 % | 0 % |
| **POC B seul** | **91,7 %** | **63,6 %** | 8,3 % | 14,6 % | 0 % |
| Hybride : B, sinon production | 91,6 % | 71,9 % | 8,4 % | 3,2 % | 0 % |
| Hybride : accord B ∩ production (sinon B) | 92,3 % | 62,5 % | 7,7 % | 14,6 % | 0 % |

Couverture : 300 cartes sur 309 ont un identifiant Wikidata (7 homonymies, 2 sans page). 264 cartes reçoivent au moins un thème.
Cartes piégeuses (39) : précision 83,3 %, rappel 53,2 % (production : 93,8 % et 63,8 %).
Par catégorie (précision / rappel) : lieu 100 / 78, notion 100 / 77, espèce 94 / 90, organisation 96 / 63, événement 93 / 58, œuvre 87 / 69, personne 83 / 57, objet 90 / 40.
Résultat complet : `poc-b/rapport.txt`, détail par carte avec la trace des classes qui ont décidé : `poc-b/resultats.json`.

## Lecture honnête

- **Biais en faveur du POC** : la table a été écrite en lisant le graphe récolté pour ces 309 cartes (les QID viennent de là). Le rappel est donc mesuré « dans l'échantillon » et sera plus bas sur une vraie collection. La précision, elle, vient de règles générales (rang des métiers, seuil relatif), mais reste réglée sur ce jeu. Seul l'export réel d'Alexis dira la vraie valeur.
- **Biais en faveur de la production** : les descriptions du jeu sont reconstruites et riches en mots-clés. B n'en dépend pas : ses scores ne bougeront pas avec les descriptions réelles, ceux de la production baisseront.
- Pur Wikidata ne bat pas la production sur ce jeu. Il est utile comme **second avis indépendant** : l'hybride « B, sinon production » garde la précision de B et monte le rappel à 71,9 % ; le « sans thème » à tort tombe à 3,2 %.
- Les pièges d'Alexis (four crématoire, wagon : « Voiture ») ne se déclenchent pas : un wagon est un « type de véhicule ferroviaire » dans Wikidata, jamais une voiture. Mais le four crématoire n'a aucune classe : B répond « sans thème » (c'est l'effet voulu, pas un succès de classement).
- Faiblesses structurelles : (1) personnes : les métiers secondaires restent (politique, littérature) ; (2) l'histoire (Seconde Guerre mondiale, nazis : 23 thèmes manqués) n'est quasi pas codée par classes, il faut `P361`/`P607`/`P710` et des QID de sujets ; (3) objets du quotidien et plats (camembert, tarte Tatin, safran) n'ont souvent ni `P31` ni `P279` utiles ; (4) sous-thèmes fins (hélicoptère, superhéros, jeu vidéo) ratés quand Wikidata ne les distingue pas.
- Limite de la récolte : des classes (marquées `(?)` dans la table) n'ont pas été vues dans le graphe ; `node poc-b/verifier-table.mjs` affiche chaque QID avec son libellé pour les relire.

## Table de correspondance

`poc-b/table-classes.mjs` : QID Wikidata → thème(s) du catalogue, poids facultatif (`theme:0.5`). Regroupée par domaine (musique, cinéma, sport, transports, lieux, taxons…). C'est le livrable réutilisable, quelle que soit la méthode retenue.

## Recommandation

Garder B comme **validateur** plutôt que comme classeur seul : un thème de la production n'est posé que si Wikidata ne le contredit pas (classe incompatible), et B complète quand la production ne trouve rien. Prochaines étapes : (1) passer le test sur l'export réel ; (2) étendre la table par les `P361` historiques ; (3) mesurer la couverture des taxons sur tout le catalogue ; (4) coût réseau : ≈ 7 requêtes pour 309 titres, ≈ 15 pour les entités (50 par requête) : bien moins que la lecture de fond actuelle.

## Rejouer

```
cd specs/poc-themes/poc-b
node --experimental-strip-types recolter.mjs [export.json]   # réseau : Wikipédia + Wikidata, 1 requête / 1,5 s, reprend où il s'est arrêté
node --experimental-strip-types taxons.mjs                    # chaînes de taxons (P171)
cd ../../.. && npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts
node specs/poc-themes/poc-b/predire.mjs export.json > predictions-b.json   # prédictions sur un export (titre, description)
```
`graphe.json` et `taxons.json` sont les caches récoltés le 2026-11-17 : le test tourne sans réseau. Les requêtes sont en lecture seule, sans cookie, avec un `User-Agent` générique (cadre d'usage : GET Wikipédia/Wikidata autorisés).

## Export de la collection d'Alexis (titre + description)

Page de gestion de l'extension ouverte (`collection.html`), clic droit › Inspecter › onglet Console, coller :

```js
chrome.storage.local.get('collection').then(({ collection }) => {
  const lignes = (collection?.cartes ?? []).map((c) => ({ titre: c.titre, description: c.description }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(lignes, null, 1)], { type: 'application/json' }));
  a.download = 'export-titres-descriptions.json';
  a.click();
});
```
(Chrome peut demander de taper `allow pasting` avant de coller.) Le fichier ne contient que des titres et des descriptions, aucun identifiant ni jeton. Le fournir tel quel au fil du banc d'essai.
