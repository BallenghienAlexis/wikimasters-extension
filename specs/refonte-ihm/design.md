# Design — Refonte de l’interface de gestion

Contrat visuel de `spec.refined.md` (SC-001 à SC-028, H1 à H18). **Variante 1 retenue par Alexis** (onglets + tableau de bord). Tokens existants uniquement (`src/styles/tokens.css`) ; **aucune nouvelle couleur**. Révision du 2026-11-13 : les règles D-01 à D-08, D-10, D-11, D-20, D-30, D-31, D-40, D-50 gardent leur numéro (les tâches les citent), précisées ; D-09, D-12 à D-19, D-21, D-32, D-33, D-60 à D-62 sont nouvelles.

## Variantes étudiées
| | Variante 1 · Onglets + tableau de bord (**retenue**) | Variante 2 · Page unique + tiroir | Variante 3 · Centre d’activité |
|---|---|---|---|
| Idée | 6 onglets : Tableau de bord, Synchro, Lots, Collection, Ventes, Réglages | Collection en accueil, tiroir Activité | Tableaux de bord + Centre d’activité |
| Pour | Simple, une page courte par usage, fidèle à l’existant | Aucun changement d’habitude | Frise chronologique du run |
| Contre | Erreur invisible hors onglet Synchro → pastille + ligne dans le bandeau (D-21) | Écran chargé, tiroir étroit | Navigation à apprendre, coût fort |

Maquette : `wireframes/index.html` (variante, largeur, thème), captures dans `captures/`.

## Tokens

### Couleurs (existantes, inchangées)
| Token CSS | Utilitaires | Clair | Sombre | Rôle |
|---|---|---|---|---|
| `--color-ink` | `bg-ink` `text-ink` `border-ink` | #fbf8f2 | #13110f | fond de page ; **texte posé sur un fond de statut** |
| `--color-ink-2` | `bg-ink-2` | #f1ece2 | #1c1916 | fond des cartes, bandeau, bulles, pistes de barre |
| `--color-paper` | `text-paper` `bg-paper` `border-paper` | #1b1815 | #ede8df | texte, contours de barre, focus |
| `--color-muted` | `text-muted` `bg-muted` `border-muted` | #635c52 | #a39c91 | texte secondaire, **« À trier »**, bordures de contrôles |
| `--color-line` | `border-line` | #d8d1c4 | #3a352f | séparateurs décoratifs seulement (D-18) |
| `--color-garder` | `text-garder` `bg-garder` `border-garder` | #0f6b45 | #52d69a | garder, fait |
| `--color-echanger` | `text-echanger` `bg-echanger` | #1f4fb8 | #7ba4ff | échanger, en cours |
| `--color-vendre` | `text-vendre` `bg-vendre` | #8a5a00 | #f4c356 | vendre, **« En vente » (hachuré)** |
| `--color-defausser` | `text-defausser` `bg-defausser` `border-defausser` | #a8321f | #ff9a8b | défausser, erreur |

Opacités autorisées par les utilitaires (`bg-paper/6`, `border-muted/40`) ; jamais sur un texte porteur d’information (D-18).

### Tokens ajoutés ou modifiés dans `src/styles/tokens.css` (faits)
| Token | Valeur | Utilitaire / usage |
|---|---|---|
| `--d-fast` | 0,2 s | `duration-(--d-fast)` : survol, focus, couleurs |
| `--d-base` | 0,4 s | apparitions, dépliages, zoom de segment, compteur de chiffres clés, interrupteur, fondu de thème |
| `--d-move` | 0,65 s | déplacement de lignes et de cartes, bulle qui suit |
| `--d-bar` | 0,9 s | remplissage de barre, croissance de graphique |
| `--d-shake` | 0,5 s | secousse d’alerte, une fois |
| `--d-cascade-ligne` | 40 ms | décalage de l’entrée des lignes de liste ou de tableau |
| `--d-cascade-bloc` | 50 ms | décalage de l’entrée des blocs de page |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | utilitaire `ease-out` (remplace celui de Tailwind) : apparition, remplissage, dépliage |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | utilitaire `ease-spring` : déplacement, rebond, boutons |
| `--shadow-carte` | `0 1px 2px color-mix(paper 14 %)` | `shadow-carte` : repos des cartes |
| `--shadow-leve` | `0 6px 18px color-mix(paper 22 %)` | `shadow-leve` : survol de carte, carte déplacée, bulle |
| `--shadow-segment` | `0 4px 14px color-mix(paper 30 %)` | `shadow-segment` : segment zoomé |
| `--surface-survol` | `color-mix(paper 6 %, transparent)` | `bg-(--surface-survol)` : surlignage de ligne (D-08) |
| `--halo-focus` | `0 0 0 3px color-mix(paper 28 %, transparent)` | `shadow-(--halo-focus)` : halo des champs et boutons (D-19) |
| `--hachure-en-vente` | rayures 135°, `vendre` / `vendre` 55 % + `paper` | `bg-(image:--hachure-en-vente)` : segment « En vente » (D-13) |

