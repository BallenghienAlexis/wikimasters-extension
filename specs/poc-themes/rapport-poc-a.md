# POC A : page Wikipédia complète (infobox, sections, catégories, liens)

Statut : **POC isolé, non branché sur la production**. Rien dans `src/`, aucune permission, aucune dépendance. Code dans `specs/poc-themes/poc-a-page-complete/`, test dans `tests/unit/poc-a-page-complete.test.ts`.

## Résultat chiffré (mesuré le 2026-11-18, pages réelles de fr.wikipedia.org)

Banc : `tests/benchmark-themes/` (317 cartes, descriptions **reconstruites**, pas celles du site). Pages collectées par `collecter.mjs` (317/317, une requête `action=parse` par carte ; le site a répondu plusieurs 429 sur l'adresse partagée, le collecteur a respecté `Retry-After`). Même fonction `evaluer` pour toutes les lignes.

| Méthode | Précision | Rappel | « Sans thème » à tort | Pièges déclenchés |
|---|---|---|---|---|
| **P production** (titre + description) | **95,2 %** | 65,0 % | 12,9 % | 0 % |
| A0 intro + catégories (page, scoring pondéré) | 55,5 % | 71,3 % | 7,1 % | 9,4 % |
| A1 + infobox | 56,4 % | 72,7 % | 6,8 % | 9,4 % |
| A2 + sections | 57,2 % | 73,3 % | 6,8 % | 9,4 % |
| A3 page complète | 57,8 % | 72,2 % | 6,8 % | 7,5 % |
| A4 complète, 2 canaux forts | 77,5 % | 57,0 % | 23,6 % | 3,8 % |
| A5 complète, 2 canaux forts, seuil 5 | 79,4 % | 56,2 % | 23,6 % | 3,8 % |
| H1 production, puis A5 si production vide | 93,2 % | **67,5 %** | **7,8 %** | 0 % |
| H2 production filtrée par A3 | **97,1 %** | 55,6 % | 31,7 % | 0 % |
| H3 H2, puis A5 si vide | 91,0 % | 63,9 % | 14,9 % | 0 % |

### Ce que ça dit

1. **La page complète seule est nettement moins fiable que la production** (précision 55 à 79 % contre 95 %). Le rappel monte un peu (jusqu'à 73 %), mais au prix de nombreux faux thèmes : le lexique du catalogue appliqué à toute l'introduction et à toutes les catégories attrape des mots hors sujet (Albert Einstein → `royaute`, `education` ; Wagon → `animaux` ; Maitrank → `plantes`, piège déclenché).
2. **Apport de chaque canal** (A0 → A3) : infobox +0,9 point de précision et +1,4 de rappel, sections +0,8 et +0,6, corps + liens +0,6 de précision et −1,1 de rappel. Tout est marginal : **le gain ne vient pas de lire plus de texte avec le même lexique**.
3. **Exiger deux canaux forts d'accord** (A4, A5) divise les faux thèmes par deux et les pièges par deux, mais fait perdre beaucoup de rappel (23,6 % de « sans thème » à tort). C'est un bon filtre de confiance, pas une méthode de déduction.
4. **Seule utilisation rentable de la page : en renfort de la production.** H1 (page utilisée seulement quand la production ne donne rien) gagne +2,5 points de rappel et divise par 1,7 les « sans thème » à tort (12,9 → 7,8 %), pour −2 points de précision, sans piège déclenché. H2 (la page confirme ou infirme les thèmes de la production) atteint 97,1 % de précision et 2,9 % de faux thèmes, mais au prix de 31,7 % de « sans thème ».
5. Pour comparaison, le POC B (PR #197, communiqué par le coordinateur) donne un hybride B puis production à 91,3 % de précision, 71,9 % de rappel, 3,2 % de « sans thème » à tort : meilleur rappel que H1, moins bonne précision.

### Limites de la mesure

- Les descriptions du banc sont reconstruites : la production y est optimiste (voir README du banc). Une fois l'export réel d'Alexis ajouté, relancer les deux commandes ci-dessous.
- Les thèmes de référence sont un jugement, et le lexique du catalogue est partagé avec la production : ses défauts (voir POC #192) pèsent sur toutes les lignes A.
- Un seul passage, pas de réglage fin des poids ; A4 et A5 ne sont pas optimisés.

### Recommandation

Ne pas remplacer la production par la lecture de la page complète. Retenir au plus **H1 comme étage de repli** (page complète seulement pour les cartes sans thème), à comparer avec l'hybride du POC B, et chercher la fiabilité ailleurs que dans le lexique (table d'identifiants Wikidata → thème, ou classeur par le sens). La collecte d'une page complète par carte (une requête, sans Wikidata) suffit à ce repli.

## Idée testée

Aujourd'hui la production lit, par carte, la description du site, l'introduction et les catégories. Le POC A lit la **page entière** en une requête (`action=parse`, wikitexte) et la découpe en canaux :

| Canal | Contenu | Poids | Fort |
|---|---|---|---|
| definition | première phrase de l'intro (« X est un… ») | 5 | oui |
| infobox | nom du modèle (`Infobox Musique (artiste)`) + champs genre, profession, sport, type, domaine… | 4 | oui |
| categories | catégories visibles | 3 | oui |
| intro | reste de l'introduction | 2 | non |
| sections | titres de sections (hors notes, liens externes) | 1 | non |
| corps | texte des sections, 6 000 caractères | 0,5 | non |
| liens | titres des pages liées (150) | 0,5 | non |

Règle : un thème est posé s'il atteint le seuil, vaut au moins 40 % du meilleur et est porté par **au moins un canal fort** (corps, liens et sections seuls ne suffisent jamais : c'est le garde-fou contre les faux thèmes). Le plus précis l'emporte sur ses ancêtres, 4 thèmes au plus, page d'homonymie = aucun thème, jamais « À classer » ni « Autres ». Le lexique du catalogue est réutilisé tel quel : ses faux positifs (« opérateur » → Musique classique) relèvent du POC #192.

Six variantes (ablation) : A0 intro + catégories (équivalent de l'existant), A1 + infobox, A2 + sections, A3 page complète, A4 = A3 avec 2 canaux forts exigés, A5 = A4 avec seuil 5. La question : ce que l'infobox, les sections et les liens apportent **en plus** de A0, en précision, rappel et pièges déclenchés.

## Lancer la mesure (sur le PC d'Alexis)

1. `node specs/poc-themes/poc-a-page-complete/collecter.mjs <titres.json> pages.json` : lecture seule, une requête par carte, 1 s + gigue, seul le titre est envoyé, arrêt sur 403/429, reprise automatique. `titres.json` : liste des titres Wikipédia (ou `cartes` du banc). 317 cartes ≈ 6 minutes.
2. `POC_PAGES=pages.json POC_SORTIE=resultats.json npx vitest run tests/unit/poc-a-page-complete.test.ts` : imprime un rapport par variante (`formaterRapport`) et écrit le détail par carte.
3. Reporter les chiffres dans ce fichier.

## Limites connues

- Pas de Wikidata (le POC voisin le couvre) ; le lexique reste celui du catalogue ; pas de vote entre signaux.
- L'infobox n'est lue que pour les champs d'une liste fermée ; les modèles non « Infobox »/« Taxobox » sont ignorés.
- `links` renvoie les pages liées, pas leur sens : canal volontairement faible.
