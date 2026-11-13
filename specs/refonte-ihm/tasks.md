# Tâches — Refonte de l’interface de gestion (`refonte-ihm`)

Vagues : V0 : T-301 [P], T-303 [P], T-315 [P], T-316 [P] · V1 : T-302 [P], T-314 [P], T-304 [P] · V2 : T-313 [P], T-305 [P], T-308 [P], T-309 [P], T-318 [P] · V3 : T-306 [P], T-311 [P], T-317 [P], T-312 [P] · V4 : T-307 · V5 : T-310, puis T-319 (séquentiel)

Les identifiants du plan (T-301 à T-319) sont gardés tels quels (pas de T-001) ; l’ordre des vagues vient du plan § 4. Entrées lues par chaque dev : son brief, `spec.refined.md` (prioritaire pour le vocabulaire : « exécution » = `idLot` du code, « lot » = groupe par famille), `design.md`, `plan.md`, `AGENTS.md`.

## Décisions par défaut (points ouverts du plan, adoptés par Alexis)
1. **Champ `debut`** (horodatage de début de synchro) ajouté au statut de synchro v2 ; la liste fermée de SC-019 devient `etape`, `prixFaits`, `prixPrevus`, `debut`. Portée : T-303 (validateur, migration, `null` pour une v1), T-314 (écriture par `synchroAuto.ts`, même écriture, aucune requête), T-304 (purge des ignorées, H3).
2. **« Réessayer » après résultat inconnu** : désactivé (`aria-disabled`, raison écrite « Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action ») quand l’entrée de journal de l’action en erreur a `resultat: 'inconnu'` ; actif dans tous les autres cas de D-33. Portée : T-313 (`reprise.ts`, `pilotageLots.ts`), T-307 (affichage).
3. **Seuil de refus par carte atteint** (3 d’affilée ou 5 par lot, arrêt `code-http` 403) : traité comme un refus hors exemplaire, donc `pauseJusqua` = maintenant + 30 min. Portée : T-313 (`reprise.ts`), T-307 (affichage).
4. **Sauter une création d’étiquette** retire aussi des restantes les poses de la même étiquette, comptées « sautées » (même règle que SC-006 pour l’ignorée) ; ignorer idem. Portée : T-313 (`pilotageLots.ts`), T-303 (`filtrerLotIgnore`), T-311 (aperçu).

## Règles transverses (valables pour toutes les tâches)
- Tests écrits **avant** le code (`dev-test` ou le dev lui-même en premier commit), `npm run check && npm run build` verts ; tâche `ui` : `npm run test:e2e`, captures 375 / 768 / 1280 × clair / sombre, clavier, AA.
- Aucune nouvelle requête, route, en-tête, permission ni dépendance ; `fetch` reste dans `verifierWikipedia.ts`, `synchroAuto.ts`, `reseau.ts`. `data-testid` existants conservés : `resume`, `synchro`, `synchronisation`, `zone-execution` (jusqu’à T-307), `titre-apercu`, `file-vente`, `apercu`, `etat-synchro-auto`, `synchro-auto`, `ecarts`, `etiquettes-prevues`, `total-etiquettes`, `avertissement-visibilite`, `plafond-defausse`, `apercu-sauvegarde`.
- Aucun fichier hors liste fermée. Si un fichier manque, le dev le signale à l’orchestrateur (pas de modification). Les e2e existants ne sont adaptés que pour la navigation et les sélecteurs, sans retirer ni affaiblir d’assertion (SC-010).
- Composants `React.FC` + export par défaut, un par fichier ; hooks dans leur fichier ; couleurs, durées, courbes uniquement par tokens ; textes français (’, espace insécable avant `:`) ; titres rendus en texte (jamais `innerHTML`) ; données de test fictives.
- Écart au gabarit « ≈ 300 lignes » : T-303, T-304 et T-313 dépassent ce volume (8 à 9 h au plan) ; leur dev les livre en commits séparés par module, dans une seule PR, ou demande à l’orchestrateur un découpage avant de commencer.

## Tableau récapitulatif
| ID | Titre | Couche | Agent | Dépend de | SC | [P] |
|---|---|---|---|---|---|---|
| T-301 | Calculs du tableau de bord et analyses, `placesEncheres` | logique | dev-core | — | SC-001, SC-021, SC-022 | [P] |
| T-303 | Schémas v2, migrations, nouvelles clés, écouteurs | données | dev-core | — | SC-019, SC-007, SC-006, SC-018, SC-020, SC-026 | [P] |
| T-315 | Primitives de mouvement et garde-fous (tokens, contrastes) | ui | dev-ui | — | SC-025, SC-024, SC-022, SC-026, SC-027 | [P] |
| T-316 | Découpage de `Synchronisation.tsx` sans changement de comportement | ui | dev-ui | — | SC-010 | [P] |
| T-302 | Familles, lots, modèle de progression | logique | dev-core | T-303 | SC-002, SC-003, SC-013 | [P] |
| T-314 | Statut de synchro v2 dans le content script | logique | dev-core | T-303 | SC-019, SC-002 | [P] |
| T-304 | Coquille à onglets, hooks, blocage, e2e existants adaptés | ui | dev-ui | T-303, T-315, T-316 | SC-012, SC-011, SC-008, SC-009, SC-010, SC-020, SC-006 | [P] |
| T-313 | Moteur : pause, sauts, reprise, erreur, pause de 30 min | logique | dev-core | T-302, T-303, T-316 | SC-004, SC-005, SC-006, SC-014, SC-016, SC-017 | [P] |
| T-305 | Onglet Tableau de bord | ui | dev-ui | T-301, T-304, T-315 | SC-001, SC-022, SC-027, SC-009 | [P] |
| T-308 | Onglet Collection (tableau triable, analyses, évolution) | ui | dev-ui | T-301, T-303, T-304, T-315 | SC-021, SC-020, SC-024, SC-011, SC-009 | [P] |
| T-309 | Onglet Réglages repliable | ui | dev-ui | T-304, T-315 | SC-028, SC-026 | [P] |
| T-318 | Onglet Ventes | ui | dev-ui | T-301, T-304, T-315 | SC-024, SC-009 | [P] |
| T-306 | Onglet Synchro (progression, tâches) | ui | dev-ui | T-302, T-304, T-314, T-315 | SC-002, SC-003, SC-028, SC-009 | [P] |
| T-311 | Onglet Lots | ui | dev-ui | T-304, T-313, T-315 | SC-015, SC-016, SC-006, SC-024 | [P] |
| T-317 | Bandeau d’activité | ui | dev-ui | T-302, T-304, T-313 | SC-013, SC-014, SC-002 | [P] |
| T-312 | Tableau de tri (glisser-déposer) | ui | dev-ui | T-308 | SC-023, SC-026, SC-008 | [P] |
| T-307 | Panneau d’erreur, ignorées, historique filtrable | ui | dev-ui | T-306, T-313 | SC-004, SC-005, SC-006, SC-007, SC-008, SC-016, SC-017, SC-018 | — |
| T-310 | Tests transverses et captures finales | tests | dev-test | T-305, T-306, T-307, T-308, T-309, T-311, T-312, T-317, T-318 | SC-007, SC-008, SC-009, SC-010, SC-011, SC-026 | — |
| T-319 | Documentation (`AGENTS.md`, `README.md`) | docs | dev-core | T-310 | — | — |

Graphe acyclique vérifié : V0 sans dépendance ; V1 dépend de V0 ; V2 de V0-V1 ; V3 de V1-V2 ; V4 de V2-V3 ; V5 de tout. Chemin critique : T-303 → T-304 → T-306 → T-307 → T-310 → T-319.

---

## T-301 — Calculs du tableau de bord et analyses
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P] (V0)
- **SC couverts** : SC-001, SC-021, SC-022 (données) · **Règles design** : D-01, D-02, D-06, D-13
- **Fichiers concernés** (liste fermée) :
  - `src/lib/tableauDeBord.ts` (créé)
  - `src/lib/analyses.ts` (créé)
  - `src/lib/lot.ts` (extraction de `placesEncheres` seulement)
  - `tests/unit/tableauDeBord.test.ts` (créé)
  - `tests/unit/analyses.test.ts` (créé)
- **Critères d’acceptation**
  1. Exemplaires = Σ `quantite` hors `en-vente`, cartes distinctes (`rareté|titre`), « N en vente » ; valeur estimée = Σ `valeurMarchande` × `quantite` (cartes hors `en-vente` à valeur connue) ; part en % entier des cartes distinctes hors `en-vente` sans valeur.
  2. Répartition par statut (À trier, Garder, Échanger, Vendre, En vente, Défausser) : exemplaires, valeur, 3 titres d’exemple par statut, parts arrondies par plus forts restes (somme = 100) ; statut à 0 absent.
  3. Places d’enchères « occupées / max » par `placesEncheres` (même formule que l’ancien code de `lot.ts` l. 257-258), `lot.ts` appelle la fonction extraite, comportement inchangé (tests `lot*.test.ts` verts).
  4. Écarts = nombre de cartes renvoyées par `calculerEcarts` (`src/lib/ecarts.ts`).
  5. Santé : pastille D-40 (`a-jour` | `en-cours` | `arretee` | `erreur`) et âge de la dernière synchro terminée (« il y a 12 min », « jamais », « synchro automatique coupée ») avec horloge injectée ; fraîcheur des prix (données pour `FraicheurPrix`).
  6. Collection vide ou toutes sans prix : 0 exemplaire, valeur et part « — » (représentées par `null`), répartition vide, jamais `NaN` ni division par zéro.
  7. `analyses.ts` : doublons (`quantite` > 1), à trier, défaussables (statut `defausser`, valeur connue ≤ plafond réglé de `tri.ts`), valeur par décision, 10 plus chères, 10 thèmes via `themesDeCarte` ; chaque analyse renvoie une liste vide exploitable (états vides écrits par l’UI).