Les ombres, surlignages et la hachure dérivent des tokens de couleur par `color-mix` : aucune couleur littérale (SC-025). Règle globale ajoutée : `:root[data-animations='off']` coupe animations et transitions comme `prefers-reduced-motion` (D-17). Un composant n’écrit **jamais** de durée, de courbe ou de couleur littérale (`cubic-bezier(`, `0.3s`, `#…`) : il cite un token.

### Typographie, espacements, rayons (Tailwind par défaut, polices système)
| Usage | Utilitaire |
|---|---|
| Valeur de KPI : 30 px gras (grand texte) | `text-3xl font-bold` |
| Titre d’onglet / de section | `text-xl font-semibold` / `text-lg font-semibold` |
| Texte courant, libellés, tableaux | `text-base` ; sous-textes et légendes `text-sm` (14 px mini, jamais plus petit) |
| Chiffres alignés (tableaux, KPI) | `tabular-nums` |
| Grille d’espacement : pas de 4 px ; blocs `gap-4` (base) / `gap-6` (`md:`) | `p-4`, `gap-4`, `md:gap-6` |
| Rayons : cartes et panneaux / boutons et champs / pastilles et segments | `rounded-xl` / `rounded-lg` / `rounded-full` et `rounded-md` |
| Cible tactile | `min-h-11 min-w-11` (44 px) |
| Barre fine (bandeau, barre globale) / barre d’étape | `h-2` (8 px) / `h-3` |

## Thèmes clair et sombre
Les deux thèmes sont déjà portés par `prefers-color-scheme` (redéfinition des variables). Impact de la refonte : **aucun nouveau token de couleur**, donc aucune redéfinition de thème ; les nouveaux tokens (`--surface-survol`, `--halo-focus`, `--hachure-en-vente`, ombres) sont des `color-mix` de rôles qui se redéfinissent seuls. Le fondu de thème (D-07) dure `--d-base` ; il est coupé comme les autres mouvements. Les deux thèmes sont capturés à chaque largeur (SC-009) et les contrastes sont donnés pour les deux (D-18).

## Règles

### Tableau de bord, bandeau, navigation
- D-01 Tableaux de bord : cartes `KPI` (valeur 30 px gras, libellé, sous-texte) ; **4 chiffres clés** (exemplaires, valeur estimée, places d’enchères, écarts) ; répartition des décisions en barre empilée (D-06) ; tableau par rareté en liste empilée sous 600 px. Valeur absente : « — », jamais `NaN` (SC-001). Collection vide : la barre est remplacée par le texte « Aucune carte ».
- D-02 Organisation en 6 onglets (demande d’Alexis, 2026-11-13) : **Tableau de bord** léger (état en cours, erreur, 4 chiffres clés, répartition des décisions, santé de la synchro) ; **Synchro** (barres globale et par étape, tâches en cours / à venir / terminées, erreur, ignorées, historique filtrable, fraîcheur des prix, interrupteur et « Relancer la synchro ») ; **Lots** (D-09) ; **Collection** (recherche, filtre, vue liste en tableau triable ou vue tableau de tri, puis analyses : doublons, à trier, défaussables, évolution sur 30 jours, valeur par décision, 10 plus chères, 10 thèmes) ; **Ventes** (places, file, heures fortes, assistant de tri tel quel) ; **Réglages** repliables (D-50). L’évolution sur 30 jours : jours sans point = trous, moins de 2 points = « Historique en cours de constitution (N jour) » (SC-020).
- D-03 Bandeau d’activité (demande d’Alexis, 2026-11-13) : voir D-21 pour la règle de présence. Panneau **dépliable** : replié = nom, barre fine, pourcentage et résumé (une ligne) ; déplié = une barre par étape ou par lot, Pause / Reprendre (lots seulement, H9), Arrêter. `aria-expanded` et `aria-controls` sur le bouton d’en-tête (bouton de 44 px de haut sur toute la ligne). Replié par défaut, l’état déplié n’est pas stocké (H13). Le même principe (replié minimal, déplié complet) s’applique aux sections de Réglages et aux panneaux de détail.
- D-12 Navigation par onglets : conteneur `role="tablist"` (`aria-label="Sections"`), chaque onglet `role="tab"` avec `aria-selected`, `aria-controls`, `tabindex` itinérant (seul l’onglet actif est dans l’ordre de tabulation) ; flèches ← →, Origine, Fin déplacent le focus et activent ; panneau `role="tabpanel"` `aria-labelledby`. Onglet = lien d’ancre `#tableau-de-bord`, `#synchro`, `#lots`, `#collection`, `#ventes`, `#reglages` (SC-012). Aspect : texte `paper` ; actif = indicateur de 3 px `paper` sous le texte qui **glisse** d’un onglet à l’autre (`--d-base`, `--ease-spring`, `transform`) ; inactif = texte `paper` non gras (maquette v15, 2026-11-14). Hauteur 44 px, `px-4`. Pastille d’erreur sur « Synchro » : disque 10 px `defausser` + texte masqué visuellement « erreur » (`sr-only`) et symbole ✕ visible ; jamais la couleur seule. À 375 px la barre défile dans son conteneur (`overflow-x-auto`, pas de défilement de page).
- D-21 Bandeau d’activité masqué si inactif (SC-013) : le bandeau n’est **pas rendu** (ni hauteur, ni marge, ni région vide) quand il n’y a ni synchro `en-cours` (bail non expiré), ni exécution `en-cours` ou en pause, ni exécution arrêtée sur erreur en attente de choix. Le texte « Aucune activité en cours » vit dans l’onglet Synchro, jamais dans le bandeau. Apparition : fondu glissé 10 px (`--d-base`, `--ease-out`) ; disparition : fondu. Une ligne = fond `ink-2`, contour `line` en haut et bas, barre fine, symbole + mot d’état ; ligne d’erreur : bordure gauche 6 px `defausser`, symbole ✕, texte « Erreur : … » et lien « Voir le détail » vers `#synchro`. Ligne d’un autre onglet du navigateur : lecture seule, texte « en cours dans un autre onglet », sans boutons. Le bandeau est une région `role="region"` `aria-label="Activité en cours"` ; l’annonce de progression passe par une zone `aria-live="polite"` distincte (D-11).
- D-09 Onglet Lots (SC-015) : en-tête avec durée estimée « environ N min » des seuls lots cochés (H4) ; **tableau des lots** (colonnes : case à cocher 44 px, Famille, Actions, Ordre) ; tous cochés par défaut ; colonnes triables (D-16) mais la colonne « Ordre » garde l’ordre d’application de `lot.ts` ; sous le tableau, dans l’ordre : aperçu des actions et cartes non incluses (sections repliables, D-03), avertissements (étiquettes visibles des autres joueurs, défausse définitive, valeurs au-dessus de 5) dans des encadrés `border-vendre` avec symbole ⚠ + texte, écarts avec le site, puis le bouton principal « Lancer » (fond `paper`, texte `ink`). Désactivé (aucun lot coché, pause de 30 min, conditions existantes) : le bouton est grisé **et** la raison écrite en `muted` juste au-dessous, liée par `aria-describedby`. Sous 600 px, chaque lot devient une carte empilée (case, famille, nombre d’actions).

