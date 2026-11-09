# Design — Thèmes précis et étiquettes de thème et d’échange (aperçu du lot)

Contrat visuel. Chaque règle a un identifiant `D-xx` (série propre à cette feature, préfixe `DT-`) cité par les tâches, la revue et la vérification. Source : `wireframes/variante-1.html` (retenue) avec les écarts de la spec (§ Visuels), `src/styles/tokens.css`, et le design de `synchro-complete` (D-01 à D-44) dont les règles restent valables.

## Tokens
| Règle | Énoncé |
|---|---|
| DT-01 | **Aucun token n’est ajouté, modifié ni renommé** ; `src/styles/tokens.css` n’est pas touché. Aucune couleur en dur. |
| DT-02 | L’avertissement de visibilité utilise `border-vendre` (barre gauche 4 px) et un titre `text-vendre font-semibold`, texte courant en `text-paper`. `vendre` / `ink-2` : 5,0:1 en clair, 10,7:1 en sombre (calculés dans le design de synchro-complete). Le préfixe « Visibilité non vérifiée. » porte le sens : la couleur ne porte jamais seule l’information (D-05). |

## Thèmes
- DT-03 — Mécanisme existant (`prefers-color-scheme`), inchangé ; les deux thèmes sont touchés à l’identique. Captures à 375, 768 et 1280 px, clair et sombre.

## Composants
Nouveau composant `src/app/EtiquettesPrevues.tsx`, inséré dans la section d’aperçu de `Synchronisation.tsx`, **après** les totaux et **avant** « Cartes non incluses » et « Lancer » (SC-015).

| Composant | États | Règle |
|---|---|---|
| Avertissement de visibilité | statique, absent si aucune étiquette attendue | DT-04 |
| Tableau « Étiquettes prévues (envoi pas encore possible) » | liste, longue (au plus 100 lignes puis « … et N autres étiquettes »), vide (section absente) | DT-05 à DT-07 |
| `details` « Étiquettes non posées (N) » | fermé / ouvert | DT-08 |
| Ligne de total | statique | DT-09 |

- DT-04 — Texte exact (SC-015) : « Visibilité non vérifiée : les étiquettes de thème, de statut et d’échange, dont les prénoms de vos amis, sont peut-être visibles par les autres joueurs. » (espaces insécables avant `:`).
- DT-05 — `md` et plus : `<table>` avec `<th scope="col">` Étiquette / Cartes / Exemplaires / État, `w-full text-sm`, lignes `border-b border-line`, cellules `px-2 py-2 align-top`. Étiquette en `font-semibold`, `break-words`, jamais tronquée (nom d’ami de 300 caractères compris). Légende `caption` visible : « Étiquettes prévues (envoi pas encore possible) ».
- DT-06 — Base (< 768 px) : chaque ligne devient un bloc empilé, chaque valeur préfixée de son libellé visible (« Cartes : », « Exemplaires : », « État : »), comme D-16. Implémentation recommandée : liste `<ul>` en grille (`grid-cols-1 md:grid-cols-4`). Aucun défilement horizontal à 375 px.
- DT-07 — Ordre des lignes : « Statut · … » d’abord, puis les « #À échanger … », puis les thèmes du plus précis au plus général, puis par libellé (H5). Colonne État : « nouvelle · non disponible » ou « non disponible » en `text-muted`, en toutes lettres.
- DT-08 — `details` / `summary` : `summary` `min-h-11 cursor-pointer py-2`, contenu `text-sm text-muted`, une ligne par étiquette écartée avec carte (rareté entre crochets, titre en `break-words`), le nom et sa raison en toutes lettres (« homonyme d’une étiquette à vous », « nom trop long », « au-delà de la limite du site »).
- DT-09 — Total (SC-016) : « Total prévu : N poses dont T de thème et E d’échange · K noms nouveaux · durée estimée une fois disponible : H h M min » (`text-sm`).
- DT-10 — Aucune animation ni transition ; `prefers-reduced-motion` est déjà couvert par `tokens.css` (D-39).
- DT-11 — Noms d’amis et libellés rendus comme texte seulement (D-41), jamais `innerHTML`.

## Responsive
| Breakpoint | Largeur | Comportement |
|---|---|---|
| base | 375 px | Lignes empilées avec libellés visibles (DT-06) ; avertissement pleine largeur |
| `md` | 768 px | Tableau à 4 colonnes (DT-05) |
| `xl` | 1280 px | Même rendu, borné par le conteneur existant |

## Accessibilité
Aucune nouvelle paire texte / fond : toutes les paires utilisées (`paper`, `muted`, `vendre` sur `ink-2`) figurent déjà « oui » dans le design de synchro-complete (D-34 : jamais `text-muted` sur `bg-line`).

| Paire | Thème | Ratio | Seuil | OK |
|---|---|---|---|---|
| paper / ink-2 | Clair / Sombre | 15,0:1 / 14,3:1 | 4,5 | oui |
| muted / ink-2 | Clair / Sombre | 5,6:1 / 6,4:1 | 4,5 | oui |
| vendre / ink-2 | Clair / Sombre | 5,0:1 / 10,7:1 | 4,5 | oui |

- DT-12 — Clavier seul : le `summary` du `details` est atteignable et ouvrable ; ordre de tabulation = ordre du document ; focus visible global conservé, aucun `outline-none`.
- DT-13 — Cibles ≥ 44 px (`min-h-11`) pour le `summary`.
- DT-14 — Typographie française : ’ et espace insécable avant `:` `;` `?` `!`.
- DT-15 — Assistant de tri : les nouveaux thèmes apparaissent dans la liste plate triée existante, sans changement de composant (aucune règle visuelle nouvelle).