- **Tests attendus**
  - `tests/unit/tableauDeBord.test.ts` : AC1 à AC6, dont collection vide, cartes toutes sans prix, plus forts restes (somme 100), exclusion `en-vente`.
  - `tests/unit/analyses.test.ts` : AC7 (bornes à 10, plafond réglé, égalités stables).
  - `tests/unit/lot*.test.ts` existants inchangés (AC3).
- **Brief de contexte**
  - *Pourquoi* : fournir les chiffres de l’onglet Tableau de bord (SC-001, SC-022 données) et les analyses de la Collection (SC-021) sans UI, testables d’abord.
  - *État actuel* : `src/lib/lot.ts` l. 257-258 calcule les places d’enchères en ligne (min de `CONFIG_PRIX.maxVentesSimultanees` et `ventesSite.max`, max de cartes `en-vente` et `ventesSite.enCours`). `src/lib/collection.ts` porte le modèle (`quantite`, `statut`, `valeurMarchande`, `decidePar`). `src/lib/ecarts.ts` expose `calculerEcarts`. `src/lib/themes.ts` expose `themesDeCarte`. `src/lib/tri.ts` lit le plafond réglé (`plafondDefausse`, défaut `PLAFOND_VALEUR_DEFAUSSE`).
  - *À faire* : créer `tableauDeBord.ts` (exports purs : `calculerTableauDeBord(collection, contexte, maintenant)` renvoyant `{ exemplaires, distinctes, enVente, valeur, partSansPrix, places:{occupees,max}, ecarts, repartition[], sante:{pastille, ageLibelle}, fraicheurPrix }`) et `analyses.ts` (`doublons`, `aTrier`, `defaussables`, `valeurParDecision`, `plusCheres`, `themesFrequents`). Extraire `export function placesEncheres(...)` dans `lot.ts` et l’appeler depuis l’ancien emplacement. Choisir les noms exacts et les documenter en en-tête de fichier : T-305, T-308, T-318 les importent.
  - *Contrats* : pas de `chrome.*`, horloge injectée, aucune dépendance. Pas de nouvelle couleur. Arrondi : algorithme des plus forts restes (tri stable sur égalité).
  - *Pièges* : `en-vente` exclu des totaux mais présent dans la répartition (H6) ; ne pas modifier le calcul existant de `lot.ts`.
  - *Vérifier* : `npx vitest run tests/unit/tableauDeBord.test.ts tests/unit/analyses.test.ts tests/unit/lot.test.ts && npm run check && npm run build`

---

## T-303 — Schémas v2, migrations, nouvelles clés, écouteurs
- **Couche** : données · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P] (V0)
- **SC couverts** : SC-019, SC-007, SC-006 (logique), SC-018 (libellés), SC-020 (logique), SC-026 (stockage) · **Règles design** : D-17, D-20, D-31, D-62
- **Fichiers concernés** (liste fermée) :
  - `src/lib/actions.ts`
  - `src/lib/journal.ts`
  - `src/lib/stockage.ts`
  - `src/lib/etatExecution.ts` (créé)
  - `src/lib/statutSynchro.ts` (créé)
  - `src/lib/ignorees.ts` (créé)
  - `src/lib/historique.ts` (créé)
  - `src/lib/affichage.ts` (créé)
  - `tests/unit/journal.test.ts`, `tests/unit/journal-ui.test.ts` (seulement si une attente de version v1 doit passer à v2 ; sinon inchangés)
  - `tests/unit/stockage.test.ts` (trois `version: 2` « inconnue » → `version: 3`, seule modification d’attente permise ; ajout de cas)
  - `tests/unit/journal-v2.test.ts`, `tests/unit/etat-execution.test.ts`, `tests/unit/statut-synchro.test.ts`, `tests/unit/ignorees.test.ts`, `tests/unit/historique.test.ts`, `tests/unit/affichage.test.ts`, `tests/unit/stockage-v2.test.ts` (créés)
- **Critères d’acceptation**
  1. Journal v2 : `{version:2, entrees}`, chaque entrée + `rang`, `total`, `lot`, `cause` (`null` permis ; `cause` dans la liste fermée : raisons d’arrêt de `file.ts` + `sautee` + `ignoree`) ; une entrée v1 (9 clés exactes) est lue avec ces champs à `null`, réécrite en v2 à la prochaine écriture ; version inconnue : erreur « illisible », jamais écrasé ; bornes 1 000 entrées / 1 Mo inchangées.
  2. Exécution v2 : + `lots[{famille,total,traitees,sautees}]` (≤ 5), `pauseJusqua`, `erreur{type, parametre, idCarte, titre, famille, indexLot, nbLots, rang, totalLot, codeHttp, cause, le, reussies, autresEchecsEnVol}` (aucun identifiant d’exemplaire du site, chaînes tronquées) ; v1 → `lots: []`, `pauseJusqua: null`, `erreur: null` ; version inconnue : « illisible », « Lancer » désactivé (inchangé). `enregistrerExecution` accepte une v1 et la complète.
  3. Statut de synchro v2 : + `etape` (`stats|pages|prix|ventes|null`), `prixFaits`, `prixPrevus`, `debut` (décision 1) ; v1 → `null` partout ; version inconnue → `null` ; `enregistrerStatutSynchro` accepte une v1. `StatutSynchro` réexporté depuis `stockage.ts`.
  4. `ignorees.ts` : `{version:1, entrees[{type,idCarte,parametre,portee:'synchro',date}]}` ≤ 500 ; `ajouterIgnoree`, `retirerIgnoree` (Reprendre), `purger(entrees, {maintenant, statutSynchro, cartes})` (synchro complète `termine` dont `debut` > `date`, carte disparue, 30 jours), `filtrerLotIgnore(actions, ignorees)` (une création ignorée écarte les poses de la même étiquette, raison « création ignorée »).
  5. `historique.ts` : `{version:1, points[{jour:'AAAA-MM-JJ', exemplaires}]}` ≤ 30, jour local, le dernier du jour remplace, série avec trous ; `affichage.ts` : `{version:1, animations:boolean}`, défaut `true`.
  6. Nouvelles clés absentes → valeurs par défaut ; illisibles → valeurs par défaut **sans écraser** ; écouteurs `ecouterExecution`, `ecouterJournal`, `ecouterIgnorees`, `ecouterAffichage`, `ecouterHistorique` ; une écriture refusée (quota) rejette l’erreur et ne touche pas la valeur existante.
  7. Libellés d’historique H5 (fonction pure dans `journal.ts`) : `echouee` 403/404 sur pose, retrait, enchère, défausse → « Passée : exemplaire indisponible » ; `cause: 'sautee'` → « Passée : sautée » ; `'ignoree'` → « Passée : ignorée jusqu’à la prochaine synchro » ; la donnée stockée est inchangée.
  8. Validateurs champ par champ sur liste fermée : clé inconnue (`access_token`, `corps`…) ignorée ou objet rejeté ; `cause` hors liste rejetée.
  9. Aucune de ces clés dans `sauvegarde.ts` (inchangé).
- **Tests attendus** (par clé : v1, v2, version inconnue, forme invalide, clé en trop)
  - `tests/unit/journal-v2.test.ts` (AC1, AC7, AC8) · `tests/unit/etat-execution.test.ts` (AC2, AC8) · `tests/unit/statut-synchro.test.ts` (AC3) · `tests/unit/ignorees.test.ts` (AC4) · `tests/unit/historique.test.ts` + `tests/unit/affichage.test.ts` (AC5) · `tests/unit/stockage-v2.test.ts` (AC6, AC9, quota simulé).
  - `tests/unit/stockage.test.ts` : seules les trois `version: 2` deviennent `version: 3` (journal l. 260, exécution l. 301, statut l. 596).
- **Brief de contexte**
  - *Pourquoi* : socle de données de toute la refonte (SC-019) ; aucune UI ne peut lire exécution, ignorées ou historique sans lui.
  - *État actuel* : `stockage.ts` valide aujourd’hui journal, exécution et statut en ligne (v1) et est le seul module de `src/lib` qui touche `chrome.storage.local`. `journal.ts` refuse toute entrée qui n’a pas exactement 9 clés (`id, horodatage, idCarte, titre, type, parametre, resultat, codeHttp, idLot`). `EtatFile` = `EtatExecution` (`idLot, etat, traitees, total`) + `raison` (`manuel|echecs|code-http|resultat|ecriture|transport|verification`). `StatutSynchro` v1 : `etat, page, pages, raison, codeHttp, le, ajoutees, etiquettes, prix`.
  - *À faire* : extraire les validateurs vers `etatExecution.ts` / `statutSynchro.ts` (pure, migration v1 → v2), créer `ignorees.ts`, `historique.ts`, `affichage.ts`, étendre `actions.ts` (types `EntreeJournal` v2, `EtatExecutionV2`, `FamilleLot` = `etiquettes|encheres|defausses|suppressions|lectures`, `CauseJournal`). `stockage.ts` ne fait que lire, valider via ces modules, écrire. Exporter ces noms : T-302, T-304, T-313, T-314 en dépendent.
  - *Contrats* : AGENTS.md (clés, bornes), SC-007 (liste fermée, jamais d’identifiant d’exemplaire dans `erreur`, `ignorees`, `historique`), SC-019. Décisions 1 et 4 ci-dessus.
  - *Pièges* : service worker éphémère et Vitest sans `chrome.*` (simuler `chrome.storage`) ; ne jamais réécrire une valeur de version inconnue ; `journal-ui.test.ts` et `journal.test.ts` ne changent pas d’attente hors version ; ne pas toucher à `sauvegarde.ts`.
  - *Vérifier* : `npx vitest run tests/unit/stockage.test.ts tests/unit/journal.test.ts && npm run check && npm run build`

