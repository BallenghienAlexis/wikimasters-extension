# Retouches — refonte-ihm

## À reprendre

- **T-316 (PR #111)** : `src/lib/reseau.ts:7` cite encore `Synchronisation.tsx` dans un commentaire (fichier hors liste de T-316) ; remplacer par `pilotageLots.ts` (tâche T-9xx retouches).
- **T-303 (PR #112)** : `src/lib/ignorees.ts:72` et `:89` : une enchère ignorée est reconnue par `parametre = String(prix)` ; si le prix change avant la prochaine synchro, l’action réapparaît dans le lot. À trancher : ignorer par `(type, idCarte)` sans le prix, ou documenter que l’ignorée ne vaut que pour ce prix (effet limité : aperçu et « Lancer » restent nécessaires).
- **T-303 (PR #112)** : `src/lib/stockage.ts:331` et `:343` : `chargerIgnorees` et `chargerHistorique` renvoient `[]` pour une version inconnue ; le premier `enregistrer*` (T-313, T-308) écraserait la valeur illisible. Exposer un état « illisible » ou refuser l’écriture (à traiter dans T-313 ou T-9xx).
- **T-303 (PR #112)** : `src/lib/ignorees.ts:66` : utiliser `ID_CARTE_ETIQUETTES` (`actions.ts:71`) au lieu de `'etiquettes'` en dur.
- **T-303 (PR #112)** : `src/lib/journal.ts:178` : `entreeValide` accepte des formes 9 ou 13 clés quelle que soit l’enveloppe ; fixer ce choix par un test.
- **T-303 (PR #112)** : `src/lib/statutSynchro.ts:70` : rejeter `prixFaits > prixPrevus` quand les deux sont des nombres.
- **T-302 (PR #115)** : `src/lib/progression.ts:49-52` : le texte de la barre d’exécution est « N / M · P % » ; SC-002 demande « N / M actions · P % » (ajouter « actions » et mettre le test à jour). `progression.ts:69-78` : `barreEtape` n’accepte pas de `precedent` (barre d’étape non monotone si `pages` ou `prixPrevus` augmentent). `tests/unit/progression.test.ts:198` : `.reverse().reverse()` inutile. SC-013 : aucun `resumeActivite` (T-317 compose le résumé).
- **T-315 (PR #113)** : `src/app/ChiffreAnime.tsx:20` : réactiver les animations après un changement de valeur fait repartir le compteur d’une ancienne valeur ; mettre `dernier.current = valeur` dans la branche sans mouvement.
- **T-315 (PR #113)** : `ChiffreAnime` — voir verdict du reviewer sur l’espace insécable des milliers.

## À reprendre (suite, vagues 2 à 5)

- **T-304 (PR #118)** : `src/app/MessageStockage.tsx:8` : les échecs d’écriture restent en `<p role="status">` ; D-62 demande un encadré `role="alert"` (bordure `defausser`, ✕, téléchargement). Séparer l’échec du message d’état et adapter les sélecteurs `getByRole('alert')` stricts (T-307).
- **T-304 (PR #118)** : `src/app/OngletVentes.tsx:31` : l’état interne d’`AssistantTri` (étape, thèmes cochés, ami en saisie) est perdu au changement d’onglet ; remonter dans `App` ou un état de module (T-318).
- **T-304 (PR #118)** : `tests/e2e/etiquettes.spec.ts:218` : le test « 5 000 cartes < 500 ms » a mesuré 619 ms une fois sous charge ; si la CI le voit échouer, escalader plutôt que relever le seuil.

## T-313 (PR #119) — à reprendre
- src/lib/file.ts:~370 : après `sortirDePause` (ordre parallèle, journal déjà ouvert), reboucler sur `attendrePause()` tant qu'une pause est demandée (+ test). Mineur, ergonomie.
- Décision : `stockage.ts` (refus d'écraser `ignorees` illisible) et `tests/unit/synchronisation.test.ts` (typage `EtatFile`) autorisés hors liste pour T-313 ; `chargerHistorique` illisible reste à T-308.
- Process : committer les tests de correction avant le correctif aux prochaines itérations.

## T-318 (PR #120) — à reprendre
- src/app/FileVente.tsx:48 : `placesEncheres` reçoit `ventesSite: null` → places possiblement différentes du Tableau de bord ; exposer `ventesSiteLues` (useExecution.ts:23) à OngletVentes → FileVente (hors liste T-318). 
- src/app/FileVente.tsx:67-72 : titre h2 « N en cours sur max » en doublon de PlacesEncheres ; le faire dériver des mêmes `places` (garder le texte attendu par assistant.spec.ts:60).
- tests/e2e/assistant.spec.ts:61 : assertion « ligne contient 100 » moins précise ; cibler la cellule Valeur.
- src/app/FileVente.tsx:162 : HeuresFortes affichée aussi sans vente à lancer (cohérent D-02), à mentionner.

## T-305 (PR #122) — décisions / à reprendre
- Décision : OngletTableauDeBord lit lui-même collection/préférences/état de synchro (App.tsx hors liste) ; départ des KPI à 0 pendant le chargement (aria-busy) accepté.
- À reprendre : passer `donnees` par App.tsx/useDonneesPage au lieu des lectures dupliquées (retouche T-9xx).
- À reprendre : Échap depuis un bouton de légende laisse le focus sur ce bouton (acceptable, à documenter dans design.md).

## T-309 (PR #121) — à reprendre
- src/app/OngletReglages.tsx:24 : `useAffichage()` monté deux fois (aussi App.tsx:28) → lire via ContexteAffichage ou prop.
- src/app/OngletReglages.tsx:76 : `enregistrerAffichage({ version: 1, … })` version en dur → `{ ...affichage, animations }` / AFFICHAGE_DEFAUT.
- tests/e2e/refonte-reglages.spec.ts:112-113 : ajouter une assertion après le retour sur Réglages.
- Capture reglages-replie-light-desktop.png : soulignement de l'onglet actif sous « Collection » alors que « Réglages » est actif → vérifier l'indicateur d'onglet (T-304/T-310), probablement un instant de transition.
- T-305 (PR #122) détail, à reprendre (T-9xx) :
  1. OngletTableauDeBord.tsx:38-43 [prioritaire] : synchro coupée sans arrêt → pastille « À jour » contradictoire ; renvoyer 'arretee' si !activee + e2e syncAuto=false.
  2. OngletTableauDeBord.tsx:39,46-70 : réutiliser `synchroEnCours` (SynchroAuto.tsx:52) et une seule lecture du statut.
  3. OngletTableauDeBord.tsx:114 : `accorder` + formatage fr-FR pour « N exemplaires ».
  4. BarreRepartition.tsx:96-106 : Échap sur document sans stopPropagation/test de cible.
  5. BarreRepartition.tsx:100 : écart D-06 (focus reste sur le bouton de légende) à consigner dans design.md.
  6. BarreRepartition.tsx:121 : règle 96 px sur largeur théorique, mesurer la largeur rendue.
  7. BarreRepartition.tsx:34 : renommer FONDS_LEGENDE → CONTOURS_LEGENDE.

## T-308 (PR #123) — décisions / à reprendre
- Décisions : écarts hors liste acceptés (assistant.spec.ts sélecteurs ; useHistoriqueQuotidien.ts n'écrit plus de point si collection vide).
- À reprendre : src/lib/stockage.ts:343 `chargerHistorique` renvoie [] pour une version illisible puis écrasement au prochain enregistrement → exposer un état « illisible » / refuser l'écriture (T-9xx).
- À reprendre : GraphiqueEvolution colonnes `div tabindex=0 role=img` (pas des boutons 44 px) ; fondu du filtre via Web Animations car tokens.css hors liste → tokeniser.
- T-308 (PR #123) détail, à reprendre (T-9xx) :
  1. GraphiqueEvolution.tsx:32,38,77 : maximum, seuil « <2 points » et tableau sr-only sur tous les points stockés, pas la fenêtre 30 jours → utiliser `serie` filtrée + e2e avec un point >30 jours.
  2. tests/e2e/refonte-collection.spec.ts:142-167 : le test « seuls les titres rendus » ne distingue pas une implémentation fautive ; vérifier la file/cache `wikipedia` (T-310).
  3. TableauCartes.tsx:69 : fondu de tout le tbody au filtre au lieu des seules lignes sortantes (D-16).
  4. AnalysesCollection.tsx:76,90 et GraphiqueEvolution.tsx:43 : pluriel figé (« 1 exemplaires ») et espace avant « : » non insécable.
- CI : etiquettes.spec.ts:212 (perf 5 000 cartes < 500 ms) échoue par intermittence (561 ms sur #123, 601 ms en local sur #120) → rendre le seuil robuste (T-310/T-9xx) ; ne pas désactiver.

## T-311 (PR #124) — à reprendre
- ListeActionsLot.tsx : doublon « Durée estimée : N min » avec `duree-lots` (« environ N min ») ; fichier hors liste T-311 → retirer.
- PanneauApercuLot.tsx : encadré « visibles des autres joueurs » (contrat de test) coexiste avec l'ancien `avertissement-visibilite` → fusionner.
- Décision : test refonte-lots.spec.ts:257 corrigé (`click({force:true}`) ; captures locales.
- T-311 (PR #124) détail : TableauLots.tsx:141,143 et PanneauApercuLot.tsx:364,401 : espace ordinaire avant « : » → insécable ({NB}). PanneauApercuLot.tsx:227 : places d'enchères comptées sur tous les lots filtrés même si « Enchères » décoché → compter sur `actionsCochees` (affichage « Cartes non incluses » seulement).

## T-312 (PR #127) — décisions / à reprendre
- Décisions : bordure `muted` des cartes (D-18 règle 2 vs D-15 `line`) à préciser dans design.md ; contour `:focus` des flèches accepté.
- src/lib/colonnesTri.ts:37 : typer `deplacerCarte` en `ColonneTri` et ignorer une source `en-vente`.
- tests/e2e/refonte-tableau-tri.spec.ts : ajouter un titre hostile (`<img src=x onerror=…>`) vérifié en texte littéral.
- useGlisser.ts : un glisser accidentel vers « Défausser » pose `decidePar: 'moi'` ; à réévaluer (annulation rapide ?) si le glisser devient la voie principale.

## T-312 (reviewer, #127) — à reprendre
1. src/lib/colonnesTri.ts:37-38 : deplacerCarte n'efface pas `ami` (la liste écrit ami:null, CarteLigne.tsx:97). À aligner + adapter colonnes-tri.test.ts. (prioritaire)
2. src/app/useGlisser.ts:23,87 / ColonneTri.tsx:76 : carte glissée rognée par overflow:hidden de .wm-repli-contenu ; ignorer la carte dans colonneSous (ou pointer-events:none) et lever le rognage pendant le glisser. (prioritaire)
3. src/app/CarteTri.tsx:54 : touch-pan-y annule le glisser tactile vertical ; appui long ou documenter la limite.
4. tests/e2e/refonte-tableau-tri.spec.ts:245-259 : SC-026 ne voit pas l'animation FLIP (getAnimations) ni le réglage Animations coupé.
5. tests/e2e/refonte-tableau-tri.spec.ts:294-302 : test Tab ne fait que focus() ; parcourir au Tab et vérifier le halo.
6. tests/e2e/refonte-tableau-tri.spec.ts:305-338 : SC-009 un seul thème ; couvrir en T-310.

## T-306 (reviewer, #125) — à reprendre
1. refonte-synchro.spec.ts:450 : test statut périmé sans assertion « Arrêtée » (toContainText).
2. refonte-synchro.spec.ts : pas d'e2e « étape en attente sans barre » (ProgressionSynchro.tsx:94).
3. refonte-synchro.spec.ts:491-493 : annonce intermédiaire <1,7 s fragile en CI lente → page.clock.
4. Hors diff : npm test tente 18 connexions vers fr.wikipedia.org (un test unitaire appelle le réseau) → à examiner.

## T-317 (reviewer, #126) — mineurs 3-9 traités par le dev (voir PR) ; vérifier à la re-revue.

## T-312 fix CI (5c7aa3c)
- verifierWikipedia.ts (hors liste T-312) : annuler() du planificateur abort désormais le titre en cours (bug : requête Wikidata après bascule en vue tri). Pas de test unitaire dédié à l'abort → à ajouter (T-9xx).

## T-317 (#126) — écarts consignés (décision orchestrateur : retouches)
5. LigneActivite.tsx:97 : Pause/Arrêter en ligne à xl (design.md § Responsive) non fait : contredit le test « aucun bouton Pause » ligne repliée (viewport 1280 = xl). À trancher en T-9xx avec adaptation du test.
6. BandeauActivite.tsx:79 : pas de fondu de sortie (D-21).
8. useActiviteSynchro.ts:66 : exécution orpheline (enCours && !local) affiche des commandes ; refonte-bandeau.spec.ts:151 l'exige aujourd'hui ; lecture seule à envisager.
3. Symbole/mot d'état : « Suspendu » au lieu de « En pause » (collision de nom avec le bouton Pause).

## T-317 (re-revue #126) — à reprendre
a. BandeauActivite.tsx:142 : message d'échec sans role="alert" ni test du rejet de enregistrerArretSynchro.
b. BandeauActivite.tsx:88 : message d'échec non effacé quand synchro devient nulle.

## T-307 (#128) — décisions et reste
- Écart liste fermée : PanneauApercuLot.tsx (bloc inline remplaçant ZoneExecution), src/lib/collection.ts (analyserCarte accepte quantite 0 si idsSite null : bug réel sur main — refus 403 par carte sur carte éditée rendait la collection illisible).
- pilotageLots.ts : `.catch(() => {})` sur l'écriture de `execution` à l'arrêt masque les échecs → à rendre visible (T-9xx).
- État stocké illisible non relu côté onglet Lots (blocage existant via executionIllisible dans DonneesPage).

## T-307 (sécurité, #128) — à reprendre
1. OngletSynchro.tsx:316-323 : journal illisible affiché « vide » (useLecture ne distingue pas) → passer `illisible` à <Journal>.
2. TableIgnorees.tsx:833-837 / 864-871 : liste ignorées corrompue = « Aucune action ignorée » ; « Reprendre » écrit depuis la mémoire sans relecture (perte possible d'une ignorée ajoutée par un autre onglet) → relire avant d'écrire, signaler l'état illisible.

## T-307 (re-revue #128) — à reprendre
1. Pas de test e2e pour : focus après action, « plus aucune action à reprendre », relecture avant écriture de « Reprendre » (liste illisible) (PanneauErreur.tsx:97-101,215-220 ; TableIgnorees.tsx:94).
2. PanneauErreur.tsx:215-220 : pendant la pause après rechargement, « Reprise possible à HH:MM » contredit « ne peut pas reprendre après un rechargement » → afficher « non, la page a été rechargée » quand repriseImpossible.
3. PanneauApercuLot.tsx:346-361 : section inline sans assertion e2e (exécution terminée / arrêtée).

## T-310 (sécurité, #130)
- refonte-transverse.spec.ts:242,256 : preparerLot recharge la page avant les interceptions de ouvrirSiteSimule (fenêtre sans piège) → poser pieger(context) avant (facultatif).
- Défaut hors tâche trouvé en route : collision de casse onglets.ts / Onglets.tsx (corrigé en #129).
- T-310 (reviewer) : refonte-transverse.spec.ts:261-264 « Ignorer puis Reprendre » sans assertion sur la clé ignorees ; :603 et 150-164 dépliage du bandeau conditionnel, phase `sans-liste` des 5 000 cartes non vérifiée à zéro requête.

## Décisions

- 2026-11-13 : le composant d’aperçu de T-316 s’appelle `PanneauApercuLot.tsx` (et non `ApercuLot.tsx`) pour éviter une collision de casse avec `apercuLot.ts` sous Windows.
- 2026-11-14 : collision de casse `onglets.ts` / `Onglets.tsx` (build cassé sous Windows) corrigée par le renommage en `definitionOnglets.ts` (#129) et le test `tests/unit/casse-fichiers.test.ts` (à confirmer sous Windows par Alexis : son `git pull` du 2026-11-14 précédait la fusion de #129).
- 2026-11-14 : `src/lib/collection.ts` accepte `quantite` 0 si `idsSite` est nul (bug réel : un 403 par carte sur une carte éditée rendait la collection illisible), déclaré en T-307.
- 2026-11-14 : `src/app/verifierWikipedia.ts` : `annuler()` du planificateur coupe aussi le titre en cours, cadence d’1 s tenue après annulation (T-312, revu par security-reviewer).

## Reste après T-901 (#133) — état final de la refonte
- ProgressionSynchro.tsx:40 : barres d'étape de l'onglet Synchro non monotones (precedent non passé) + test.
- BandeauActivite.tsx:54 / pilotageLots.ts:182 : alerte d'écriture d'execution jamais effacée, pas d'e2e.
- PanneauErreur.tsx:215 : rappeler l'heure de fin de pause après rechargement (« nouveau lot possible à HH:MM »).
- Traités par T-901 : T-305 pastille, historique illisible, T-307 re-revue 2, execution catch muet, T-317 alerte d'arrêt, T-302 « actions » + precedent (bandeau), ChiffreAnime, GraphiqueEvolution 30 jours, T-306 assertions.

## Autres points consignés pendant les revues (détail)
- **T-304 (PR #118)** : `src/app/MessageStockage.tsx:8` : les échecs d’écriture restent en `<p role="status">` ; D-62 demande un encadré `role="alert"` (bordure `defausser`, ✕, téléchargement). Séparer l’échec du message d’état et adapter les sélecteurs `getByRole('alert')` stricts (T-307).
- **T-304 (PR #118)** : `src/app/OngletVentes.tsx:31` : l’état interne d’`AssistantTri` (étape, thèmes cochés, ami en saisie) est perdu au changement d’onglet ; remonter dans `App` ou un état de module (T-318).
- **T-304 (PR #118)** : `tests/e2e/etiquettes.spec.ts:218` : le test « 5 000 cartes < 500 ms » a mesuré 619 ms une fois sous charge ; si la CI le voit échouer, escalader plutôt que relever le seuil.

## T-313 (PR #119) — à reprendre
- src/lib/file.ts:~370 : après `sortirDePause` (ordre parallèle, journal déjà ouvert), reboucler sur `attendrePause()` tant qu'une pause est demandée (+ test). Mineur, ergonomie.
- Décision : `stockage.ts` (refus d'écraser `ignorees` illisible) et `tests/unit/synchronisation.test.ts` (typage `EtatFile`) autorisés hors liste pour T-313 ; `chargerHistorique` illisible reste à T-308.
- Process : committer les tests de correction avant le correctif aux prochaines itérations.

## T-318 (PR #120) — à reprendre
- src/app/FileVente.tsx:48 : `placesEncheres` reçoit `ventesSite: null` → places possiblement différentes du Tableau de bord ; exposer `ventesSiteLues` (useExecution.ts:23) à OngletVentes → FileVente (hors liste T-318). 
- src/app/FileVente.tsx:67-72 : titre h2 « N en cours sur max » en doublon de PlacesEncheres ; le faire dériver des mêmes `places` (garder le texte attendu par assistant.spec.ts:60).
- tests/e2e/assistant.spec.ts:61 : assertion « ligne contient 100 » moins précise ; cibler la cellule Valeur.
- src/app/FileVente.tsx:162 : HeuresFortes affichée aussi sans vente à lancer (cohérent D-02), à mentionner.

## T-305 (PR #122) — décisions / à reprendre
- Décision : OngletTableauDeBord lit lui-même collection/préférences/état de synchro (App.tsx hors liste) ; départ des KPI à 0 pendant le chargement (aria-busy) accepté.
- À reprendre : passer `donnees` par App.tsx/useDonneesPage au lieu des lectures dupliquées (retouche T-9xx).
- À reprendre : Échap depuis un bouton de légende laisse le focus sur ce bouton (acceptable, à documenter dans design.md).

## T-309 (PR #121) — à reprendre
- src/app/OngletReglages.tsx:24 : `useAffichage()` monté deux fois (aussi App.tsx:28) → lire via ContexteAffichage ou prop.
- src/app/OngletReglages.tsx:76 : `enregistrerAffichage({ version: 1, … })` version en dur → `{ ...affichage, animations }` / AFFICHAGE_DEFAUT.
- tests/e2e/refonte-reglages.spec.ts:112-113 : ajouter une assertion après le retour sur Réglages.
- Capture reglages-replie-light-desktop.png : soulignement de l'onglet actif sous « Collection » alors que « Réglages » est actif → vérifier l'indicateur d'onglet (T-304/T-310), probablement un instant de transition.
- T-305 (PR #122) détail, à reprendre (T-9xx) :
  1. OngletTableauDeBord.tsx:38-43 [prioritaire] : synchro coupée sans arrêt → pastille « À jour » contradictoire ; renvoyer 'arretee' si !activee + e2e syncAuto=false.
  2. OngletTableauDeBord.tsx:39,46-70 : réutiliser `synchroEnCours` (SynchroAuto.tsx:52) et une seule lecture du statut.
  3. OngletTableauDeBord.tsx:114 : `accorder` + formatage fr-FR pour « N exemplaires ».
  4. BarreRepartition.tsx:96-106 : Échap sur document sans stopPropagation/test de cible.
  5. BarreRepartition.tsx:100 : écart D-06 (focus reste sur le bouton de légende) à consigner dans design.md.
  6. BarreRepartition.tsx:121 : règle 96 px sur largeur théorique, mesurer la largeur rendue.
  7. BarreRepartition.tsx:34 : renommer FONDS_LEGENDE → CONTOURS_LEGENDE.

## T-308 (PR #123) — décisions / à reprendre
- Décisions : écarts hors liste acceptés (assistant.spec.ts sélecteurs ; useHistoriqueQuotidien.ts n'écrit plus de point si collection vide).
- À reprendre : src/lib/stockage.ts:343 `chargerHistorique` renvoie [] pour une version illisible puis écrasement au prochain enregistrement → exposer un état « illisible » / refuser l'écriture (T-9xx).
- À reprendre : GraphiqueEvolution colonnes `div tabindex=0 role=img` (pas des boutons 44 px) ; fondu du filtre via Web Animations car tokens.css hors liste → tokeniser.
- T-308 (PR #123) détail, à reprendre (T-9xx) :
  1. GraphiqueEvolution.tsx:32,38,77 : maximum, seuil « <2 points » et tableau sr-only sur tous les points stockés, pas la fenêtre 30 jours → utiliser `serie` filtrée + e2e avec un point >30 jours.
  2. tests/e2e/refonte-collection.spec.ts:142-167 : le test « seuls les titres rendus » ne distingue pas une implémentation fautive ; vérifier la file/cache `wikipedia` (T-310).
  3. TableauCartes.tsx:69 : fondu de tout le tbody au filtre au lieu des seules lignes sortantes (D-16).
  4. AnalysesCollection.tsx:76,90 et GraphiqueEvolution.tsx:43 : pluriel figé (« 1 exemplaires ») et espace avant « : » non insécable.
- CI : etiquettes.spec.ts:212 (perf 5 000 cartes < 500 ms) échoue par intermittence (561 ms sur #123, 601 ms en local sur #120) → rendre le seuil robuste (T-310/T-9xx) ; ne pas désactiver.

## T-311 (PR #124) — à reprendre
- ListeActionsLot.tsx : doublon « Durée estimée : N min » avec `duree-lots` (« environ N min ») ; fichier hors liste T-311 → retirer.
- PanneauApercuLot.tsx : encadré « visibles des autres joueurs » (contrat de test) coexiste avec l'ancien `avertissement-visibilite` → fusionner.
- Décision : test refonte-lots.spec.ts:257 corrigé (`click({force:true}`) ; captures locales.
- T-311 (PR #124) détail : TableauLots.tsx:141,143 et PanneauApercuLot.tsx:364,401 : espace ordinaire avant « : » → insécable ({NB}). PanneauApercuLot.tsx:227 : places d'enchères comptées sur tous les lots filtrés même si « Enchères » décoché → compter sur `actionsCochees` (affichage « Cartes non incluses » seulement).

## T-312 (PR #127) — décisions / à reprendre
- Décisions : bordure `muted` des cartes (D-18 règle 2 vs D-15 `line`) à préciser dans design.md ; contour `:focus` des flèches accepté.
- src/lib/colonnesTri.ts:37 : typer `deplacerCarte` en `ColonneTri` et ignorer une source `en-vente`.
- tests/e2e/refonte-tableau-tri.spec.ts : ajouter un titre hostile (`<img src=x onerror=…>`) vérifié en texte littéral.
- useGlisser.ts : un glisser accidentel vers « Défausser » pose `decidePar: 'moi'` ; à réévaluer (annulation rapide ?) si le glisser devient la voie principale.

## T-312 (reviewer, #127) — à reprendre
1. src/lib/colonnesTri.ts:37-38 : deplacerCarte n'efface pas `ami` (la liste écrit ami:null, CarteLigne.tsx:97). À aligner + adapter colonnes-tri.test.ts. (prioritaire)
2. src/app/useGlisser.ts:23,87 / ColonneTri.tsx:76 : carte glissée rognée par overflow:hidden de .wm-repli-contenu ; ignorer la carte dans colonneSous (ou pointer-events:none) et lever le rognage pendant le glisser. (prioritaire)
3. src/app/CarteTri.tsx:54 : touch-pan-y annule le glisser tactile vertical ; appui long ou documenter la limite.
4. tests/e2e/refonte-tableau-tri.spec.ts:245-259 : SC-026 ne voit pas l'animation FLIP (getAnimations) ni le réglage Animations coupé.
5. tests/e2e/refonte-tableau-tri.spec.ts:294-302 : test Tab ne fait que focus() ; parcourir au Tab et vérifier le halo.
6. tests/e2e/refonte-tableau-tri.spec.ts:305-338 : SC-009 un seul thème ; couvrir en T-310.

## T-306 (reviewer, #125) — à reprendre
1. refonte-synchro.spec.ts:450 : test statut périmé sans assertion « Arrêtée » (toContainText).
2. refonte-synchro.spec.ts : pas d'e2e « étape en attente sans barre » (ProgressionSynchro.tsx:94).
3. refonte-synchro.spec.ts:491-493 : annonce intermédiaire <1,7 s fragile en CI lente → page.clock.
4. Hors diff : npm test tente 18 connexions vers fr.wikipedia.org (un test unitaire appelle le réseau) → à examiner.

## T-317 (reviewer, #126) — mineurs 3-9 traités par le dev (voir PR) ; vérifier à la re-revue.

## T-312 fix CI (5c7aa3c)
- verifierWikipedia.ts (hors liste T-312) : annuler() du planificateur abort désormais le titre en cours (bug : requête Wikidata après bascule en vue tri). Pas de test unitaire dédié à l'abort → à ajouter (T-9xx).

## T-317 (#126) — écarts consignés (décision orchestrateur : retouches)
5. LigneActivite.tsx:97 : Pause/Arrêter en ligne à xl (design.md § Responsive) non fait : contredit le test « aucun bouton Pause » ligne repliée (viewport 1280 = xl). À trancher en T-9xx avec adaptation du test.
6. BandeauActivite.tsx:79 : pas de fondu de sortie (D-21).
8. useActiviteSynchro.ts:66 : exécution orpheline (enCours && !local) affiche des commandes ; refonte-bandeau.spec.ts:151 l'exige aujourd'hui ; lecture seule à envisager.
3. Symbole/mot d'état : « Suspendu » au lieu de « En pause » (collision de nom avec le bouton Pause).

## T-317 (re-revue #126) — à reprendre
a. BandeauActivite.tsx:142 : message d'échec sans role="alert" ni test du rejet de enregistrerArretSynchro.
b. BandeauActivite.tsx:88 : message d'échec non effacé quand synchro devient nulle.

## T-307 (#128) — décisions et reste
- Écart liste fermée : PanneauApercuLot.tsx (bloc inline remplaçant ZoneExecution), src/lib/collection.ts (analyserCarte accepte quantite 0 si idsSite null : bug réel sur main — refus 403 par carte sur carte éditée rendait la collection illisible).
- pilotageLots.ts : `.catch(() => {})` sur l'écriture de `execution` à l'arrêt masque les échecs → à rendre visible (T-9xx).
- État stocké illisible non relu côté onglet Lots (blocage existant via executionIllisible dans DonneesPage).

## T-307 (sécurité, #128) — à reprendre
1. OngletSynchro.tsx:316-323 : journal illisible affiché « vide » (useLecture ne distingue pas) → passer `illisible` à <Journal>.
2. TableIgnorees.tsx:833-837 / 864-871 : liste ignorées corrompue = « Aucune action ignorée » ; « Reprendre » écrit depuis la mémoire sans relecture (perte possible d'une ignorée ajoutée par un autre onglet) → relire avant d'écrire, signaler l'état illisible.

## T-307 (re-revue #128) — à reprendre
1. Pas de test e2e pour : focus après action, « plus aucune action à reprendre », relecture avant écriture de « Reprendre » (liste illisible) (PanneauErreur.tsx:97-101,215-220 ; TableIgnorees.tsx:94).
2. PanneauErreur.tsx:215-220 : pendant la pause après rechargement, « Reprise possible à HH:MM » contredit « ne peut pas reprendre après un rechargement » → afficher « non, la page a été rechargée » quand repriseImpossible.
3. PanneauApercuLot.tsx:346-361 : section inline sans assertion e2e (exécution terminée / arrêtée).

## T-310 (sécurité, #130)
- refonte-transverse.spec.ts:242,256 : preparerLot recharge la page avant les interceptions de ouvrirSiteSimule (fenêtre sans piège) → poser pieger(context) avant (facultatif).
- Défaut hors tâche trouvé en route : collision de casse onglets.ts / Onglets.tsx (corrigé en #129).
- T-310 (reviewer) : refonte-transverse.spec.ts:261-264 « Ignorer puis Reprendre » sans assertion sur la clé ignorees ; :603 et 150-164 dépliage du bandeau conditionnel, phase `sans-liste` des 5 000 cartes non vérifiée à zéro requête.
- T-319 (sécurité) : README.md:77 « host_permissions limité à fr.wikipedia.org » omet www.wikidata.org (ligne préexistante) → corriger.
