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