### Mouvement
- D-04 Mouvement (demande d’Alexis, 2026-11-13) : courbes `--ease-out` (sortie douce) pour les apparitions, barres et dépliages ; `--ease-spring` (léger rebond) pour les déplacements de cartes et les boutons ; apparition des blocs par fondu et glissement de 10 px ; barres actives avec reflet qui défile ; dépliage en hauteur fluide (`grid-template-rows` 0fr → 1fr). **Tableau de tri** : voir D-15. Les valeurs chiffrées (350 à 500 ms, flou 0,7 s, fondu de thème 0,5 s, compteur 0,5 s) de la première version sont remplacées par les tokens (D-08, H8). Les animations ne passent que par `transform`, `opacity`, `filter`, `grid-template-rows` et les couleurs. Coupure : D-17.
- D-05 Tri de tableau animé (Alexis, 2026-11-13) : détail en D-16. S’applique aux tableaux de la Collection, de la File de vente et des Lots.
- D-07 Catalogue des effets par élément (revue complète, Alexis, 2026-11-13) :
  | Élément | Effet |
  |---|---|
  | Page, en-tête, blocs | apparition en fondu glissé (10 px), blocs décalés de `--d-cascade-bloc` ; changement de thème en fondu `--d-base` |
  | Onglets | indicateur qui glisse d’un onglet à l’autre avec rebond (D-12) |
  | Bandeau d’activité | dépliage en hauteur fluide, apparition de la ligne (D-21) |
  | Cartes et sections | ombre `shadow-carte` → `shadow-leve` et bordure qui se renforcent au survol |
  | Chiffres clés | compteur 0 → valeur (`--d-base`) à chaque affichage (D-61) |
  | Barres de progression | remplissage animé depuis la gauche, reflet qui défile sur celles en cours |
  | Graphiques (colonnes, pistes) | croissance depuis la base, décalée colonne par colonne |
  | Répartition des décisions | zoom du segment et bulle de détail (D-06) |
  | Listes (tâches, journal, ventes) | lignes qui arrivent en cascade (`--d-cascade-ligne`), surlignage au survol |
  | Tableaux | lignes qui glissent au tri, surlignage au survol (D-16) |
  | Tableau de tri | rebond, flou, soulèvement au survol, colonne cible (D-15) |
  | Interrupteurs | bouton qui glisse avec rebond, fond qui s’inverse |
  | Champs | halo de focus progressif (D-19) |
  | Boutons | léger soulèvement au survol, enfoncement à l’appui |
  | Réglages | sections qui se déplient en hauteur, chevron qui pivote |
  | Erreur | entrée avec courte secousse (`--d-shake`), `role="alert"` |
  | Statut « À jour » | pastille qui pulse |
  Tout est coupé par D-17.