---

## T-315 — Primitives de mouvement et garde-fous
- **Couche** : ui (socle) · **Agent** : dev-ui
- **Dépend de** : — · **Parallélisable** : [P] (V0)
- **SC couverts** : SC-025, SC-024 (fonction de tri), SC-022 (contrastes), SC-026 (mécanisme), SC-027 (composant) · **Règles design** : D-04, D-07, D-08, D-10, D-13, D-14 (estompage), D-16, D-17, D-18, D-19, D-40, D-61
- **Fichiers concernés** (liste fermée) :
  - `src/styles/tokens.css` (classes communes seulement : reflet de barre, rayures indéterminées, secousse ; les tokens D-08/D-17 sont déjà écrits)
  - `src/lib/ordreTableau.ts` (créé)
  - `src/app/useMouvement.ts`, `src/app/useFlip.ts`, `src/app/BarreProgression.tsx`, `src/app/SectionRepliable.tsx`, `src/app/PastilleStatut.tsx`, `src/app/PastilleStatutCarte.tsx`, `src/app/ChiffreAnime.tsx`, `src/app/EnTeteTriable.tsx` (créés)
  - `tests/unit/mouvement-tokens.test.ts`, `tests/unit/contrastes.test.ts`, `tests/unit/ordre-tableau.test.ts` (créés)
- **Critères d’acceptation**
  1. Test : présence des tokens `--d-fast 0.2s`, `--d-base 0.4s`, `--d-move 0.65s`, `--d-bar 0.9s`, `--ease-out`, `--ease-spring`, `--d-shake 0.5s`, `--d-cascade-ligne 40ms`, `--d-cascade-bloc 50ms` et de la règle `:root[data-animations='off']` ; aucun fichier de `src/app` ni `src/styles` hors `tokens.css` ne contient `cubic-bezier(`, de durée littérale de `transition`/`animation`, ni de couleur littérale.
  2. Test de contrastes calculés depuis `tokens.css` : `ink` sur chaque fond de statut (garder, echanger, vendre, defausser, `muted`, rayure sombre « En vente ») ≥ 4,5:1 dans les deux thèmes, y compris sous `saturate(.45)` (pire cas : gris désaturé).
  3. `ordreTableau.ts` : tri stable, `localeCompare('fr')`, inconnues en dernier dans les deux sens, cycle croissant → décroissant → aucun.
  4. `useMouvement` : vrai si `prefers-reduced-motion: reduce` ou réglage `affichage.animations === false` ; `BarreProgression` : `role="progressbar"`, `aria-valuemin/max/now`, `aria-label` français, texte écrit à côté, indéterminée (sans `aria-valuenow`, rayures, « N lus » ; plein `muted` si mouvement coupé).
  5. `ChiffreAnime` : compteur `aria-hidden`, valeur finale dans le nom accessible dès le premier rendu, directement final si mouvement coupé ; `SectionRepliable` : `aria-expanded`/`aria-controls`, contenu replié `visibility: hidden` (hors tabulation) ; `EnTeteTriable` : `th` + `button` 44 px, `aria-sort`, Entrée/Espace ; pastilles D-40 / D-13 (symbole + mot).
- **Tests attendus**
  - `tests/unit/mouvement-tokens.test.ts` (AC1) · `tests/unit/contrastes.test.ts` (AC2) · `tests/unit/ordre-tableau.test.ts` (AC3) · composants (AC4-AC5) : rendus par `renderToStaticMarkup` en test unitaire dans les mêmes fichiers ou dans `tests/unit/primitives.test.tsx` (à créer si le dev l’ajoute ; ce fichier est autorisé) ; les e2e de ces composants viennent avec les onglets.
- **Brief de contexte**
  - *Pourquoi* : verrouiller mouvement et contrastes avant toute UI (SC-025, SC-022) et fournir les primitives réutilisées par 8 tâches.
  - *État actuel* : `tokens.css` contient déjà les tokens de mouvement, ombres, `--surface-survol`, `--halo-focus`, `--hachure-en-vente` et la règle `data-animations='off'` (écrits par le designer). Il n’existe ni `src/app/useMouvement.ts` ni aucune primitive ; `CarteLigne.tsx` n’est pas concerné.
  - *À faire* : ajouter à `tokens.css` seulement les classes communes citant des tokens ; créer les 8 primitives avec props typées et exports documentés (T-305, T-306, T-307, T-308, T-309, T-312, T-317, T-318 les importent) : `BarreProgression({valeur,max,libelle,texte,fine?,enCours?})`, `SectionRepliable({titre,resume,id,children})`, `useMouvement(): boolean` (`true` = animations autorisées), `useFlip(cles)`, `ChiffreAnime({valeur,libelle})`, `EnTeteTriable({colonne,etat,onBasculer})`, `PastilleStatut({etat})`, `PastilleStatutCarte({statut})`.
  - *Contrats* : D-08 (4 durées, 2 courbes), D-17, D-18 (jamais `line` pour un contrôle, jamais `opacity` sur un texte), D-19 (cibles 44 px, `gap-2`). `useMouvement` lit `affichage` via un paramètre ou un contexte fourni par `useAffichage` (T-304) : en attendant, accepter la valeur par défaut `true` et exposer un setter de contexte (`ContexteAffichage`) défini dans `useMouvement.ts`.
  - *Pièges* : pas de `localStorage` (lint) ; animer uniquement `transform`, `opacity`, `filter`, `grid-template-rows`, couleurs ; FLIP uniquement sur les lignes rendues.
  - *Vérifier* : `npm run check && npm run build` puis `npm run test:e2e` (les e2e existants doivent rester verts : aucun composant n’est encore monté).

---

