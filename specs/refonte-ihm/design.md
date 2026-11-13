# Design — Refonte de l’interface de gestion

Contrat visuel. Tokens existants uniquement (`src/styles/tokens.css`) ; aucune nouvelle couleur.

## Variantes proposées
| | Variante 1 · Onglets + tableau de bord (recommandée) | Variante 2 · Page unique + tiroir Activité | Variante 3 · Centre d’activité |
|---|---|---|---|
| Idée | 5 onglets : Tableau de bord, Synchro, Collection, Ventes, Réglages | La collection reste l’accueil ; un tiroir latéral (≥ 1280 px) ou bas rassemble synchro, file, erreurs | Deux espaces : Tableaux de bord (lecture) et Centre d’activité (tout ce qui touche le site) + barre d’état permanente |
| Pour | Le plus simple à comprendre ; page courte par usage ; fidèle à l’existant | Aucun changement d’habitude ; l’activité reste visible en même temps que la liste | Frise chronologique très claire du run ; état toujours visible |
| Contre | L’erreur n’est visible qu’en bandeau si on est sur un autre onglet (prévu : pastille + bandeau global) | Écran chargé, tiroir étroit sur tablette | Plus de navigation à apprendre, frise plus longue à construire |
| Coût | Moyen | Moyen à fort (mise en page à deux zones) | Fort |

Éléments communs (dans les trois) : **barre d’état globale** (statut, progression fine, « N erreur · M en attente »), **panneau d’erreur** (D-30), **liste des ignorées**.