- D-08 Harmonisation du mouvement par type d’élément (Alexis, 2026-11-13) : **quatre durées et deux courbes**, des tokens (H8) : `--d-fast` 0,2 s, `--d-base` 0,4 s, `--d-move` 0,65 s, `--d-bar` 0,9 s ; `--ease-out` et `--ease-spring` ; plus `--d-shake`, `--d-cascade-ligne`, `--d-cascade-bloc`.
  | Type | Règle |
  |---|---|
  | Cliquable (bouton, onglet, en-tête de colonne, chevron) | survol : soulèvement 1 px, `--d-fast`, `--ease-spring` ; appui : échelle 0,96 ; focus : halo 3 px (D-19) |
  | Table (lignes) | survol : `--surface-survol` `--d-fast` ; tri et filtre : glissement `--d-move` + `--ease-spring`, flou 1,2 px pendant le trajet ; entrée en cascade `--d-cascade-ligne` |
  | Barre (progression, piste, graphique) | remplissage depuis la gauche ou la base `--d-bar` + `--ease-out` ; reflet seulement sur une barre en cours |
  | Zoomable (segment de répartition) | grandit en hauteur et en largeur `--d-base` + `--ease-spring`, `shadow-segment`, autres segments estompés (D-06) ; bulle de détail suit en `--d-move` |
  | Déplaçable (carte du tableau de tri) | survol : soulèvement 2 px + `shadow-leve` ; pendant le déplacement : `--d-move` + `--ease-spring`, flou 1,6 px, échelle 1,03 ; carte glissée à 40 % |
  | Panneau dépliable | hauteur `grid-template-rows` 0fr → 1fr, `--d-base` + `--ease-out`, chevron qui pivote ; contenu masqué (`visibility: hidden`) une fois replié |
  | Carte / bloc | apparition `--d-base` + `--ease-out`, ombre au survol `--d-base` |
  | Interrupteur | bouton qui glisse `--d-base` + `--ease-spring` |
  | Alerte | entrée + secousse `--d-shake`, une seule fois |
- D-17 Mouvement coupé (SC-026) : deux déclencheurs équivalents. (a) `prefers-reduced-motion: reduce` ; (b) réglage « Animations » désactivé (clé `affichage`, activé par défaut, dans Réglages) qui pose `data-animations="off"` sur `<html>`. Les deux appliquent la même règle globale de `tokens.css` (`animation: none`, `transition: none`, `scroll-behavior: auto`). Conséquences à respecter par les composants : barres au remplissage final sans reflet ; chiffres clés directement à leur valeur finale (le composant lit `matchMedia` et `affichage`, car le CSS ne suffit pas à un compteur en JavaScript) ; glisser-déposer : la carte est posée dans la colonne sans trajet ; tri : lignes à leur place sans glissement ; bulle de segment : apparition sans déplacement ; dépliages instantanés ; secousse d’erreur supprimée mais `role="alert"` et bordure restent. Aucune information n’est portée uniquement par le mouvement (ex. « En cours » = symbole ▶ + mot). L’interrupteur « Animations » est une section de Réglages (résumé « Animations : activées »).

### Progression, étapes, tâches
- D-10 Barre de progression : `role="progressbar"` avec `aria-valuenow/min/max` et `aria-label` en français ; contour 1 px et remplissage en `paper` sur piste `ink-2` ; le pourcentage et l’étape sont **écrits** à côté (« Étape 2 / 3 · 41 % », « 37 / 120 · 31 % ») ; version fine (8 px) pour la barre globale et le bandeau. Barre indéterminée (total inconnu) : sans `aria-valuenow`, remplissage en rayures animées, texte « N lus » ; avec mouvement coupé, remplissage plein à 100 % de largeur en `muted` et texte seul.
- D-11 Étapes : « ✓ Lecture / ▶ Pages / ○ Prix / ✕ Ignorées » : symbole + mot + couleur (garder = fait, echanger = en cours, muted = attente, defausser = erreur). Mise à jour annoncée dans une zone `aria-live="polite"` (au plus toutes les 2 s : changement d’étape ou de lot, palier de 10 %).
- D-20 Tâches : trois listes En cours / À venir (par lot : famille, nombre) / Terminées (dernières 20, la plus récente en haut), puis lien vers l’historique filtrable (type, résultat, carte, exécution). Sans activité : « Aucune activité en cours » puis les seules Terminées. Libellés d’historique : « Passée : exemplaire indisponible », « Passée : sautée », « Passée : ignorée jusqu’à la prochaine synchro » (symbole ↷ + mot, `muted`).