## T-316 — Découpage de `Synchronisation.tsx`
- **Couche** : ui (refactor) · **Agent** : dev-ui
- **Dépend de** : — · **Parallélisable** : [P] (V0)
- **SC couverts** : SC-010 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/app/Synchronisation.tsx` (supprimé)
  - `src/app/apercuLot.ts`, `src/app/pilotageLots.ts`, `src/app/useExecution.ts`, `src/app/BandeauRisque.tsx`, `src/app/ZoneExecution.tsx`, `src/app/ListeActionsLot.tsx`, `src/app/CartesNonIncluses.tsx`, `src/app/ApercuLot.tsx` (créés)
  - `src/app/App.tsx` (import et usage de `ApercuLot`/`lancerSuppressionEtiquettes` uniquement : l. 25 et 334)
  - `tests/unit/synchronisation.test.ts`, `tests/unit/apercu-etiquettes.test.ts`, `tests/unit/bail-lot.test.ts` (chemin d’import seulement)
- **Critères d’acceptation**
  1. Fonctions pures (l. 45-396 : libellés, totaux, durée, `raisonDesactivation`, non incluses, `configDuLot`, `preparerLot`, `detailsDuLot`, `libelleCause`, `texteFin`, `libelleErreurLancement`) déplacées dans `apercuLot.ts` avec mêmes noms et signatures.
  2. Contexte, `lancerLot`, `sousBail`, `executerLot`, `lancerSuppressionEtiquettes`, `actionsRetrait` (l. 398-589) dans `pilotageLots.ts`, contexte singleton conservé.
  3. `BandeauRisque` (l. 603-623), `ZoneExecution` (l. 635-722), abonnements (l. 773-837) dans `useExecution.ts`, liste d’actions et cartes non incluses (l. 1010-1073) dans leurs composants, reste dans `ApercuLot.tsx`.
  4. Aucun changement de texte, de comportement, de `data-testid` ni d’ordre d’effets ; `Synchronisation.tsx` n’existe plus.
  5. Les trois tests changent seulement leur chemin d’import (`../../src/app/apercuLot`, `../../src/app/pilotageLots`), aucune attente.
- **Tests attendus**
  - `tests/unit/synchronisation.test.ts`, `apercu-etiquettes.test.ts`, `bail-lot.test.ts` : verts avec imports modifiés (AC5).
  - `tests/e2e/synchro-ecriture.spec.ts`, `tests/e2e/etiquettes.spec.ts` : verts sans modification (AC4).
- **Brief de contexte**
  - *Pourquoi* : rendre la suite révisable et débloquer T-304/T-313 (SC-010).
  - *État actuel* : `src/app/Synchronisation.tsx` (1 123 lignes) mêle logique pure, contexte d’exécution, composants et abonnements ; `App.tsx` l. 25 l’importe avec `lancerSuppressionEtiquettes` et le monte l. 334. `Journal.tsx` existe déjà.
  - *À faire* : suivre le tableau « Découpage » de `plan.md`. `useExecution.ts` regroupe les abonnements (file, onglets, journal, registre, clôture des interrompues) ; `ApercuLot.tsx` appelle `useExecution`. `App.tsx` : ne changer que l’import et le montage pour que le comportement reste identique (T-304 le réécrit ensuite).
  - *Contrats* : refactor pur, pas d’amélioration au passage. `fetch` n’apparaît nulle part.
  - *Pièges* : l’ordre des effets et le focus (zone d’exécution) doivent rester identiques ; ne pas dupliquer le contexte singleton ; vérifier `grep Synchronisation src tests` sans résultat.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-302 — Familles, lots et modèle de progression
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-303 · **Parallélisable** : [P] (V1)
- **SC couverts** : SC-002, SC-003, SC-013 (résumé) · **Règles design** : D-10, D-11, D-20, D-21
- **Fichiers concernés** (liste fermée) :
  - `src/lib/familles.ts` (créé), `src/lib/progression.ts` (créé)
  - `tests/unit/familles.test.ts`, `tests/unit/progression.test.ts` (créés)
- **Critères d’acceptation**
  1. `familles.ts` : famille d’une action (`etiquettes` = création, retrait, pose ; `encheres` ; `defausses` ; `suppressions` ; `lectures`) ; découpage d’une exécution en lots par famille, dans l’ordre de première apparition, **par appartenance** (pas par plage : une retrait ajouté en fin de file via `file.ajouter` rejoint le lot Étiquettes).
  2. Barre globale de synchro « Étape i / k · P % » (4 étapes de poids égal `stats`, `pages`, `prix`, `ventes` ; la courante à sa fraction) ; barres d’étape et de lot « N / M · P % » ; M inconnu → indéterminée (« N lus ») ; P monotone par étape ou lot.
  3. Décision d’annonce `aria-live` : au plus toutes les 2 s, sur changement d’étape ou de lot, ou palier de 10 %.
  4. Durée restante H4 : exécution = actions restantes × 0,25 s sans division par la concurrence ; synchro = (pages restantes + prix restants + 1) × 0,25 s ; « environ N min », « moins d’une minute » sous 60 s.
  5. Listes En cours / À venir (une ligne par étape ou lot restant avec famille et nombre) / Terminées (20 dernières, la plus récente en haut) ; sans activité, « Aucune activité en cours » + Terminées.
- **Tests attendus**
  - `tests/unit/familles.test.ts` (AC1, dont retrait ajouté en fin de file) · `tests/unit/progression.test.ts` (AC2 à AC5, horloge injectée, monotonie, arrêt anticipé des pages, `prixPrevus` null).
- **Brief de contexte**
  - *Pourquoi* : modèle de toutes les barres et listes (SC-002, SC-003).
  - *État actuel* : `src/app/Synchronisation.tsx` (devenu `apercuLot.ts` après T-316) définit `SECONDES_PAR_ACTION = 0,25` et `totauxParType` ; `StatutSynchro`/`EtatExecutionV2` v2 viennent de T-303 (`src/lib/actions.ts`, `etatExecution.ts`, `statutSynchro.ts`).
  - *À faire* : fonctions pures, signatures documentées (utilisées par T-306, T-313, T-317) : `familleDe(action)`, `decouperEnLots(actions)`, `progressionSynchro(statut)`, `progressionLot(lot)`, `progressionExecution(etat)`, `annoncer(precedent, courant, maintenant)`, `dureeRestante(...)`, `listesTaches(...)`.
  - *Contrats* : sans `chrome.*`, horloge injectée, aucun accès au stockage. Étapes tirées du champ `etape` v2.
  - *Pièges* : le statut peut être une v1 migrée (`etape: null`) : barre indéterminée, pas d’erreur ; `prixPrevus` peut être null jusqu’à la première annonce.
  - *Vérifier* : `npx vitest run tests/unit/familles.test.ts tests/unit/progression.test.ts && npm run check && npm run build`

---

## T-314 — Statut de synchro v2 dans le content script
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-303 · **Parallélisable** : [P] (V1)
- **SC couverts** : SC-019 (statut), SC-002 (données synchro) · **Règles design** : D-10, D-11
- **Fichiers concernés** (liste fermée) :
  - `src/content/synchroAuto.ts`
  - `src/lib/ordonnanceur.ts` (crochet optionnel `annoncerPrix` seulement)
  - `tests/unit/statut-synchro-ecriture.test.ts` (créé)
- **Critères d’acceptation**
  1. `etape` déduite du chemin demandé dans le `transport` enveloppant existant (`/api/my-collection/stats` → `stats`, `?page=` → `pages`, `/sales?scope=summary` → `prix`, `/api/marketplace/mine` → `ventes`) ; `prixFaits` compté au même endroit ; `debut` (horodatage de début de synchro) écrit dans la même écriture (décision 1).
  2. `prixPrevus` fourni par `annoncerPrix?(n)` appelé une fois avant la boucle de `relevePrix` avec `min(candidats, plafond)` ; sans le crochet, comportement identique.
  3. Écriture du statut ≤ 1 par seconde sauf changement d’étape ou d’état.
  4. Aucune requête, chemin, plan, cadence ni repère modifié ; `ordonnanceur.test.ts`, `synchro-auto.test.ts` et `synchro-auto-lint.test.ts` passent sans modification.
- **Tests attendus**
  - `tests/unit/statut-synchro-ecriture.test.ts` : étapes déduites (AC1), crochet appelé une fois avec la bonne valeur (AC2), débit (AC3, horloge injectée).
- **Brief de contexte**
  - *Pourquoi* : barres par étape et durée de la synchro (SC-002), purge des ignorées (H3).
  - *État actuel* : `synchroAuto.ts` est le seul fichier de `src/content` qui appelle `fetch` et écrit `statutSynchro` v1 (compteurs `ajoutees`, `etiquettes`, `prix`) ; `ordonnanceur.ts` est la logique pure du plan incrémental (`stats` → pages → prix) avec horloge et transport injectés ; la liste de prix est produite par `candidatsPrix`/`relevePrix`.
  - *À faire* : enrichir l’écriture du statut avec les champs v2 de T-303 ; ajouter `annoncerPrix?: (n:number) => void` dans les dépendances de l’ordonnanceur.
  - *Contrats* : AGENTS.md cadre « Lecture automatique de l’API » : aucun jeton lu (`jeton.ts` non importé), aucun en-tête, cadence 0,2 s + gigue ; modification limitée aux compteurs (spec § 4 Content script).
  - *Pièges* : le crochet ne doit rien changer au plan (pas d’effet de bord) ; le relevé d’affluence n’est pas une étape ; ne pas écrire à chaque requête (0,2 s).
  - *Vérifier* : `npx vitest run tests/unit/ordonnanceur.test.ts tests/unit/synchro-auto.test.ts tests/unit/synchro-auto-lint.test.ts tests/unit/statut-synchro-ecriture.test.ts && npm run check && npm run build`

---

## T-304 — Coquille à onglets
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-303, T-315, T-316 · **Parallélisable** : [P] (V1)
- **SC couverts** : SC-012, SC-011, SC-008 (onglets), SC-009 (coquille), SC-010, SC-020 (écriture), SC-006 (purge) · **Règles design** : D-02, D-12, D-17, D-62
- **Fichiers concernés** (liste fermée) :
  - `src/app/App.tsx`, `src/app/onglets.ts`, `src/app/Onglets.tsx`, `src/app/useOngletActif.ts`, `src/app/useDonneesPage.ts`, `src/app/useAffichage.ts`, `src/app/useHistoriqueQuotidien.ts`, `src/app/BlocageCollection.tsx`, `src/app/MessageStockage.tsx`, `src/app/FiltresCollection.tsx` (créés ou réécrits)
  - `src/app/OngletTableauDeBord.tsx`, `src/app/OngletSynchro.tsx`, `src/app/OngletLots.tsx`, `src/app/OngletCollection.tsx`, `src/app/OngletVentes.tsx`, `src/app/OngletReglages.tsx` (créés : contenu actuel déplacé tel quel)
  - `tests/e2e/extension.ts` (aide `allerA(page, onglet)`)
  - `tests/e2e/extension.spec.ts`, `lecture-site.spec.ts`, `assistant.spec.ts`, `sauvegarde.spec.ts`, `plafond-defausse.spec.ts`, `synchro-auto.spec.ts`, `synchro-auto-ui.spec.ts`, `etiquettes.spec.ts`, `synchro-ecriture.spec.ts` (navigation et sélecteurs seulement)
  - `tests/e2e/refonte-coquille.spec.ts` (créé)
- **Critères d’acceptation**
  1. Six onglets dans l’ordre Tableau de bord, Synchro, Lots, Collection, Ventes, Réglages ; motif WAI-ARIA `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `tabindex` itinérant, ← → Origine Fin ; barre défilante dans son conteneur à 375 px.
  2. Onglet actif porté par `location.hash` (`#tableau-de-bord`, `#synchro`, `#lots`, `#collection`, `#ventes`, `#reglages`) ; défaut Tableau de bord si inconnu ; Précédent/Suivant fonctionnent ; rien en stockage.
  3. Seul le panneau actif est monté ; `VerificationWikipedia` n’est monté que dans la vue liste de l’onglet Collection avec la même règle et la même pagination de 200 ; filtres, vue et pagination de la Collection remontés dans `App`.
  4. `BlocageCollection` (collection illisible : message + téléchargement des données brutes) et `MessageStockage` (D-62) rendus au-dessus des onglets, sur les six.
  5. `useHistoriqueQuotidien` écrit un point par jour local à l’ouverture et à chaque changement de collection (SC-020) ; `useAffichage` pose `data-animations="off"` sur `<html>` selon la clé `affichage`.
  6. `useDonneesPage` purge les `ignorees` (synchro `termine` avec `debut` > date de l’entrée, carte disparue, 30 jours) via `purger` de T-303, à l’ouverture et à chaque changement du statut (décision 1).
  7. Les 9 e2e existants passent, assertions inchangées ; `data-testid` conservés ; contenu actuel visible tel quel dans l’onglet où il a été rangé (Sauvegarde, Plafond, Étiquettes préexistantes, Wikipédia, Thèmes → Réglages ; Assistant, File de vente → Ventes ; Synchronisation (aperçu), Journal → Lots ; synchro auto → Synchro).