## Règles
- D-01 Tableaux de bord : cartes `KPI` (valeur 30 px gras, libellé, sous-texte) ; répartition des décisions en barre empilée + légende texte (« Garder 40 % ») ; tableau par rareté en liste empilée sous 600 px.
- D-02 Organisation en 6 onglets (demande d’Alexis, 2026-11-13) : **Tableau de bord** léger (état en cours, erreur, 4 chiffres clés, répartition des décisions, santé de la synchro) ; **Synchro** (barres globale et par étape, tâches en cours / à venir / terminées, erreur, ignorées, journal, fraîcheur des prix) ; **Lots** (lots à appliquer cochables, aperçu, durée estimée, avertissement, écarts avec le site, bouton Lancer) ; **Collection** (recherche, filtre, tri, puis analyses : doublons, à trier, défaussables, évolution sur 30 jours, valeur par décision, plus chères, thèmes) ; **Ventes** (places, file, heures fortes) ; **Réglages** repliables. Les données précises vont hors du tableau de bord. Maquette : artefact « Refonte IHM · 3 variantes », variante 1. L’évolution sur 30 jours demande un historique quotidien du nombre d’exemplaires (nouvelle clé de stockage, migration).
- D-03 Bandeau d’activité (demande d’Alexis, 2026-11-13) : sous la navigation, visible sur tous les onglets, une ligne par traitement **en cours** (Synchro, Lots) ; masqué quand rien ne tourne (« Aucune activité en cours »). Panneau **dépliable** : replié = nom, barre fine, pourcentage et résumé (une ligne, minimaliste) ; déplié = une barre par étape ou par lot, Pause / Reprendre, Arrêter. `aria-expanded` sur le bouton d’en-tête. Le même principe (replié minimal, déplié complet) s’applique aux sections de l’onglet Réglages et aux panneaux de détail.
- D-04 Mouvement (demande d’Alexis, 2026-11-13) : courbes `cubic-bezier(.22,1,.36,1)` (sortie douce, 350 à 500 ms) pour les apparitions, barres et dépliages ; `cubic-bezier(.34,1.56,.64,1)` (léger rebond) pour les déplacements de cartes et les boutons ; apparition des blocs par fondu et glissement de 10 px ; barres de progression actives avec reflet qui défile ; dépliage des panneaux en hauteur fluide (`grid-template-rows` 0fr → 1fr). **Tableau de tri** (onglet Collection, vue « Tableau de tri ») : colonnes Garder / Échanger / Vendre / Défausser / À trier ; glisser-déposer d’une carte vers une colonne ou entre deux cartes ; déplacement fluide avec rebond, flou de mouvement (`blur` 1,6 px, 0,7 s) et ombre pendant le trajet, colonne cible mise en évidence ; **alternative clavier et tactile obligatoire** : flèches ← → de 44 px sur chaque carte ; les décisions restent locales (`decidePar: 'moi'`). Les animations ne passent que par `transform`, `opacity`, `filter` et les positions ; `prefers-reduced-motion` les coupe toutes, et un réglage « Animations » permet de les désactiver.
- D-05 Tri de tableau animé (Alexis, 2026-11-13) : en-têtes de colonnes cliquables (`aria-sort`), cycle croissant → décroissant → aucun ; les lignes glissent vers leur nouvelle place avec rebond et léger flou de mouvement ; un filtre fait disparaître les lignes en fondu, sans saut. S’applique aux tableaux de la Collection, de la File de vente et aux lots (ordre d’application) : même critère d’ordre que les colonnes du tableau. Le réordonnancement par glisser-déposer du tableau de tri (D-04) reste possible.
- D-06 Barre de répartition avec légende intégrée (Alexis, 2026-11-13) : l’étiquette (« Garder 40 % ») est écrite dans chaque segment ; au survol ou au focus d’un segment, il s’agrandit (zoom en hauteur et en largeur), les autres s’estompent, et une bulle de détail suit le segment avec un déplacement fluide : nombre d’exemplaires, part, valeur estimée, exemples de cartes. Chaque segment est un bouton avec `aria-label` complet (accessible au clavier et au lecteur d’écran).
- D-07 Catalogue des effets par élément (revue complète, Alexis, 2026-11-13) :
  | Élément | Effet |
  |---|---|
  | Page, en-tête, blocs | apparition en fondu glissé (10 px), blocs décalés de 50 ms ; changement de thème en fondu de 0,5 s |
  | Onglets | indicateur qui glisse d’un onglet à l’autre avec rebond |
  | Bandeau d’activité | dépliage en hauteur fluide, apparition de la ligne |
  | Cartes et sections | ombre et bordure qui se renforcent au survol |
  | Chiffres clés | compte à rebours ascendant (0 → valeur, 0,5 s) à chaque affichage |
  | Barres de progression | remplissage animé depuis la gauche, reflet qui défile sur celles en cours |
  | Graphiques (colonnes, pistes) | croissance depuis la base, décalée colonne par colonne |
  | Répartition des décisions | zoom du segment et bulle de détail (D-06) |
  | Listes (tâches, journal, ventes) | lignes qui arrivent en cascade, surlignage au survol |
  | Tableaux | lignes qui glissent au tri, surlignage au survol (D-05) |
  | Tableau de tri | rebond, flou, soulèvement au survol, colonne cible (D-04) |
  | Interrupteurs | bouton qui glisse avec rebond, fond qui s’inverse |
  | Champs | halo de focus progressif |
  | Boutons | léger soulèvement au survol, enfoncement à l’appui |
  | Réglages | sections qui se déplient en hauteur, chevron qui pivote |
  | Erreur | entrée avec courte secousse, `role="alert"` |
  | Statut « À jour » | pastille qui pulse |
  Tout est coupé par `prefers-reduced-motion` et par le réglage « Animations ».