### Erreurs et ignorées
- D-30 Panneau d’erreur (`role="alert"`, bordure gauche 6 px `defausser`, fond `ink-2`) : titre avec symbole ✕, puis liste Action / Carte / Lot / Rang / Réponse du site / Cause probable / Heure / Déjà fait / Reprise possible (SC-004) ; contenu limité aux champs fermés (SC-007) ; « Réponse du site » = code HTTP + libellé fixe. Boutons dans l’ordre : **Réessayer cette action** (principal), Sauter cette action, Sauter ce lot (N actions), Ignorer jusqu’à la prochaine synchro, Arrêter tout (bordure `defausser`, texte `defausser`). Phrase d’explication sous le titre : « Sauter n’envoie rien au site. » Un 401, 429 ou refus hors exemplaire garde la pause de 30 min : « Réessayer » est alors remplacé par « Relancer la synchro » (règle existante) ou désactivé avec « Reprise possible à HH:MM » (D-33). Pour un arrêt de **synchro** : étape, page « i / n », code, heure, compteurs ; ni « Sauter » ni « Ignorer ».
- D-33 États des 5 choix du panneau d’erreur (SC-005, SC-006, SC-016, SC-017) :
  | Situation | Réessayer | Sauter action | Sauter lot | Ignorer | Arrêter tout |
  |---|---|---|---|---|---|
  | Erreur sans pause (403 par carte, 409, transport, résultat, écriture, vérification) | actif | actif | actif | actif | actif |
  | Pause de 30 min (401, 429, refus hors exemplaire, 3 échecs) | désactivé + « Reprise possible à HH:MM » | actif (effet local, reprise différée) | actif (idem) | actif (idem) | actif |
  | Reprise impossible après rechargement | absent | absent | absent | absent | remplacé par « Fermer » ; ajout de « Préparer un nouveau lot » (principal) |
  | Écriture du stockage refusée (ignorer) | actif | actif | actif | message d’erreur `role="alert"` sous le bouton, rien d’ignoré | actif |
  Un bouton désactivé reste focusable (`aria-disabled="true"`) pour que sa raison, liée par `aria-describedby`, soit lue ; il est grisé (texte `muted`, bordure `muted`) et sans effet de survol. Focus : à l’apparition du panneau, le focus va sur son titre (`tabindex="-1"`) **seulement** si l’onglet Synchro est affiché (SC-008) ; après une action, le focus passe au premier bouton restant ou au titre de la section suivante. Disposition : 375 px colonne, boutons pleine largeur de 44 px ; `md:` boutons en ligne qui passent à la ligne (`flex-wrap`).
- D-31 Ignorées : tableau Action / Carte / Jusqu’à (« ce lot », « prochaine synchro », date d’expiration à 30 jours) / Reprendre. Triable (D-16). « Reprendre » : bouton de 44 px, `aria-label` « Reprendre « action » pour « carte » », aucune requête, l’action réapparaît au prochain aperçu. État vide écrit : « Aucune action ignorée ». Sous 600 px : une carte par ligne avec les mêmes quatre champs.
- D-32 Liste « Ignorées » placement : dans l’onglet Synchro, section repliable sous l’erreur (titre « Ignorées (N) », chevron), repliée par défaut sauf juste après un « Ignorer » ; un compteur « N ignorée(s) » est aussi visible dans le résumé de la section Lots (« N actions écartées »). Une ignorée sur création d’étiquette écarte les poses : la ligne de l’aperçu porte la raison « création ignorée » en `muted`.

### Statuts, pastilles
- D-40 Pastille de statut : texte + contour (`À jour`, `En cours`, `Arrêtée`, `Erreur`), jamais la couleur seule : symbole ● pulsant (À jour, `garder`), ▶ (En cours, `echanger`), ■ (Arrêtée, `muted`), ✕ (Erreur, `defausser`).
- D-13 Statuts de carte dans les répartitions, tableaux et colonnes (SC-022, H7). Aucune nouvelle couleur :
  | Statut | Fond du segment / de la colonne | Texte posé dessus | Marque non colorée |
  |---|---|---|---|
  | Garder | `bg-garder` | `text-ink` | libellé « Garder » |
  | Échanger | `bg-echanger` | `text-ink` | libellé « Échanger » |
  | Vendre | `bg-vendre` | `text-ink` | libellé « Vendre » |
  | Défausser | `bg-defausser` | `text-ink` | libellé « Défausser » |
  | **À trier** | `bg-muted` (aucun statut = non décidé) | `text-ink` | libellé « À trier » |
  | **En vente** | `--hachure-en-vente` (rayures `vendre`) | `text-ink` | rayures + libellé « En vente » ; non déplaçable |
  « À trier » en `muted` signale l’absence de décision, pas un état d’erreur. « En vente » reprend la famille `vendre` (c’est une vente en cours) avec une hachure pour ne pas être confondu avec « Vendre » (décision) ; les rayures alternent `vendre` et `vendre` mélangé à 45 % de `paper`, de sorte que le texte `ink` reste lisible sur les deux rayures dans les deux thèmes (D-18). Statut hors répartition (liste, tableau) : pastille texte `paper` sur `ink-2`, contour de la couleur du statut, symbole + mot.