- **Tests attendus**
  - `tests/e2e/refonte-coquille.spec.ts` : ordre et rôles des onglets, clavier, hash, Précédent/Suivant, blocage au-dessus des onglets (AC1 à AC4), `scrollWidth ≤ clientWidth` aux 3 largeurs, captures.
  - SC-011 partiel : aucune requête Wikipédia hors vue liste (routes interceptées) dans le même fichier.
  - `tests/unit/purge-ignorees-page.test.ts` n’est pas créé : la purge est testée dans `ignorees.test.ts` (T-303) ; ici un cas e2e de purge suffit (AC6).
- **Brief de contexte**
  - *Pourquoi* : donner un emplacement à chaque contenu avant de le refondre (SC-012) en gardant la CI verte.
  - *État actuel* : `App.tsx` (403 lignes) charge tout (effets l. 87-157), affiche l’écran de blocage (l. 194-245) et empile les sections ; filtres/liste l. 346-396 ; `titresConsultes` = 200 premières cartes visibles. Après T-316, `ApercuLot` remplace `Synchronisation`.
  - *À faire* : découper selon le tableau de `plan.md` ; panneaux = contenu déplacé sans changement ; `allerA(page, 'lots')` dans `tests/e2e/extension.ts` navigue par hash ; adapter les 9 e2e.
  - *Contrats* : D-12 (onglets), D-62, D-17 ; composants `React.FC` ; hooks montés une fois au-dessus des onglets ; la file d’exécution vit dans le contexte module (pas de perte au changement d’onglet).
  - *Pièges* : le démontage du panneau ne doit pas perdre l’aperçu d’un lot ni l’assistant (états remontés) ; `creerPlanificateur` survit au démontage ; ne pas ajouter de requête.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-313 — Moteur : pause, sauts, reprise, erreur, pause de 30 min
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-302, T-303, T-316 · **Parallélisable** : [P] (V2)
- **SC couverts** : SC-004 (données), SC-005, SC-006 (saut), SC-014, SC-016, SC-017 (règle) · **Règles design** : D-30, D-33
- **Fichiers concernés** (liste fermée) :
  - `src/lib/file.ts`
  - `src/lib/reprise.ts` (créé)
  - `src/app/pilotageLots.ts`
  - `src/app/execution.ts` (publication de l’état v2 : écriture de `lots`, `pauseJusqua`, `erreur` ; ajout justifié, absent du tableau du plan)
  - `tests/unit/file-pause.test.ts`, `tests/unit/file-reprise.test.ts`, `tests/unit/reprise.test.ts`, `tests/unit/pilotage-lots.test.ts` (créés) ; `tests/unit/execution.test.ts` (seulement si l’état publié v2 l’exige, sans changer d’attente)
- **Critères d’acceptation**
  1. `file.ts` : `pause()`/`reprendre()` ; en pause, aucun nouveau départ (y compris créneaux réservés d’un lot parallèle) ; requêtes en vol terminées ; verrou et bail gardés ; au-delà de 15 min : arrêt `manuel` et bail libéré (H18).
  2. État v2 publié : `lots` (famille, total, traitées, sautées) ; contexte d’erreur (action, rang, lot, code, raison, autres échecs en vol) ; **actions restantes** après arrêt (action en erreur, ordres parallèles abandonnés, actions non parties) ; `demarrer` accepte une suite (`idLot` et compteurs conservés) ; `JournalFile.ouvrir(action, { rang, total, lot })`. Paramètres ajoutés facultatifs : `tests/unit/file.test.ts` passe **sans modification**.
  3. `reprise.ts` (horloge murale `Date.now` injectée) : `pauseJusqua` = +30 min après 401, 429, refus hors exemplaire (403 sur création ou suppression d’étiquette) ou 3 échecs, **et** après atteinte du seuil de refus par carte (décision 3) ; choix du panneau selon la table D-33 ; raison de désactivation « Reprise possible à HH:MM » ; « Réessayer » désactivé avec « Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action » si l’entrée de journal de l’action a `resultat: 'inconnu'` (décision 2).
  4. `pilotageLots.ts` : `lancerLot` (relit `pauseJusqua`, un seul point de passage ; bloque aussi `lancerSuppressionEtiquettes`), `reessayer`, `sauterAction` (journal « passée » cause `sautee`, aucun appel `transport`), `sauterLot` (une seule entrée de journal, les N − 1 autres comptées « sautées »), `ignorer` (écrit `ignorees` puis saute ; échec d’écriture = rien d’ignoré, message), `pause`, `reprendre`, `arreterTout` ; la reprise est un nouveau `demarrer` sur les restantes de la **même** exécution avec les conditions de lancement existantes (un seul onglet WikiMasters, verrou, bail, revérification, cadence, arrêts).
  5. Sauter ou ignorer une création d’étiquette retire des restantes les poses de cette étiquette, comptées « sautées » (décision 4).
  6. Les restantes ne vivent qu’en mémoire : après rechargement, la reprise est impossible (SC-017), le détail stocké reste lisible.
  7. Un test par chemin de contournement de la pause de 30 min : Réessayer, reprise après Sauter, Lancer, suppression d’étiquettes, autre onglet ; 409, 403 par carte, transport, résultat, écriture, vérification : Réessayer immédiat.
- **Tests attendus**
  - `tests/unit/file-pause.test.ts` (AC1, horloge injectée) · `tests/unit/file-reprise.test.ts` (AC2, AC4 transport simulé, aucun appel pour une sautée) · `tests/unit/reprise.test.ts` (AC3, AC7, `Date` injectée) · `tests/unit/pilotage-lots.test.ts` (AC4 à AC6). `tests/unit/file.test.ts` et `bail-lot.test.ts` inchangés et verts.
- **Brief de contexte**
  - *Pourquoi* : sans ce moteur, ni erreur par action, ni sauts, ni pause de lot (SC-004 à SC-006, SC-014, SC-016).
  - *État actuel* : `file.ts` ne connaît que `arreter()` ; cadence 0,2 s + gigue, 3 en vol, arrêts 401/403/429/409/3 échecs, refus par carte (`refusParCarte`), jamais de relance d’une requête au résultat inconnu ; horloge monotone `performance.now`. `pilotageLots.ts` (après T-316) porte le contexte, `lancerLot`, `sousBail`, `executerLot`, `lancerSuppressionEtiquettes`. `execution.ts` publie l’état dans `chrome.storage.local`.
  - *À faire* : voir AC. L’API de pilotage est livrée **entièrement** ici (T-307, T-311, T-317 s’y branchent sans la modifier) ; exports typés et documentés.
  - *Contrats* : cadre AGENTS.md (cadence, concurrence 3, 4 ordres en attente, arrêts, relance une par minute) inchangé ; aucun contrôle ne contourne la pause de 30 min ; `reseau.ts`, `jeton.ts`, `contrat/*` inchangés ; revue `security-reviewer` attentive.
  - *Pièges* : `pauseJusqua` est une heure **murale** (jamais l’horloge monotone) ; en parallèle un arrêt laisse jusqu’à 2 échecs en vol (compter `autresEchecsEnVol`) ; l’ordre « Lot X / Y » se découpe par appartenance (T-302) ; `file.ajouter` peut ajouter des étiquettes en fin de file.
  - *Vérifier* : `npx vitest run tests/unit/file.test.ts tests/unit/file-pause.test.ts tests/unit/file-reprise.test.ts tests/unit/reprise.test.ts tests/unit/pilotage-lots.test.ts tests/unit/bail-lot.test.ts && npm run check && npm run build`

---

## T-305 — Onglet Tableau de bord
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-301, T-304, T-315 · **Parallélisable** : [P] (V2)
- **SC couverts** : SC-001, SC-022, SC-027, SC-009 · **Règles design** : D-01, D-06, D-13, D-14, D-40, D-61
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletTableauDeBord.tsx`, `src/app/CarteKpi.tsx`, `src/app/BarreRepartition.tsx`, `src/app/BulleRepartition.tsx`, `src/app/SanteSynchro.tsx`
  - `tests/e2e/refonte-tableau-de-bord.spec.ts` (créé)
- **Critères d’acceptation**
  1. 4 cartes KPI (exemplaires, valeur estimée, places d’enchères, écarts) animées (`ChiffreAnime`), valeur finale dans le nom accessible dès le premier rendu, `aria-hidden` sur le compteur ; « — » jamais `NaN` ; collection vide : « Aucune carte » à la place de la barre.
  2. Barre de répartition 48 px : segments `button` avec `aria-label` complet, étiquette interne `ink` si largeur ≥ 96 px sinon retirée + `tabindex="-1"`, légende en boutons 44 px pour exactement ces segments ; zoom, autres segments `saturate(.45)`, bulle (exemplaires, part, valeur, 3 titres en texte), fermée par Échap (focus au segment), ouverte tant que le pointeur est sur segment ou bulle.
  3. Santé de la synchro (pastille D-40 + âge), état en cours et erreur (liens vers `#synchro`) ; `data-testid="resume"` conservé si l’e2e existant le vise.
  4. Colonnes KPI 1 / 2 / 4 aux 3 largeurs, aucun débordement horizontal, 2 thèmes.
