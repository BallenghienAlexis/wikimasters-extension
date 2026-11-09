# Retouches T-901 : points mineurs des revues de T-004 à T-016

## Traité

- `registre.ts` : tables d’étiquettes sans prototype (`__proto__`, `constructor`, `prototype` restent de simples clés) dans `validerRegistre` et `enregistrerEtiquette` ; couple `{ex, nom}` en double rejeté ; tests « n’altère jamais l’entrée » sur copie profonde (cas valide et rejeté).
- `messages.ts` : `CAUSES_RESULTAT` (liste fermée, libellés existants conservés : `action non disponible`, `erreur d’émission`, `erreur de transport`, `jeton-absent`) ; prix d’enchère entier sûr entre 1 et `PRIX_MAX` (1 000 000) ; `validerSignal` ; type renommé `MessageProtocole` (aucun autre fichier ne l’importait) ; `expectTypeOf` sur `ordre` et `resultat` ; `NOM_PORT` défini ici.
- `contrat.ts` : `typesDisponibles` ignore les valeurs `undefined` ; tests : clé à `undefined`, chaînes interdites (`https://`, `http://`, `authorization`, `apikey`, sans tenir compte de la casse) dans `contrat.ts` et `contrat/*`, chemin résolu depuis `import.meta.url`, entrées de familles retrouvées dans `TABLE_CONTRAT`.
- `journal.ts` : vérifié, `completerEntree` compare des identifiants et ne passe plus par le prototype. Rien à changer.
- `jeton` : confinement exige une erreur de règle (pas une erreur d’analyse) ; expression de retrait des commentaires `(?<!:)\/\/.*$` avec un test sur une chaîne contenant `//`.
- `lot.ts` : raisons d’écart dédoublonnées par carte ; `construireEncheres` ignore favori et statut autre que `vendre` (reste exporté, sans autre usage) ; prix entier sûr ≥ 1 ; `Math.floor` sur les places ; test `idsSite: []` ; tests d’enchères déduits de la matrice ; apostrophe de « s’inséreront ».
- `revision.ts` : commentaire sur la cohérence avec l’état actuel ; tests : prix sans `prixCible`, quantité > 1 avec un seul identifiant, `retrait-etiquette` et `lecture` dans la boucle AC3.
- `file.ts` : JSDoc de `reverifier` ; `toBe(6000)` dans le test d’exception de transport.
- `execution.ts`, `content/*` : `NOM_PORT` défini une seule fois (`messages.ts`), ligne vide en trop retirée, import `./executant` placé après `../lib`, test contre `window.onmessage = …` et `on… =`, test de `horlogeReelle` sur `performance`.
- `Journal.tsx`, `DialogueVider.tsx` : test d’une entrée à `idCarte: ''` (pas de repère de rareté, écart assumé avec D-29) ; le `mousedown` sur le voile remet le focus sur « Annuler ».

## Décliné ou laissé

- `validerSignal` n’est branché nulle part : les consommateurs (`execution.ts`) ignorent déjà tout message non attendu ; le brancher changerait leur comportement, hors périmètre.
- Le test du dialogue vérifie le source (pas de DOM dans Vitest, pas de nouvelle dépendance) ; un test e2e pourra le couvrir avec T-017.
- `CAUSES_RESULTAT` contient quelques libellés de réserve (`action réussie`, `erreur réseau`, `délai dépassé`, `réponse hors contrat`) : T-021 l’étendra au besoin.
- `Synchronisation.tsx` et `App.tsx` : réservés à T-017, leurs retouches viendront après.

## Traité : revues de T-015 et T-017 (`Synchronisation.tsx`, `App.tsx`)

- T-015 sécurité 1 : l’avertissement de visibilité (D-13, H34) s’affiche dans le bandeau dès que le lot contient une étiquette « Ami · … », tant que la visibilité n’est pas relevée.
- T-015 code 1 : « Cartes non incluses (N) » compte des cartes ; les groupes d’étiquettes obsolètes gardent leur nom (« étiquette obsolète conservée : favori »).
- T-015 code 2 : « en attente d’une place libre (5 / 5) » (places occupées = exemplaires en vente + enchères du lot).
- T-015 code 3 : le focus revient sur le titre après un « Réessayer ».
- T-015 code 4 : `App.tsx` ne propose pas l’aperçu avant la fin de la lecture du stockage (« Calcul du lot… », `aria-busy`).
- T-015 code 5 : espaces insécables dans le bandeau de risque.
- T-017 sécurité 1 : `actionsRetrait` renvoie `[]` si le retrait d’étiquette n’est pas disponible.
- T-017 code 2 : phrases de fin D-22 (« Lot terminé : N réussies, M passées, E échouées » ; « Lot interrompu : … »).
- T-017 code 3 : `erreurLancement` n’affiche que des libellés fixes (D-41).
- T-017 code 4 : tests de `libelleCause`, `texteFin`, `texteEnCours`, `pourcentage`, `actionsRetrait`.
- T-017 code 6 : commentaire du contexte d’exécution corrigé.

## À reprendre

Chaque point dit ce qu’il attend. Source : revues de T-015 (#21) et T-017 (#23).

- **T-015 sécurité 2** (`Synchronisation.tsx`, `construireLot` : `longueurMaxEtiquette: null`, `nomsExistants: []` figés dans `preparerLot` et `CONFIG_LOT`). Attend le contrat : la limite de longueur et les noms existants ne sont pas relevés dans `contrat-api.md`. À faire en **T-021**, quand le contrat les donne. Tant que c’est figé, les écarts « nom trop long » et « homonyme » ne se déclenchent jamais.
- **T-015 code 6** (`tests/unit/synchronisation.test.ts`) : le câblage de « Réessayer » n’est pas testé. Attend l’e2e de **T-018** (pas de DOM dans Vitest). Même attente pour le focus après « Réessayer » et pour l’état « Calcul du lot… » de cette retouche, non vérifiables en unitaire.
- **T-017 code 1** (`ZoneExecution`) : décompte « prochaine action dans N s » (D-20), hors région live. Attend un changement de `src/lib/file.ts` : la file doit exposer l’échéance de la prochaine action (aujourd’hui interne à `attendre`), avec son test. `file.ts` n’est pas dans le périmètre de cette retouche ; tâche de logique à créer, puis branchement dans `ZoneExecution`.
- **T-017 code 5** (`tests/unit/dialogue-defausse.test.ts:18-21`) : le test du focus initial vérifie la constante `BOUTON_FOCUS_INITIAL`, pas `document.activeElement`. Attend l’e2e de **T-018**.
- **T-015 code 6 bis** : captures `specs/synchro-complete/captures/T-015/*.png` hors liste fermée : exception acceptée, rien à faire.
