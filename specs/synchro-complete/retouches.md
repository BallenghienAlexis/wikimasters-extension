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

- **PR #60, `ventesSite`** (`src/lib/ordonnanceur.ts`, `src/lib/stockage.ts`) : enchères en cours lues sur `marketplace/mine`, stockées mais encore non affichées. À brancher sur les places libres de `src/app/FileVente.tsx` (et sur la limite du lot d’enchères) quand l’écriture sera livrée.
- **Cohérence documentaire** : `spec.refined.md` (lignes 88, 253, 301) et `tasks.md` (ligne 333) citent encore « la valeur de repli par rareté ne suffit pas ». Ce repli a été supprimé (PR #61) ; sans effet sur le code (`lot-encheres` exige déjà `valeurMarchande`, H13). À reformuler à la prochaine reprise de la spec.

## Suite de la pose réelle des étiquettes (2026-11-11)

Décision d'Alexis : `apikey` publique **en dur** dans une constante unique de `src/config/synchro.ts` ; jamais de jeton de session ni de `refresh_token` dans le dépôt. Écart découvert en préparant T-019/T-024 : le protocole actuel ne permet pas d'émettre une pose ou un retrait, car il manque l'identifiant d'étiquette du site.

- `src/lib/actions.ts:44-54` : `ActionPoseEtiquette` et `ActionRetraitEtiquette` ne portent que `nomEtiquette`. Le corps `{ user_card_id, tag_id }` exige l'identifiant d'étiquette : ajouter `idEtiquette` (rempli depuis `registre.etiquettes` à l'exécution).
- `src/lib/messages.ts:84-95` (`validerOrdre`) : `cles()` exige la liste exacte de champs ; autoriser `idEtiquette`. `ResultatAction` (`actions.ts:98`) ne renvoie pas l'identifiant créé : ajouter `idEtiquette?` validé (UUID) au message de résultat pour que `revision.ts:107` enregistre la création dans le registre.
- `src/lib/jeton.ts:14-35` : `enteteAuthentification` refuse toute origine autre que le site ; autoriser l'hôte Supabase relevé (une seule origine, ajoutée à `src/config/synchro.ts`). Ajouter la lecture du cookie de session en deux morceaux (`.0` + `.1`, préfixe `base64-`), en n'extrayant que `access_token` et en refusant un jeton expiré.
- `src/lib/reseau.ts` (à créer, seul importeur de `jeton.ts` et seul module à appeler `fetch` pour l'écriture) : en-têtes `apikey`, `Authorization: Bearer`, `Content-Profile: public`, `Content-Type`, `Accept`; arrêt sur 401, 403, 429 ; délai de 15 s par requête.
- `src/lib/contrat/etiquettes.ts` : `pose-etiquette` (`POST /rest/v1/user_card_tags`, 201 sans corps), `retrait-etiquette` (`DELETE …?user_card_id=eq.…&tag_id=eq.…`, 204). `creation-etiquette` est disponible depuis le relevé de sa réponse (2026-11-11) ; `user_id` vient du champ `sub` du jeton.
- Tests à prévoir : `tests/unit/reseau.test.ts`, `tests/unit/contrat-etiquettes.test.ts`, extension de `jeton.test.ts`, `messages.test.ts`, `confinement-jeton.test.ts` (origine Supabase) ; e2e T-026 avec site fictif servant aussi l'hôte REST (aucune requête réelle, G1).

## À reprendre (revue de la PR de la pose des étiquettes, 2026-11-11)

- T-018, T-020 et T-026 : **traités** le 2026-11-11 par `tests/e2e/synchro-ecriture.spec.ts` (site et hôte REST fictifs, 0 requête avant « Lancer », création puis pose avec les en-têtes attendus, arrêt sur 401, arrêt sans session, non-fuite du jeton et du jeton de rafraîchissement dans le stockage, la console et les pages).
- `src/lib/reseau.ts` et `src/lib/lot.ts:388` : une création en délai dépassé ou « inconnu » a peut-être réussi sur le site ; une étiquette du site de même nom absente du registre sera recréée (doublon ou erreur). Le code d'erreur d'un nom en double n'est pas relevé. Piste : relire les étiquettes du site (`stats`) avant un lot et rattacher l'identifiant par nom.
- `src/config/synchro.ts` : `LONGUEUR_MAX_ETIQUETTE` absent (limites non relevées, `lot.ts` garde sa limite).
- Cookie de session lisible par `document.cookie` (non HttpOnly) : à confirmer au premier essai réel.
- `src/lib/reseau.ts:86-87` : 401, 403, 429 portent le libellé « action non disponible » ; prévoir un libellé propre (« refus du site ») dans `CAUSES_RESULTAT`.
- `tests/e2e/synchro-ecriture.spec.ts` : le retrait d'étiquette (`DELETE user_card_tags`) n'est pas couvert en e2e ; ajouter un cas avec une carte dont le statut a changé et un registre amorcé. Les requêtes du site fictif hors navigation ne sont pas comptées (seul l'hôte REST l'est).

## À reprendre (revue de la PR d'envoi de l'enchère et de la défausse, 2026-11-11)
- ~~`src/lib/tri.ts:83` : seuil de proposition 15 contre plafond 5~~ : fait (Alexis, 2026-11-11), `seuilDefausse` = plafond + 1 = 6 et matrice abaissée à 6.
- Enchères : le prix et la durée (1 h) par enchère ne sont pas confirmés une à une avant l'envoi ; l'aperçu affiche le prix de départ et la valeur marchande.
- Première défausse réelle : l'authentification par cookies n'a pas été rejouée ; un 401 ou 403 arrête le lot. À tenter sur une carte de valeur ≤ 5 choisie par Alexis.

## À reprendre (premier lot réel, 409 sur trois enchères, 2026-11-11)
- Cause exacte du 409 non établie : `marketplace/mine` donne 0 enchère en cours pour un plafond de 5, donc ce n'est pas (seulement) la limite. Le libellé du refus du site n'est pas recopié ; `classerConflit` (`src/lib/reseau.ts`) ne distingue que « limite d'enchères atteinte » et « conflit signalé par le site ». À préciser avec le message affiché par le site pour une de ces trois cartes (les trois du premier lot réel, détail dans le journal local) mise aux enchères à la main.

- Mise à jour (2026-11-11, soir) : l'enchère envoie désormais l'identifiant de l'exemplaire dans `card_id` (corps relevé sur une mise manuelle réussie). Hypothèse la plus probable du 409, à confirmer par un prochain lot réel d'une seule enchère. L'ancien relevé « `card_id` = celui de la carte » du 2026-11-11 (midi) était faux.

## Ouzbékistan 409 (2026-11-11, soir)

- Constat (lectures seules) : l’enchère manuelle sur Ouzbékistan est `cancelled` ; la carte est revenue avec un **nouvel** identifiant d’exemplaire (l’ancien a disparu). L’extension gardait l’ancien dans `idsSite` : 409 sur un identifiant mort, pas une carte « déjà en vente ».
- Fait : le message d’arrêt sur 409 nomme cette cause et demande de relancer la synchronisation.
- À reprendre : exclure de l’aperçu les cartes déjà en vente exige les identifiants d’exemplaires de `selling` (aujourd’hui seuls les compteurs de `marketplace/mine` sont conservés) ; un relevé de la forme de `selling` est nécessaire.

## Premier lot réel du 2026-11-11 (403 à la pose)

Carte « Primaire présidentielle socialiste française de 2026 » : création de « Statut · En vente » 201, retrait de « Statut · Vendre » 204, pose de « Statut · En vente » 403, arrêt du lot (règle des codes 401, 403, 429).

- Diagnostic (hypothèse, non confirmée) : la création passe avec le même jeton, donc la session est acceptée ; le 403 sur un `POST /rest/v1/user_card_tags` correspond à un refus de sécurité par ligne (RLS) sur `user_card_id`. Cause la plus probable : identifiant d’exemplaire périmé ou exemplaire en vente (la carte avait été mise aux enchères par erreur de test juste avant). Un retrait sur un identifiant périmé renvoie quand même 204 (aucune ligne touchée), ce qui masque le problème. Même famille que le 409 « identifiant d’exemplaire périmé » traité en #69.
- Fait : le lot s’arrête avec la cause lisible « réponse 403 : exemplaire périmé ou carte en vente, ou session refusée : relancer la synchronisation avant de réessayer » (`libelleCause`, `src/app/Synchronisation.tsx`).
- À reprendre : confirmer avec un lot d’une carte « Garder » non mise en vente (si la pose réussit, l’hypothèse « carte en vente » est établie et la pose de « Statut · En vente » est à retirer du lot pour les cartes déjà en vente, ou à envoyer avant l’enchère) ; sinon relever le corps de l’erreur de Supabase (code et message, sans valeur secrète).

## À reprendre (cadence du 2026-11-12, PR #72)

- `specs/synchro-complete/spec.refined.md` (SC-008 « × 6 s », l.54, 135, 220, 268), `spec.md:52` et `tasks.md:9, 411`, ainsi que les décisions `D-xx` de `specs/synchro-auto/*` : ils donnent encore 6 s et 10 par minute. Depuis le 2026-11-12 (décision d'Alexis) la cadence est de 0,2 s + 0 à 0,1 s, sans plafond par minute (ajustée le 2026-11-12), pour toutes les actions (`AGENTS.md` prime). À mettre à jour dans une PR de documents de l'orchestrateur.
- `AGENTS.md:30-31` et `:36` : fusionner les puces « Cadence la plus rapide » et « Délais variables » (redondantes).
- Revue de la PR #74 : la file d'écriture (`src/app/Synchronisation.tsx`) et la synchro automatique (`src/content/synchroAuto.ts`) ont chacune leur cadence et ne s'excluent pas. Sans plafond par minute, le débit cumulé peut dépasser celui d'un seul exécuteur. À faire : refuser « Lancer » tant que le bail de synchro est actif (et l'inverse), ou accepter la règle « par exécuteur » (écrite dans `AGENTS.md`).

- Parallélisme (PR « poses et retraits en parallèle », 2026-11-12) : les specs `synchro-complete` et `synchro-auto` décrivent encore une seule requête en vol, 6 s et 10 par minute ; à aligner dans une PR de documents de l’orchestrateur.