- **Tests attendus**
  - `tests/e2e/refonte-tableau-de-bord.spec.ts` : AC1 à AC4, mouvement coupé (valeur finale directe), captures 3 × 2.
- **Brief de contexte**
  - *Pourquoi* : lisibilité en 5 secondes (G1).
  - *État actuel* : `OngletTableauDeBord.tsx` existe depuis T-304 avec le contenu `resume` déplacé ; calculs fournis par `tableauDeBord.ts` (T-301) ; primitives T-315.
  - *À faire* : composer le panneau avec `calculerTableauDeBord` mémorisé sur `collection.cartes`.
  - *Contrats* : D-06, D-13, D-14, D-18, D-61 ; aucune nouvelle couleur ; aucune vérification Wikipédia depuis ce panneau (SC-011).
  - *Pièges* : largeur rendue mesurée (ResizeObserver) pour D-14 ; Échap ne doit pas fermer autre chose ; titres jamais en `innerHTML`.
  - *Vérifier* : `npm run check && npm run build && npx playwright test tests/e2e/refonte-tableau-de-bord.spec.ts`

---

## T-308 — Onglet Collection
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-301, T-303, T-304, T-315 · **Parallélisable** : [P] (V2)
- **SC couverts** : SC-021, SC-020, SC-024, SC-011 (mention), SC-009 · **Règles design** : D-02, D-05, D-16, D-13
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletCollection.tsx`, `src/app/TableauCartes.tsx`, `src/app/CarteLigne.tsx` (existant, modifié), `src/app/AnalysesCollection.tsx`, `src/app/GraphiqueEvolution.tsx`
  - `tests/e2e/extension.spec.ts`, `tests/e2e/lecture-site.spec.ts` (sélecteurs seulement si la liste devient un tableau)
  - `tests/e2e/refonte-collection.spec.ts` (créé)
- **Critères d’acceptation**
  1. Liste en tableau (titre, rareté, quantité, statut, valeur) avec `EnTeteTriable` : cycle croissant → décroissant → aucun, `aria-sort`, tri stable, inconnues en dernier ; FLIP des seules lignes rendues, fondu au filtre ; sous 600 px cartes empilées avec `select` « Trier par » + bouton « Sens » (`aria-pressed`).
  2. 200 lignes au plus au premier affichage, « Afficher plus » ; la mention « titres des cartes affichées vérifiés » reste visible dans la vue liste et la vérification Wikipédia garde sa règle (SC-011).
  3. Analyses : doublons, à trier, défaussables, valeur par décision, 10 plus chères, 10 thèmes, chacune avec état vide écrit.
  4. Évolution sur 30 jours : colonnes `paper` sur piste `ink-2`, trous pour jours sans point, < 2 points : « Historique en cours de constitution (N jour) », tableau alternatif `sr-only`, valeur au survol et au focus.
  5. Édition d’une carte inchangée (même fonction `appliquerEdition`).
- **Tests attendus**
  - `tests/e2e/refonte-collection.spec.ts` : AC1 (ordre, `aria-sort`), AC2 (5 000 cartes fictives : 200 lignes), AC3, AC4, captures 3 × 2.
  - e2e existants : navigation/sélecteurs seulement.
- **Brief de contexte**
  - *Pourquoi* : tri lisible et analyses (SC-021, SC-024, SC-020).
  - *État actuel* : `OngletCollection.tsx` contient la liste de `App.tsx` (déplacée en T-304) ; `CarteLigne.tsx` rend une ligne éditable ; analyses de T-301, `ordreTableau.ts` et `useFlip` de T-315, historique de T-303.
  - *À faire* : tableau triable + analyses + graphique ; ne pas toucher au sélecteur de vue (T-312).
  - *Contrats* : D-16 ; calculs mémorisés ; titres en texte.
  - *Pièges* : le tri est d’affichage, jamais d’écriture ; ne pas déclencher de vérification pour des cartes non rendues.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-309 — Onglet Réglages
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-304, T-315 · **Parallélisable** : [P] (V2)
- **SC couverts** : SC-028, SC-026 (réglage) · **Règles design** : D-50, D-03, D-17
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletReglages.tsx`, `src/app/ReglageAnimations.tsx` (créé)
  - `tests/e2e/sauvegarde.spec.ts`, `tests/e2e/plafond-defausse.spec.ts` (ouverture de la section seulement)
  - `tests/e2e/refonte-reglages.spec.ts` (créé)
- **Critères d’acceptation**
  1. Six sections (Sauvegarde, Plafond de défausse, Étiquettes préexistantes, Wikipédia, Thèmes, Animations) fermées par défaut via `SectionRepliable`, titre + résumé (« Plafond : 5 », « Animations : activées »), contenu replié hors tabulation.
  2. Réglage Animations : interrupteur écrivant la clé `affichage` ; `data-animations="off"` posé sur `<html>` ; mouvement coupé sans perte de fonction.
  3. L’interrupteur de synchro auto et « Relancer la synchro » ne sont **pas** dans Réglages (restent dans Synchro).
  4. `data-testid` `plafond-defausse`, `apercu-sauvegarde` conservés ; e2e existants verts après ouverture des sections.
- **Tests attendus**
  - `tests/e2e/refonte-reglages.spec.ts` : AC1 (clavier, `aria-expanded`), AC2 (`emulateMedia` + réglage), captures 3 × 2.
- **Brief de contexte**
  - *Pourquoi* : alléger la page, réglages rares repliés (SC-028).
  - *État actuel* : `OngletReglages.tsx` (T-304) empile `Sauvegarde`, `PlafondDefausse`, `EtiquettesPreexistantes`, `VerificationWikipedia` (mention seulement, pas de montage de la file), thèmes.
  - *À faire* : envelopper chaque bloc dans `SectionRepliable`, ajouter `ReglageAnimations` via `useAffichage`.
  - *Contrats* : D-50 ; ne pas modifier les composants enfants ; la suppression d’étiquettes garde ses deux écrans de confirmation.
  - *Pièges* : un e2e qui cherche un contrôle replié échoue : ouvrir la section dans l’e2e (navigation) ; si un autre e2e existant est touché, le signaler.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-318 — Onglet Ventes
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-301, T-304, T-315 · **Parallélisable** : [P] (V2)
- **SC couverts** : SC-024 (File de vente), SC-009 · **Règles design** : D-02, D-05, D-16
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletVentes.tsx`, `src/app/FileVente.tsx`, `src/app/PlacesEncheres.tsx` (créé), `src/app/HeuresFortes.tsx` (créé)
  - `tests/e2e/assistant.spec.ts` (sélecteurs seulement)
  - `tests/e2e/refonte-ventes.spec.ts` (créé)
- **Critères d’acceptation**
  1. Places d’enchères « occupées / max » via `placesEncheres` ; file de vente en tableau triable (cycle, `aria-sort`, FLIP) ; `data-testid="file-vente"` conservé.
  2. Heures fortes (`affluence.ts`) présentées lisiblement ; assistant de tri déplacé **tel quel** (contenu inchangé).
  3. Tableaux en cartes empilées sous 600 px avec `select` + « Sens ».
- **Tests attendus**
  - `tests/e2e/refonte-ventes.spec.ts` : AC1 à AC3, captures ; `assistant.spec.ts` vert.
- **Brief de contexte**
  - *Pourquoi* : regrouper la vente (SC-024).
  - *État actuel* : `FileVente.tsx` utilise `CONFIG_PRIX.maxVentesSimultanees` seul ; `AssistantTri.tsx` existe ; `OngletVentes.tsx` (T-304) contient le contenu déplacé.
  - *À faire* : tableau triable, `PlacesEncheres`, `HeuresFortes`.
  - *Contrats* : « `FileVente` alignée sur `placesEncheres` » est hors périmètre (long terme du plan) : garder ses calculs, seulement l’affichage des places utilise `placesEncheres`.
  - *Pièges* : l’assistant ne doit pas être modifié ; le joueur indique lui-même ce qu’il met aux enchères (aucune action sur le site).
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-306 — Onglet Synchro
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-302, T-304, T-314, T-315 · **Parallélisable** : [P] (V3)
- **SC couverts** : SC-002, SC-003, SC-028 (interrupteur), SC-009 · **Règles design** : D-02, D-10, D-11, D-20, D-40
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletSynchro.tsx`, `src/app/ProgressionSynchro.tsx`, `src/app/ListeTaches.tsx`, `src/app/FraicheurPrix.tsx` (créés)
  - `src/app/SynchroAuto.tsx` (placement seulement)
  - `tests/e2e/synchro-auto.spec.ts`, `tests/e2e/synchro-auto-ui.spec.ts` (sélecteurs seulement)
  - `tests/e2e/refonte-synchro.spec.ts` (créé)
- **Critères d’acceptation**
  1. Barre globale « Étape i / k · P % » + barre d’étape, `role="progressbar"`, étapes « ✓ / ▶ / ○ / ✕ » (symbole + mot), zone `aria-live="polite"` annonçant au plus toutes les 2 s ; affichage suit le stockage à 1 s.
  2. Listes En cours / À venir / Terminées (20) + lien vers l’historique ; sans activité « Aucune activité en cours » + Terminées.
  3. Interrupteur de synchro auto et « Relancer la synchro » avec leurs conditions et avertissements actuels (`data-testid` `synchro-auto`, `etat-synchro-auto`), inchangés.
  4. Fraîcheur des prix, durée restante H4 ; barre indéterminée si `prixPrevus` inconnu.