### Répartition
- D-06 Barre de répartition avec légende intégrée (Alexis, 2026-11-13) : hauteur 48 px, `rounded-xl`, segments proportionnels (un statut à 0 exemplaire est absent) ; l’étiquette « Garder 40 % » est écrite **dans** le segment en `text-ink` (D-13) ; au survol ou au focus d’un segment : il grandit (zoom en hauteur et en largeur, `--d-base` + `--ease-spring`, `shadow-segment`), les autres sont estompés (D-14 : saturation, jamais l’opacité du texte) ; une bulle de détail (fond `ink-2`, texte `paper`, contour `muted`, `shadow-leve`, `max-w-72`) suit le segment (`--d-move`) : exemplaires, part, valeur estimée, 3 titres d’exemple (texte seul). La bulle reste ouverte tant que le pointeur est sur le segment ou la bulle, se ferme avec Échap, le focus revenant au segment. Chaque segment est un `button` avec `aria-label` complet (« Garder : 412 exemplaires, 40 %, valeur estimée 1 230 »), `aria-describedby` vers la bulle. Mouvement coupé : zoom remplacé par un contour `paper` de 3 px, bulle sans déplacement.
- D-14 Segments étroits et légende (SC-022) : un segment montre son étiquette interne seulement si sa largeur rendue est ≥ 96 px ; sinon l’étiquette interne est retirée (le `aria-label` reste) et le segment est **retiré de l’ordre de tabulation** (`tabindex="-1"`, il garde survol et bulle à la souris). La **ligne de légende** sous la barre (D-14) liste, en boutons de 44 px de haut (`min-w-11`, `px-3`, symbole de statut + « Garder 40 % »), exactement les segments dont l’étiquette interne est retirée, dans l’ordre de la barre ; ces boutons sont les arrêts de tabulation correspondants et ouvrent la même bulle, ancrée au segment. À 375 px la barre s’étend sur toute la largeur et la légende passe à la ligne (`flex-wrap`, `gap-2`) ; si tous les segments ont leur étiquette (rare), la légende est absente. Estompage des autres segments : `filter: saturate(.45)` et hauteur réduite de 8 px, **pas** `opacity` (qui ferait tomber le contraste du texte : calcul en D-18) ; au repos (aucun survol) les segments sont à pleine saturation.

### Tableaux, tri, glisser-déposer
- D-15 Tableau de tri (SC-023, vue de l’onglet Collection, sélecteur « Liste / Tableau de tri » en deux boutons `aria-pressed` de 44 px) : cinq colonnes Garder, Échanger, Vendre, Défausser, À trier, chacune `role="group"` `aria-labelledby` (titre + nombre) ; l’en-tête de colonne porte la couleur du statut en **bordure haute de 4 px** et le libellé en `paper` (le fond reste `ink-2`) ; colonne cible pendant un glisser : contour `paper` en pointillé 2 px + fond `--surface-survol`. Carte = `ink` fond, contour `line`, `rounded-lg`, titre + rareté + quantité, **deux boutons ← → de 44 × 44 px** (`aria-label` « Déplacer « titre » vers Échanger », `aria-disabled` aux bouts de rangée, symbole ← / → + libellé accessible) ; ordre des colonnes = ordre de lecture. Clavier et tactile sont la voie principale ; le glisser-déposer (Pointer Events) est un confort. Annonce `aria-live="polite"` : « « titre » déplacée vers Vendre » ; le focus suit la carte dans sa colonne (`--d-move` ; sans trajet si mouvement coupé). Échap annule un glisser. Cartes `en-vente` : hors colonnes, mention « N en vente, non déplaçables ». 50 cartes par colonne puis « Afficher plus » (44 px). Mise en page : 375 px colonnes **empilées** (une colonne par ligne, chacune repliable D-03) ; 768 px 2 colonnes (5e passe seule en dessous) ; 1280 px 5 colonnes de largeur égale. Pas de défilement horizontal de la page.
- D-16 En-têtes triables et `aria-sort` (SC-024) : l’en-tête de colonne triable est un `th` contenant un `button` de 44 px de haut (libellé + chevron ▲ ▼ ou rien) ; `aria-sort="ascending" | "descending" | "none"` sur le `th`, mis à jour à chaque changement, cycle croissant → décroissant → aucun ; activable à Entrée et Espace. Colonne triée : libellé en gras + chevron (l’état n’est pas porté par la couleur). Effet : les lignes glissent vers leur place (`--d-move` + `--ease-spring`, flou 1,2 px, FLIP sur les seules lignes rendues) ; un filtre retire les lignes en fondu (`--d-base`) sans saut de hauteur ; l’annonce du tri est faite par `aria-sort` seul (pas de zone live supplémentaire). Valeurs inconnues toujours en dernier. Sous 600 px, le tableau devient liste de cartes : le tri passe par un `select` « Trier par » (44 px) et un bouton « Sens » (`aria-pressed`) qui reprennent le même état. Mouvement coupé : réordonnancement instantané.