- D-08 Harmonisation du mouvement par type d’élément (Alexis, 2026-11-13) : **trois durées et deux courbes seulement**, des tokens (`src/styles/tokens.css`) : `--d-fast` 0,2 s (retours au survol, focus, couleurs), `--d-base` 0,4 s (apparitions, dépliages, déplacements courts), `--d-move` 0,65 s (déplacement de lignes et de cartes), `--d-bar` 0,9 s (remplissage de barre) ; `--ease-out` `cubic-bezier(.22,1,.36,1)` (apparition, remplissage) et `--ease-spring` `cubic-bezier(.34,1.56,.64,1)` (déplacement, rebond).
  | Type | Règle |
  |---|---|
  | Cliquable (bouton, onglet, en-tête de colonne, chevron) | survol : soulèvement 1 px, `--d-fast`, `--ease-spring` ; appui : échelle 0,96 ; focus : halo 3 px |
  | Table (lignes) | survol : surlignage 6 % `--d-fast` ; tri et filtre : glissement `--d-move` + `--ease-spring`, flou 1,2 px pendant le trajet ; entrée en cascade 40 ms |
  | Barre (progression, piste, graphique) | remplissage depuis la gauche ou la base `--d-bar` + `--ease-out` ; reflet seulement sur une barre en cours |
  | Zoomable (segment de répartition) | grandit en hauteur et en largeur `--d-base` + `--ease-spring`, ombre, autres segments à 55 % ; bulle de détail suit en `--d-move` |
  | Déplaçable (carte du tableau de tri) | survol : soulèvement 2 px + ombre ; pendant le déplacement : `--d-move` + `--ease-spring`, flou 1,6 px, échelle 1,03 ; carte glissée à 40 % |
  | Panneau dépliable | hauteur `grid-template-rows` 0fr → 1fr, `--d-base` + `--ease-out`, chevron qui pivote ; contenu masqué (visibility) une fois replié |
  | Carte / bloc | apparition `--d-base` + `--ease-out`, ombre au survol `--d-base` |
  | Interrupteur | bouton qui glisse `--d-base` + `--ease-spring` |
  | Alerte | entrée + secousse 0,5 s, une seule fois |
- D-10 Barre de progression : `role="progressbar"` avec `aria-valuenow/min/max` et `aria-label` ; contour et remplissage en `paper` ; le pourcentage et l’étape sont **écrits** à côté ; version fine (8 px) pour la barre globale.
- D-11 Étapes : « ✓ Lecture / ▶ Pages / ○ Prix / ✕ Ignorées » : symbole + mot + couleur (garder = fait, echanger = en cours, muted = attente, defausser = erreur). Mise à jour annoncée dans une zone `aria-live="polite"` (au plus toutes les 2 s).
- D-20 Tâches : trois listes En cours / À venir (par lot : type, nombre) / Terminées (dernières 20), puis lien vers l’historique filtrable (type, résultat, carte, lot).
- D-30 Panneau d’erreur (`role="alert"`, bordure gauche 6 px `defausser`) : titre, liste Action / Carte / Réponse du site / Cause probable / Déjà fait ; boutons dans l’ordre : **Réessayer cette action** (principal), Sauter cette action, Sauter ce lot (N actions), Ignorer jusqu’à la prochaine synchro, Arrêter tout (bordure `defausser`). Phrase d’explication : « Sauter n’envoie rien au site. » Un 401, 429 ou refus hors exemplaire garde la pause de 30 min : « Réessayer » est alors remplacé par « Relancer la synchro » (règle existante).
- D-31 Ignorées : tableau Action / Carte / Jusqu’à (ce lot, prochaine synchro) / Reprendre.
- D-40 Pastille de statut : texte + contour (`À jour`, `En cours`, `Arrêtée`, `Erreur`).
- D-50 Réglages (sauvegarde, plafond de défausse, étiquettes préexistantes, Wikipédia, thèmes) : sections repliables, fermées par défaut, titre + résumé de la valeur courante.

## Responsive
| Breakpoint | Largeur | Comportement |
|---|---|---|
| base | 375 px | une colonne ; onglets défilables ; tableaux en cartes empilées ; boutons d’erreur pleine largeur |
| `md` | 768 px | KPI en 2 colonnes, blocs en 2 colonnes |
| `xl` | 1280 px | KPI en 4 colonnes ; V2 : tiroir fixe de 400 px |

## Accessibilité
Contrastes : mêmes paires que l’existant (texte `paper` sur `ink` / `ink-2`, statuts sur `ink-2`) : AA déjà vérifié par les tokens. Focus visible, cibles ≥ 44 px, `prefers-reduced-motion` (pas d’animation de barre), focus déplacé sur le panneau d’erreur à son apparition, libellés ARIA en français.