- **Tests attendus**
  - `tests/e2e/refonte-synchro.spec.ts` : statut fictif écrit dans le stockage (étapes, 100 %, indéterminée), AC1 à AC4, clavier, captures 3 × 2.
- **Brief de contexte**
  - *Pourquoi* : détail complet de la synchro avec barre de progression (G2).
  - *État actuel* : `OngletSynchro.tsx` (T-304) héberge `SynchroAuto` ; `progression.ts` (T-302) fournit modèles et listes ; le statut v2 (T-303/T-314) fournit étape et compteurs.
  - *À faire* : composer le panneau ; l’emplacement du panneau d’erreur, des ignorées et de l’historique est réservé pour T-307 (ne pas l’implémenter ici).
  - *Contrats* : D-10, D-11, D-20 ; règle de relance inchangée ; aucune modification de logique de `SynchroAuto`.
  - *Pièges* : v1 migrée (étape `null`) : barre indéterminée sans erreur ; annonces `aria-live` limitées.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-311 — Onglet Lots
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-304, T-313, T-315 · **Parallélisable** : [P] (V3)
- **SC couverts** : SC-015, SC-016 (Lancer), SC-006 (aperçu), SC-024 (Lots) · **Règles design** : D-09, D-16, D-32
- **Fichiers concernés** (liste fermée) :
  - `src/app/OngletLots.tsx`, `src/app/ApercuLot.tsx`, `src/app/apercuLot.ts`, `src/app/TableauLots.tsx` (créé), `src/app/ListeEcarts.tsx` (créé)
  - `tests/e2e/etiquettes.spec.ts`, `tests/e2e/synchro-ecriture.spec.ts` (sélecteurs seulement)
  - `tests/unit/synchronisation.test.ts` (ajouts de cas pour `raisonDesactivation` avec pause, sans changer d’attente existante)
  - `tests/e2e/refonte-lots.spec.ts` (créé)
- **Critères d’acceptation**
  1. Tableau des lots cochables (case 44 px, Famille, Actions, Ordre), tous cochés par défaut ; colonnes triables sauf « Ordre » qui garde l’ordre de `lot.ts` ; le tri n’affecte que l’affichage ; sous 600 px, cartes empilées et « Lancer » collant.
  2. Durée estimée « environ N min » des seuls lots cochés (H4) ; avertissements existants (visibilité des étiquettes, défausse définitive, valeurs > 5) en encadrés `border-vendre` ⚠ ; écarts avec le site.
  3. « Lancer » n’envoie que les lots cochés ; désactivé aucun lot coché, pause de 30 min (« Reprise possible à HH:MM »), ou conditions existantes de `raisonDesactivation` inchangées ; raison écrite liée par `aria-describedby`.
  4. Actions ignorées filtrées de l’aperçu via `filtrerLotIgnore` ; une création ignorée écarte les poses (raison « création ignorée », décision 4) ; compteur « N actions écartées » dans le résumé.
- **Tests attendus**
  - `tests/e2e/refonte-lots.spec.ts` : AC1 à AC4 (stockage fictif avec `pauseJusqua` et `ignorees`), captures 3 × 2.
  - `tests/unit/synchronisation.test.ts` : cas pause (AC3).
- **Brief de contexte**
  - *Pourquoi* : lancer par lots choisis (SC-015).
  - *État actuel* : `ApercuLot.tsx` / `apercuLot.ts` (T-316) contiennent aperçu, `raisonDesactivation`, `preparerLot` ; `pilotageLots.ts` (T-313) fournit `lancerLot` (lots cochés) et la pause.
  - *À faire* : tableau des lots, durée, filtrage des ignorées, raison de pause ; ne pas recréer la logique d’envoi.
  - *Contrats* : D-09, D-16 ; textes de désactivation existants intacts ; revérification avant envoi inchangée.
  - *Pièges* : l’ordre d’application = `lot.ts` ; le panneau d’erreur n’est pas ici (T-307).
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-317 — Bandeau d’activité
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-302, T-304, T-313 · **Parallélisable** : [P] (V3)
- **SC couverts** : SC-013, SC-014 (commandes), SC-002 (barres du bandeau) · **Règles design** : D-03, D-21, D-10, D-11
- **Fichiers concernés** (liste fermée) :
  - `src/app/BandeauActivite.tsx`, `src/app/LigneActivite.tsx`, `src/app/useActiviteSynchro.ts` (créés)
  - `src/app/App.tsx` (montage du bandeau au-dessus des panneaux uniquement)
  - `tests/e2e/refonte-bandeau.spec.ts` (créé)
- **Critères d’acceptation**
  1. Bandeau `role="region"` `aria-label="Activité en cours"` non rendu sans activité (ni hauteur ni région vide) ; lignes Synchro (statut `en-cours`, bail non expiré), Lots (exécution `en-cours` ou en pause), erreur en attente (✕, « Voir le détail » → `#synchro`).
  2. Replié : nom, barre 8 px, %, résumé ; déplié : barre par étape ou lot, Pause / Reprendre (lots seulement), Arrêter ; `aria-expanded`/`aria-controls` sur un bouton 44 px ; état déplié non stocké.
  3. Autre onglet du navigateur que celui qui exécute : lecture seule « en cours dans un autre onglet », sans boutons.
  4. Pause/Reprendre/Arrêter appellent `pause`, `reprendre`, `arreterTout` de `pilotageLots.ts` (T-313).
- **Tests attendus**
  - `tests/e2e/refonte-bandeau.spec.ts` : AC1 à AC4 sur les 6 onglets, captures 3 × 2.
- **Brief de contexte**
  - *Pourquoi* : visibilité de l’activité sur tous les onglets (SC-013).
  - *État actuel* : `App.tsx` (T-304) rend panneaux et messages ; `useExecution` (T-316) abonne l’exécution ; `progression.ts` (T-302).
  - *À faire* : composants et hook ; montage dans `App.tsx` sans modifier autre chose.
  - *Contrats* : D-21 (région distincte de la zone `aria-live`), H9 (Pause pour les lots seulement).
  - *Pièges* : synchro avec bail expiré = pas de ligne ; ne pas écrire de pause pour la synchro.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-312 — Tableau de tri
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-308 · **Parallélisable** : [P] (V3)
- **SC couverts** : SC-023, SC-026 (glisser), SC-008 · **Règles design** : D-04, D-13, D-15, D-17
- **Fichiers concernés** (liste fermée) :
  - `src/lib/colonnesTri.ts` (créé)
  - `src/app/TableauTri.tsx`, `src/app/ColonneTri.tsx`, `src/app/CarteTri.tsx`, `src/app/useGlisser.ts` (créés)
  - `src/app/OngletCollection.tsx` (sélecteur de vue seulement)
  - `tests/unit/colonnes-tri.test.ts`, `tests/e2e/refonte-tableau-tri.spec.ts` (créés)
- **Critères d’acceptation**
  1. Sélecteur « Liste / Tableau de tri » (`aria-pressed`, 44 px) ; 5 colonnes Garder, Échanger, Vendre, Défausser, À trier, nombre dans le titre ; cartes `en-vente` absentes (« N en vente, non déplaçables »).
  2. Déposer (Pointer Events, tactile) ou ← → (44 px, `aria-label` « Déplacer « titre » vers Échanger », `aria-disabled` en bout) applique `statut` + `decidePar: 'moi'` par `appliquerEdition` sur toute la carte, sans requête ; focus suit la carte ; `aria-live` annonce « « titre » déplacée vers Vendre » ; Échap annule un glisser.
  3. 50 cartes par colonne puis « Afficher plus » ; la recherche filtre aussi ; aucune vérification Wikipédia (SC-011) ; mouvement coupé : pose sans trajet.
  4. Mise en page 375 px colonnes empilées repliables, 768 px 2 colonnes, 1280 px 5 colonnes.
- **Tests attendus**
  - `tests/unit/colonnes-tri.test.ts` : colonne voisine, bouts de rangée, exclusion `en-vente`, édition via `appliquerEdition` (AC1, AC2).
  - `tests/e2e/refonte-tableau-tri.spec.ts` : clavier, pointeur, Échap, 5 000 cartes, `emulateMedia` (AC2 à AC4), captures.
- **Brief de contexte**
  - *Pourquoi* : trier par glisser-déposer (SC-023).
  - *État actuel* : `OngletCollection.tsx` (T-308) porte la liste ; `appliquerEdition` est dans `src/lib/collection.ts` (non modifié).
  - *À faire* : voir AC ; Pointer Events avec capture, aucune bibliothèque.
  - *Contrats* : D-15 ; flèches = voie principale ; ordre intra-colonne non stocké (H12).
  - *Pièges* : une carte à plusieurs exemplaires bouge en entier ; ne pas modifier `collection.ts`.
  - *Vérifier* : `npm run check && npm run build && npx playwright test tests/e2e/refonte-tableau-tri.spec.ts`

---