### Réglages
- D-50 Réglages (sauvegarde, plafond de défausse, étiquettes préexistantes, Wikipédia, thèmes, **animations**) : sections repliables, fermées par défaut, titre + résumé de la valeur courante (« Plafond : 5 », « Animations : activées »), bouton d’en-tête `aria-expanded` + `aria-controls` de 44 px, chevron qui pivote ; contenu replié `visibility: hidden` donc hors de l’ordre de tabulation (SC-028). L’interrupteur de synchro automatique et « Relancer la synchro » restent dans l’onglet Synchro (avertissement de risque affiché comme aujourd’hui, encadré `border-vendre` + ⚠ + texte).

### Accessibilité transversale
- D-18 Contrastes AA : voir table ci-dessous, calculée (luminance relative WCAG 2.x) sur les valeurs de `tokens.css`. **Règles** : (1) tout texte porteur d’information utilise une paire de la table ≥ 4,5:1 (≥ 3:1 pour les textes de 24 px et plus, ou 18,66 px gras) ; (2) toute bordure ou icône nécessaire à la compréhension d’un contrôle (champ, bouton, case, interrupteur, séparation de carte déplaçable) utilise `paper` ou `muted` (≥ 3:1), **jamais `line`** (1,3 à 1,6:1, séparateur décoratif seulement) ; (3) pas d’`opacity` sur un texte : un état estompé change la saturation ou le fond, jamais l’opacité du texte ; (4) un texte désactivé est exempt de contraste mais sa raison est écrite en `muted` (≥ 5,6:1).
- D-19 Focus, cibles, non-couleur (SC-008) : `:focus-visible` global conservé (contour 2 px `paper`, décalage 2 px, ≥ 15:1) auquel s'ajoute le **halo de 3 px** (`--halo-focus`, apparition `--d-fast`) sur champs, boutons, onglets, en-têtes triables et segments ; jamais `outline: none` sans équivalent. Cibles ≥ 44 × 44 px pour tout contrôle (boutons, onglets, cases, flèches ← →, boutons de légende, chevrons, « Reprendre », « Afficher plus ») ; deux cibles voisines sont séparées de 8 px au moins (`gap-2`). Statut, étape, progression, résultat, tri : toujours symbole + mot + (éventuellement) couleur. Libellés ARIA en français ; typographie française (’, espace insécable avant `:`).
- D-61 Chiffres clés animés (SC-027) : le nombre qui défile est dans un `span aria-hidden="true"` ; la valeur finale est écrite dans le nom accessible de la carte dès le premier rendu (`aria-label="Exemplaires : 1 240"` sur la carte ou texte `sr-only`). Largeur du chiffre stable (`tabular-nums`, `min-w` du texte final) pour éviter tout saut de mise en page.
- D-62 Messages d’erreur de stockage (SC-012, SC-019) : fichier illisible ou écriture refusée = encadré `role="alert"` bordure gauche 6 px `defausser`, symbole ✕, au-dessus des onglets (toutes pages), avec le bouton de téléchargement des données brutes (44 px).

## Contrastes AA (calculés, clair / sombre)
Ratio = (L1 + 0,05) / (L2 + 0,05), L = luminance relative WCAG 2.x. Valeurs arrondies au dixième. Seuil texte normal 4,5:1 ; grand texte et éléments d’interface 3:1.

### Texte sur fond de page / de carte
| Paire (texte sur fond) | Usage | Clair | Sombre | Verdict |
|---|---|---|---|---|
| `paper` sur `ink` | texte courant, titres | 16,7 | 15,4 | AA/AAA |
| `paper` sur `ink-2` | texte dans cartes, bandeau, bulles | 15,0 | 14,3 | AA/AAA |
| `muted` sur `ink` | texte secondaire, sous-texte, raisons de désactivation | 6,2 | 6,9 | AA |
| `muted` sur `ink-2` | idem sur carte | 5,6 | 6,4 | AA |
| `garder` sur `ink` / `ink-2` | « fait », À jour, chiffres | 6,2 / 5,6 | 10,3 / 9,5 | AA |
| `echanger` sur `ink` / `ink-2` | « en cours », échanger | 6,9 / 6,2 | 7,7 / 7,2 | AA |
| `vendre` sur `ink` / `ink-2` | vendre, avertissements | 5,6 / 5,0 | 11,5 / 10,7 | AA |
| `defausser` sur `ink` / `ink-2` | erreur, défausser | 6,3 / 5,7 | 9,2 / 8,5 | AA |
| `muted` sur `ink-2` + survol `--surface-survol` | ligne de tableau survolée | 5,0 | 5,6 | AA (pire cas) |

