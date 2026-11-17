# POC A : page Wikipédia complète (infobox, sections, catégories, liens)

Statut : **POC isolé, non branché sur la production**. Rien dans `src/`, aucune permission, aucune dépendance. Code dans `specs/poc-themes/poc-a-page-complete/`, test dans `tests/unit/poc-a-page-complete.test.ts`.

## Résultat chiffré : pas encore mesuré

Le conteneur de développement n'atteint pas `fr.wikipedia.org` (le proxy refuse l'hôte). **Aucune page réelle n'a donc été lue et aucun chiffre n'est donné ici.** Les tests de la PR utilisent des pages rédigées à la main : ils vérifient le code, pas la qualité. Ligne de base du banc (production, titre + description) : précision 94,4 %, rappel 65,3 %, « sans thème » à tort 12 %.

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