## T-307 — Panneau d’erreur, ignorées, historique
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-306, T-313 · **Parallélisable** : — (V4)
- **SC couverts** : SC-004, SC-005, SC-006, SC-007, SC-008 (focus), SC-016, SC-017, SC-018 · **Règles design** : D-30, D-31, D-32, D-33, D-12 (pastille), D-20
- **Fichiers concernés** (liste fermée) :
  - `src/app/PanneauErreur.tsx`, `src/app/TableIgnorees.tsx`, `src/app/FiltresHistorique.tsx` (créés)
  - `src/app/Journal.tsx`, `src/app/Onglets.tsx` (pastille), `src/app/OngletSynchro.tsx`, `src/app/ZoneExecution.tsx` (supprimé)
  - `tests/unit/journal-ui.test.ts` (ajouts uniquement), `tests/e2e/synchro-ecriture.spec.ts`, `tests/e2e/etiquettes.spec.ts` (remplacement du sélecteur `zone-execution` seulement)
  - `tests/e2e/refonte-erreur.spec.ts` (créé)
- **Critères d’acceptation**
  1. `role="alert"` avec Action, Carte, Lot, Rang, Réponse du site (code + libellé fixe), Cause probable, Heure, Déjà fait, autres échecs en vol, Reprise possible ; champs fermés seulement (SC-007) ; arrêt de synchro : étape, page, code, heure, sans Sauter ni Ignorer.
  2. Cinq choix selon la table D-33 (Réessayer principal, Sauter l’action, Sauter le lot (N), Ignorer, Arrêter tout) ; désactivés en `aria-disabled` + raison liée ; pause de 30 min : « Reprise possible à HH:MM » ; résultat inconnu : « Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action » (décision 2) ; seuil de refus par carte traité en pause (décision 3).
  3. Après rechargement : détail seul, « Préparer un nouveau lot » (principal) et « Fermer » (SC-017).
  4. Focus sur le titre du panneau seulement si l’onglet Synchro est affiché ; sinon pastille d’erreur (✕ + `sr-only` « erreur ») sur l’onglet Synchro.
  5. Ignorées (section repliable « Ignorées (N) », tableau triable, Reprendre `aria-label` « Reprendre « action » pour « carte » », état vide « Aucune action ignorée ») ; échec d’écriture : message `role="alert"`, rien d’ignoré.
  6. Historique filtrable (type, résultat, carte par texte, exécution, en ET), libellés H5, « Aucune action ne correspond ».
  7. `ZoneExecution.tsx` supprimé ; aucun test n’est affaibli.
- **Tests attendus**
  - `tests/e2e/refonte-erreur.spec.ts` : état d’exécution v2 fictif, AC1 à AC6, aucun secret affiché (SC-007), clavier, captures 3 × 2.
  - `tests/unit/journal-ui.test.ts` : libellés filtres.
- **Brief de contexte**
  - *Pourquoi* : voir sur quelle action une erreur s’est produite et choisir (G3).
  - *État actuel* : `ZoneExecution.tsx` (T-316) affiche l’arrêt ; `Journal.tsx` liste les entrées ; `OngletSynchro.tsx` (T-306) a un emplacement réservé ; l’API `pilotageLots.ts` (T-313) est complète.
  - *À faire* : composants et câblage ; aucune logique de moteur nouvelle.
  - *Contrats* : D-30 à D-33 ; textes du site jamais affichés ; jamais d’identifiant d’exemplaire.
  - *Pièges* : un bouton désactivé reste focusable ; `data-testid="zone-execution"` disparaît ici, mettre à jour les e2e correspondants au même sens.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-310 — Tests transverses et captures finales
- **Couche** : tests · **Agent** : dev-test
- **Dépend de** : T-305, T-306, T-307, T-308, T-309, T-311, T-312, T-317, T-318 · **Parallélisable** : — (V5)
- **SC couverts** : SC-007 (affichage), SC-008, SC-009, SC-010, SC-011, SC-026 · **Règles design** : D-18, D-19
- **Fichiers concernés** (liste fermée) :
  - `tests/e2e/refonte-transverse.spec.ts`, `tests/e2e/refonte-captures.spec.ts` (créés)
  - `tests/e2e/extension.ts` (aides ajoutées seulement)
- **Critères d’acceptation**
  1. SC-011 : toutes routes interceptées, parcours de tous les onglets, bandeau déplié, tri, glisser, sauter, ignorer, reprendre : aucune requête vers WikiMasters, Supabase ou autre hôte ; Wikipédia/Wikidata seulement pour la vue liste.
  2. SC-008 clavier sur les 6 onglets ; SC-009 `scrollWidth ≤ clientWidth` 3 largeurs × 2 thèmes × 6 onglets ; SC-026 `emulateMedia('reduce')` et réglage coupé ; 5 000 cartes fictives (200 lignes, 50 par colonne).
  3. SC-007 côté affichage : aucun jeton/cookie/identifiant d’exemplaire dans le DOM avec un stockage fictif piégé.
  4. SC-010 : les 9 e2e existants et tous les tests unitaires passent ; captures finales jointes.
- **Tests attendus** : les deux fichiers ci-dessus ; `npm run test:e2e` complet vert.
- **Brief de contexte**
  - *Pourquoi* : vérification globale de la refonte.
  - *État actuel* : chaque onglet a son e2e `refonte-*.spec.ts` ; `extension.ts` fournit `allerA`.
  - *À faire* : tests seulement ; si un défaut est trouvé, le signaler à l’orchestrateur (ne pas corriger le code d’une autre tâche).
  - *Contrats* : données fictives ; aucun test ne contacte le vrai site.
  - *Pièges* : durée de la suite (5 000 cartes) ; fixer les horloges ; captures stockées hors `captures-site/`.
  - *Vérifier* : `npm run check && npm run build && npm run test:e2e`

---

## T-319 — Documentation
- **Couche** : docs · **Agent** : dev-core
- **Dépend de** : T-310 · **Parallélisable** : — (V5, après T-310)
- **SC couverts** : — · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `AGENTS.md` (§ Architecture seulement)
  - `README.md`
- **Critères d’acceptation**
  1. § Architecture décrit les six onglets, les nouveaux modules (`tableauDeBord`, `analyses`, `familles`, `progression`, `ignorees`, `historique`, `affichage`, `ordreTableau`, `colonnesTri`, `reprise`, `pilotageLots`, `apercuLot`), les clés v2 et nouvelles (`journal` v2, `execution` v2, `statutSynchro` v2 avec `debut`, `ignorees`, `historique`, `affichage`) et les 4 décisions par défaut.
  2. Aucune règle du cadre WikiMasters modifiée ; `README.md` mis à jour (navigation, commandes inchangées).
- **Tests attendus** : `npm run check` vert (lint des textes éventuel) ; relecture par `reviewer`.
- **Brief de contexte**
  - *Pourquoi* : garder `AGENTS.md` source de vérité.
  - *État actuel* : § Architecture décrit encore la page unique et `Synchronisation`.
  - *À faire* : réécrire uniquement les lignes concernées ; mentionner que le service worker, `reseau.ts`, `jeton.ts`, `contrat/*`, `config/*`, `sauvegarde.ts` sont inchangés.
  - *Contrats* : français, typographie française ; ne pas toucher aux autres sections d’`AGENTS.md`.
  - *Pièges* : ne pas modifier le cadre d’usage.
  - *Vérifier* : `npm run check && npm run build`

---

## Contrôles
- **Couverture SC** : SC-001 T-301/T-305 · SC-002 T-302/T-314/T-306/T-317 · SC-003 T-302/T-306 · SC-004 T-313/T-307 · SC-005 T-313/T-307 · SC-006 T-303/T-304/T-313/T-307/T-311 · SC-007 T-303/T-307/T-310 · SC-008 T-304/T-307/T-312/T-310 · SC-009 T-304/T-305/T-306/T-308/T-318/T-310 · SC-010 T-316/T-304/T-310 · SC-011 T-304/T-308/T-310 · SC-012 T-304 · SC-013 T-317 · SC-014 T-313/T-317 · SC-015 T-311 · SC-016 T-313/T-307/T-311 · SC-017 T-313/T-307 · SC-018 T-303/T-307 · SC-019 T-303/T-314 · SC-020 T-303/T-304/T-308 · SC-021 T-301/T-308 · SC-022 T-301/T-315/T-305 · SC-023 T-312 · SC-024 T-315/T-308/T-311/T-318 · SC-025 T-315 · SC-026 T-303/T-309/T-312/T-310 · SC-027 T-315/T-305 · SC-028 T-306/T-309. Les 28 sont couverts.
- **Fichiers disjoints par vague** : V0 (modules lib distincts ; `App.tsx` seulement T-316 ; `stockage.test.ts` seulement T-303) · V1 (T-302 : `familles/progression` ; T-314 : content script + `ordonnanceur.ts` ; T-304 : `App.tsx`, onglets, 9 e2e existants) · V2 (T-313 : `file.ts`, `reprise.ts`, `pilotageLots.ts`, `execution.ts` ; chaque onglet dans son fichier ; e2e existants répartis : T-308 `extension`/`lecture-site`, T-309 `sauvegarde`/`plafond-defausse`, T-318 `assistant`) · V3 (T-306 `synchro-auto*.spec`, T-311 `etiquettes`/`synchro-ecriture` + `apercuLot.ts`, T-317 `App.tsx` montage, T-312 `OngletCollection.tsx` sélecteur ; `App.tsx` n’est modifié que par T-317 dans cette vague) · V4 : T-307 seule · V5 séquentiel. `tokens.css` : T-315 seule, `collection.ts`, `manifest.json`, `package.json` : aucune.
- **Acyclicité** : voir tableau ; aucune dépendance vers une vague ultérieure.