### Texte `ink` posé sur un fond de statut (segments, colonnes, boutons pleins)
| Paire (`ink` sur …) | Usage | Clair | Sombre | Verdict |
|---|---|---|---|---|
| `garder` | segment Garder | 6,2 | 10,3 | AA |
| `echanger` | segment Échanger | 6,9 | 7,7 | AA |
| `vendre` | segment Vendre ; rayure claire « En vente » (clair), rayure `vendre` (sombre) | 5,6 | 11,5 | AA |
| rayure sombre « En vente » (`vendre` 55 % + `paper` 45 %) | segment En vente | ≥ 5,6 (plus sombre que `vendre`) | ≥ 11,5 (plus clair que `vendre`) | AA |
| `defausser` | segment Défausser | 6,3 | 9,2 | AA |
| `muted` | segment À trier | 6,2 | 6,9 | AA |
| `paper` | bouton principal « Lancer », « Réessayer » | 16,7 | 15,4 | AA/AAA |

### Segments estompés, éléments d’interface, focus
| Paire | Usage | Résultat | Verdict |
|---|---|---|---|
| `ink` sur fond de statut à `opacity` 55 % (écarté) | estompage par opacité | clair ≈ 2,4 · sombre ≈ 4,0 | **interdit** (échec) : règle D-14 |
| `ink` sur fond de statut avec `saturate(.45)` | estompage retenu | ≥ 5,5 dans les deux thèmes (pire cas : gris équivalent entièrement désaturé ≥ 6,0) | AA ; à confirmer par le test unitaire de SC-022 |
| `paper` sur `ink` | contour de focus, contour de barre | 16,7 / 15,4 | ≥ 3:1 |
| `paper` (remplissage) sur `ink-2` (piste) | barre de progression | 15,0 / 14,3 | ≥ 3:1 |
| `muted` sur `ink` | bordure de champ, case, interrupteur, chevron | 6,2 / 6,9 | ≥ 3:1 |
| `defausser` sur `ink-2` | bordure gauche du panneau d’erreur, pastille | 5,7 / 8,5 | ≥ 3:1 |
| `line` sur `ink` / `ink-2` | séparateur décoratif uniquement | 1,4 / 1,3 (clair), 1,6 / 1,4 (sombre) | **hors contrôles** (D-18 règle 2) |

## Responsive (mobile-first : base 375 px, `md:` 768 px, `xl:` 1280 px)
Règle commune (SC-009) : `document.documentElement.scrollWidth ≤ clientWidth` à chaque largeur, sur chaque onglet, dans les deux thèmes. Marges de page `px-4` (base), `md:px-6`, `xl:px-8` ; contenu `max-w-7xl` centré.
| Élément | 375 px (base) | 768 px (`md:`) | 1280 px (`xl:`) |
|---|---|---|---|
| Barre d’onglets | défile horizontalement dans son conteneur, onglet actif amené en vue | tous visibles | tous visibles |
| Bandeau d’activité | une ligne : nom, barre, % ; résumé masqué (visible déplié) | + résumé d’une ligne | idem, boutons Pause / Arrêter visibles en ligne |
| KPI | 1 colonne | 2 colonnes | 4 colonnes |
| Blocs du tableau de bord / Synchro | 1 colonne | 2 colonnes | 2 colonnes (état en cours pleine largeur) |
| Barre de répartition | pleine largeur, légende en boutons qui passent à la ligne (D-14) | idem, plus d’étiquettes internes | étiquettes internes pour la plupart des segments |
| Tableaux (Collection, File de vente, Lots, Ignorées, Historique) | cartes empilées sous 600 px, tri par `select` + « Sens » (D-16) | tableau complet | tableau complet |
| Tableau de tri | 5 colonnes empilées, repliables | 2 colonnes | 5 colonnes |
| Panneau d’erreur | pleine largeur, 5 boutons en colonne de 44 px | boutons en ligne, retour à la ligne | idem, détail en deux colonnes (champs / cause) |
| Lots | cartes empilées par lot, « Lancer » collant en bas d’écran (`sticky bottom-0`, fond `ink-2`) | tableau, « Lancer » sous le tableau | idem |
| Réglages | sections en pile | pile | pile, largeur de lecture `max-w-3xl` |
| Bulle de détail | `max-w-[calc(100vw-2rem)]`, ancrée au-dessus du segment, retournée si elle déborde | `max-w-72` | `max-w-72` |

## Hors périmètre du design
Aucun changement de contenu de l’assistant de tri (déplacé tel quel) ; aucune couleur nouvelle ; le graphique de l’évolution sur 30 jours utilise `paper` (colonnes) sur piste `ink-2`, valeur écrite au survol et au focus en plus d’un tableau alternatif `sr-only`.
