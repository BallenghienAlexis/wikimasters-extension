# Tâches — Thèmes précis et étiquettes de thème et d’échange

Vagues : V1 : T-101 [P], T-102 [P] · V2 : T-103 · V3 : T-104 [P], T-107 [P] · V4 : T-105 [P], T-106 [P] · V5 : T-108 · V6 : T-109 [P], T-110 [P]

Garde-fous communs (tout dev les lit) :
- **G1** Aucune requête vers le site, aucun nouveau type d’action ni point d’accès. Les types d’étiquette restent « non disponibles » (table du contrat inchangée) : tout test de l’aperçu tourne avec `typesDisponibles()` vide.
- **G2** Données de test fictives uniquement (prénoms Léa, Hugo, Zoé ; jamais `captures-site/`). Les prénoms Benjamin et Anatole n’apparaissent que dans `src/config/amis.ts` et dans le test SC-024/SC-025 qui les lit.
- **G3** `src/styles/tokens.css`, `public/manifest.json`, `package.json` inchangés. Pas de `innerHTML` ni `dangerouslySetInnerHTML`. Code, commentaires, UI, commits en français (’, espace insécable avant `:`). Commits `type(T-xxx): …`.
- **G4** `Config` du lot : les nouveaux champs (`amis`, `limiteParExemplaire`, `limiteNoms`) sont **optionnels** (absents = aucun ami, aucune limite) pour ne pas casser les tests existants (`lot-encheres.test.ts`, `revision.test.ts`).

| ID | Titre | Couche | Agent | Dépend de | SC | [P] |
|---|---|---|---|---|---|---|
| T-101 | Taxonomie : 60 thèmes, Tibet, Ukraine, Barrage | logique | dev-core | — | SC-001 à SC-006, SC-020, SC-023 | [P] |
| T-102 | Registre v2 et migration | données | dev-core | — | SC-013, SC-018 | [P] |
| T-103 | `amisConcernes` partagée par le tri et le lot | logique | dev-core | T-101 | SC-007, SC-025 (tri) | — |
| T-104 | `lot.ts` : étiquettes d’échange et de thème, limites, retraits | logique | dev-core | T-101, T-102, T-103 | SC-008 à SC-011, SC-021, SC-022, SC-025 | [P] |
| T-105 | `revision.ts` : revérification des étiquettes de thème et d’échange | logique | dev-core | T-104 | SC-012 | [P] |
| T-106 | Regroupement d’aperçu, totaux et durée | logique | dev-core | T-104 | SC-014 (logique), SC-016, SC-017 | [P] |
| T-107 | Amis initiaux : fusion automatique (Benjamin, Anatole) | données | dev-core | T-103 | SC-024 | [P] |
| T-108 | UI : « Étiquettes prévues » dans l’aperçu | ui | dev-ui | T-105, T-106, T-107 | SC-014, SC-015, SC-016, SC-019 | — |
| T-109 | E2e et captures | tests | dev-test | T-108 | SC-014, SC-015, SC-017, SC-019, SC-020 | [P] |
| T-110 | Documentation (AGENTS.md, notes synchro-complete) | docs | dev-core | T-108 | — | [P] |
| T-901 | Mesure de performance sur la meilleure de trois exécutions (retouche de revue) | tests | dev-core | T-101 | SC-017 | — |
| T-902 | Thèmes calculés une seule fois par carte, clés de noms mémorisées (retouche de revue) | logique | dev-core | T-104 | SC-017 | — |
| T-903 | Étiquettes mémorisées par carte pour l’aperçu (retouche de revue) | logique | dev-core | T-106 | SC-017 | — |
| T-904 | Retouches : titre de test, `readonly`, indicateur de disponibilité de l’aperçu, test de casse, noms fictifs | logique | dev-core | T-108 | SC-007, SC-014, SC-024 | — |

Couverture : SC-001 à 006 (T-101) · 007 (T-103) · 008 à 011, 021, 022 (T-104) · 012 (T-105) · 013, 018 (T-102 ; 018 aussi T-106) · 014 (T-106, T-108, T-109) · 015 (T-108, T-109) · 016 (T-106, T-108) · 017 (T-101, T-104, T-106, T-109) · 019 (T-108, T-109) · 020 (T-101, T-109) · 023 (T-101) · 024 (T-107) · 025 (T-103, T-104).
Contrôles : aucun fichier dans deux tâches d’une même vague ; graphe acyclique ; fichiers carrefour : `src/lib/lot.ts` (T-104 seul), `src/app/Synchronisation.tsx` (T-108 seul), `src/lib/stockage.ts` (T-107 seul), `src/lib/actions.ts` (T-104 seul).

---

## T-101 — Taxonomie : 60 thèmes, Tibet, Ukraine, Barrage
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P]
- **SC couverts** : SC-001 à SC-006, SC-020, SC-023 · **Règles design** : DT-15
- **Fichiers concernés** (liste fermée) :
  - `src/lib/themes.ts`
  - `tests/unit/themes.test.ts`
  - `tests/unit/exports.test.ts`
- **Critères d’acceptation**
  1. `DEFINITIONS_THEMES` contient les 60 identifiants du § Taxonomie de `spec.refined.md` (dont `tibet` #Tibet et `ukraine` #Ukraine), avec libellés et parents indiqués ; parents clos, sans cycle ni doublon ; `IDS_THEMES` trié par libellé, `autres` en dernier (SC-001).
  2. La table id → libellé des 57 thèmes existants et d’`autres` est figée par un test (SC-002).
  3. Libellés : « # » initial, ≤ 32 caractères, ne commencent ni par « Statut · », « Ami · » ni « #À échanger », sans doublon (casse et accents ignorés) (SC-003).
  4. Chaque nouveau thème est détecté sur ≥ 2 cartes fictives, parents compris ; Tibet et Ukraine sur ≥ 3 (SC-004, SC-023).
  5. Zéro faux positif sur la liste de SC-005 et sur « Tibia », « Ukulélé », « Match de barrage » (SC-005, SC-023).
  6. Non-régression : aucun thème détecté avant la feature n’est perdu sur les cartes fictives de `themes.test.ts` et `tri.test.ts` (SC-006).
  7. Performance : `themesDeCarte` sur 5 000 cartes fictives < 200 ms (SC-017).
  8. L’export CSV garde ses colonnes et contient les nouveaux libellés ; l’export JSON ne change pas (SC-020).
- **Tests attendus**
  - `tests/unit/themes.test.ts` : AC1 à AC7. `tests/unit/exports.test.ts` : AC8.
- **Brief de contexte**
  - *Pourquoi* : fournir les thèmes précis, base des étiquettes et des intérêts des amis (dont Tibet, Ukraine, Barrage pour Benjamin et Anatole).
  - *État actuel* : `src/lib/themes.ts` : 57 définitions (`DEFINITIONS_THEMES`, l.16-98), `LIBELLES_THEMES`, `IDS_THEMES`, regex `(^|[^a-z0-9])(motifs)` compilée une fois, texte normalisé sans accents (`normaliser`). `architecture` porte déjà `pont `, `chateau`, `cathedrale`.
  - *À faire* : ajouter les 60 thèmes (tableau du § Taxonomie ; `ukraine` : parents `pays`, `geographie`) ; ajuster les motifs pour tenir SC-004 à SC-006 et SC-023 (motifs plus longs ou espace finale ; « chevalier » ne doit pas donner `cheval`, « château » pas `chat`). Ne jamais retirer ni renommer un identifiant ou libellé existant ; ne retirer aucun motif d’un parent. Écrire les tests d’abord.
  - *Contrats* : AGENTS.md (taxonomie en français, calcul local sans service externe) ; H10 (motifs indicatifs).
  - *Pièges* : motifs sans accents (texte normalisé) ; `’` remplacé par `'` avant test ; un motif trop court (`ski `, `lac `) doit viser le mot entier ; tri `localeCompare('fr')` pour les libellés accentués (#Île, #Étoile).
  - *Vérifier* : `npx vitest run tests/unit/themes.test.ts tests/unit/tri.test.ts tests/unit/exports.test.ts && npm run check`

## T-102 — Registre v2 et migration
- **Couche** : données · **Agent** : dev-core
- **Dépend de** : — · **Parallélisable** : [P]
- **SC couverts** : SC-013, SC-018 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/registre.ts`
  - `tests/unit/registre.test.ts`
- **Critères d’acceptation**
  1. `VERSION_REGISTRE` vaut 2 ; un registre `version: 1` est lu et migré en `version: 2` sans perte d’étiquettes ni de couples ; la migration est idempotente (SC-013).
  2. Un registre `version: 2` accepte jusqu’à 256 couples par exemplaire ; au-delà, `validerRegistre` renvoie `null` (SC-013).
  3. `poserCouple` ne refuse plus un 3ᵉ couple ; il refuse seulement au-delà de la limite du site si elle est fournie en paramètre optionnel (SC-013).
  4. Un registre illisible reste `null` et n’est jamais écrasé (comportement de `chargerRegistre`).
  5. Un registre de 5 000 exemplaires × 12 couples (identifiants de 36 caractères, noms de 25) pèse ≤ 5 Mo sérialisé (SC-018).
- **Tests attendus**
  - `tests/unit/registre.test.ts` (extension) : AC1 à AC5.
- **Brief de contexte**
  - *Pourquoi* : une carte porte désormais statut + échange(s) + plusieurs thèmes ; le plafond de 2 couples bloquerait les poses.
  - *État actuel* : `src/lib/registre.ts` : `VERSION_REGISTRE = 1`, `COUPLES_MAX_PAR_EXEMPLAIRE = 2`, `poserCouple` (l.44-50), `validerRegistre` (l.74-96) refuse `version !== 1`.
  - *À faire* : version 2, borne 256 (contrôle de forme, H7), `validerRegistre` accepte 1 et 2 et renvoie toujours la forme v2. `poserCouple(r, ex, nom, limite?)`. Aucun changement de `src/lib/stockage.ts` (il appelle déjà `validerRegistre`).
  - *Contrats* : le registre n’autorise un retrait que pour ce que l’extension a posé ; tables sans prototype (`tableVide`).
  - *Pièges* : `__proto__` comme nom d’étiquette ; ne jamais muter l’entrée ; `Registre.version` est typé `number` dans `actions.ts`.
  - *Vérifier* : `npx vitest run tests/unit/registre.test.ts tests/unit/stockage.test.ts && npm run check`

## T-103 — `amisConcernes` partagée par le tri et le lot
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-101 · **Parallélisable** : —
- **SC couverts** : SC-007, SC-025 (partie tri) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/tri.ts`
  - `tests/unit/tri.test.ts`
- **Critères d’acceptation**
  1. `tri.ts` exporte `amisConcernes(themesCarte: readonly string[], amis: readonly Ami[]): Ami[]` : tous les amis, dans l’ordre de la liste, dont au moins un thème figure dans `themesCarte` (parents compris, car `themesDeCarte` les inclut).
  2. `proposerTri` utilise le premier ami renvoyé : comportement inchangé (SC-007 d, e).
  3. SC-007 (a) à (f) : `mesThemes: ['chien']` → `garder` ; ami Léa suivant `animaux` → carte « chien » `echanger` avec `ami: 'Léa'` ; `garder` l’emporte sur `echanger` ; premier ami en cas de deux ; favori → `garder` et `decidePar: 'moi'` jamais remplacé ; préférences `version: 2` relues à l’identique.
  4. `tri.ts` exporte `fusionnerAmisInitiaux(preferences, initiaux)` (pure) : ajoute l’ami absent (nom comparé sans casse ni accents), ajoute à l’ami présent les thèmes manquants, ne retire rien, ne mute pas l’entrée, est idempotente (SC-024).
  5. Avec un ami suivant `barrage`, une carte « barrage hydroélectrique » est `echanger` pour cet ami ; idem `tibet` et `ukraine` (SC-025, prénoms fictifs).
- **Tests attendus**
  - `tests/unit/tri.test.ts` (extension) : AC1 à AC4.
- **Brief de contexte**
  - *Pourquoi* : le tri et les étiquettes d’échange doivent appliquer la même règle (H13).
  - *État actuel* : `src/lib/tri.ts` `proposerTri` (l.37-55) cherche `preferences.amis.find(...)` en ligne ; `Ami { nom, themes }`, `lirePreferences` exige `version: 2`.
  - *À faire* : extraire la fonction, la faire utiliser par `proposerTri`, ne rien changer d’autre (ordre des règles, `lirePreferences`).
  - *Contrats* : AGENTS.md (règles du tri dans l’ordre) ; une décision `decidePar: 'moi'` n’est jamais remplacée.
  - *Pièges* : performance (SC-017) : construire un `Set` des thèmes de la carte une fois.
  - *Vérifier* : `npx vitest run tests/unit/tri.test.ts && npm run check`

## T-104 — `lot.ts` : étiquettes d’échange et de thème, limites, retraits
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-101, T-102, T-103 · **Parallélisable** : [P]
- **SC couverts** : SC-008, SC-009, SC-010, SC-011, SC-021, SC-022, SC-025 (lot), SC-017 (lot) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/lot.ts`
  - `src/lib/actions.ts`
  - `tests/unit/lot.test.ts`
  - `tests/unit/lot-etiquettes.test.ts` (créé)
- **Critères d’acceptation**
  1. `exemplairesAttendus(carte, config?)` renvoie, pour une carte non favori, reliée, aux statuts `garder`, `echanger`, `vendre`, `en-vente`, par exemplaire : « Statut · … », puis (si `echanger`) les étiquettes d’échange, puis les libellés de `themesDeCarte` sauf `autres`, dans l’ordre de H5 (SC-008). Plus d’« Ami · … ».
  2. Étiquettes d’échange (SC-021) : « #À échanger <carte.ami> » si non vide après trim, puis « #À échanger <ami.nom> » pour chaque ami de `config.amis` dont un thème figure parmi ceux de la carte (`amisConcernes`), sans doublon ni nom vide. Léa + Hugo suivant `animaux` → deux étiquettes ; `ami: 'Zoé'` sans thème suivi → « #À échanger Zoé » seule ; carte `garder` ou `vendre` → aucune.
  3. Favori, `a-trier`, `defausser` : aucune étiquette de thème ni d’échange, aucune action ; obsolètes signalées pour favori et à trier ; aucun retrait pour `defausser` (SC-008, SC-011).
  4. Homonymes (`config.nomsExistants`) : ni création ni pose, carte écartée `homonyme` (SC-009). Nom plus long que `longueurMaxEtiquette` : écarté `nom-trop-long`, jamais tronqué (SC-021).
  5. Limite du site (SC-010) : avec `limiteParExemplaire` N, un exemplaire n’attend que les N premières étiquettes de H5 (Statut et échanges jamais écartés au profit d’un thème) ; avec `limiteNoms` M, au plus M noms distincts, registre compris, dans l’ordre de H6 ; chaque étiquette écartée est rapportée dans `LotConstruit.nonPosees` avec la raison `au-dela-limite` (nouvelle valeur de `RaisonEcart`). Limite `null` ou absente : rien n’est écarté.
  6. Retraits (SC-011, SC-022) : toute étiquette du registre pour un exemplaire et qui n’est plus attendue (thème disparu, ami retiré, ami qui ne suit plus, carte plus à échanger, « Ami · … » héritée) reçoit un retrait ; une étiquette absente du registre n’en reçoit jamais ; un couple déjà au registre ne produit aucune action.
  7. Lot : l’ordre des actions reste créations, retraits, poses, enchères, défausses ; ordre des poses selon H5.
  8. Pour Benjamin (`barrage`, `tibet`) et Anatole (`ukraine`), une carte `echanger` correspondante reçoit « Statut · Échanger », « #À échanger Benjamin » (resp. Anatole), puis ses thèmes (SC-025).
  9. Performance : lot de 5 000 cartes et 20 amis × 10 thèmes < 500 ms (SC-017).
- **Tests attendus**
  - `tests/unit/lot.test.ts` (adapter les attentes « Ami · … » des l.137-150 et l.187-190) ; `tests/unit/lot-etiquettes.test.ts` (créé) : AC1 à AC9.
- **Brief de contexte**
  - *Pourquoi* : c’est le cœur de la feature : le lot expose aux étiquettes d’échange et de thème la même mécanique que le statut.
  - *État actuel* : `src/lib/lot.ts` : `Config` (l.21-35), `exemplairesAttendus(carte)` (l.58-64) ne connaît que Statut et Ami ; `construireLot` (l.136-267) parcourt les exemplaires attendus, retire ce qui est au registre et n’est plus attendu, crée / pose le reste (homonymes, longueur déjà gérés l.215-235). `src/lib/actions.ts` : `RaisonEcart` l.100-110, `Lot`, `Registre`.
  - *À faire* : étendre `Config` (champs optionnels, G4) : `amis?: readonly Ami[]`, `limiteParExemplaire?: number | null`, `limiteNoms?: number | null` ; ajouter `LotConstruit.nonPosees: Array<{ idCarte; titre; nomEtiquette; raison }>` et la raison `au-dela-limite` ; implémenter l’ordre H5 (nombre d’ancêtres décroissant puis `localeCompare` fr) ; un seul calcul d’étiquettes attendues, réutilisé par `revision.ts` (T-105) ; ne pas appeler `proposerTri`.
  - *Contrats* : spec SC-008 à 011, 021, 022 ; garde-fous existants (favori, à trier, défausse) ; le registre seul autorise un retrait ; `Statut · …` et échanges jamais écartés au profit d’un thème (réponse 2).
  - *Pièges* : noms d’amis libres (300 caractères, espaces, doublons) ; deux amis de même nom → une étiquette ; cartes déjà chargées avec `ami` obsolète ; `Object.prototype.hasOwnProperty` pour le registre ; ne pas muter les entrées.
  - *Vérifier* : `npx vitest run tests/unit/lot.test.ts tests/unit/lot-etiquettes.test.ts tests/unit/lot-encheres.test.ts && npm run check`

## T-105 — `revision.ts` : revérification des étiquettes de thème et d’échange
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-104 · **Parallélisable** : [P]
- **SC couverts** : SC-012 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/lib/revision.ts`
  - `tests/unit/revision.test.ts`
- **Critères d’acceptation**
  1. `reverifierAction` passe `config` à `exemplairesAttendus` (le `void config` disparaît) : une pose de thème ou d’échange est `passee` si l’étiquette n’est plus attendue sur cet exemplaire selon la collection et la `Config` fournies à cet instant (SC-012).
  2. Un retrait est `passee` si l’étiquette est de nouveau attendue ou si le couple n’est plus au registre.
  3. Une création est `ok` tant qu’au moins un exemplaire attend le nom.
  4. Test croisé : pour une même carte et la même `Config`, tout nom produit par `construireLot` est jugé `ok` par `reverifierAction` (H12).
- **Tests attendus**
  - `tests/unit/revision.test.ts` (extension) : AC1 à AC4 ; l’attente existante « Ami · Zoé » est remplacée par « #À échanger Zoé ».
- **Brief de contexte**
  - *Pourquoi* : la revérification juste avant chaque requête ne doit jamais diverger du lot.
  - *État actuel* : `src/lib/revision.ts` l.45-70 : `config` ignoré (`void config`), cas `pose-etiquette` / `retrait-etiquette` / `creation-etiquette` appellent `exemplairesAttendus(carte)`.
  - *À faire* : passer `config` ; rien d’autre ne change (revérification : l’état actuel décide, pas le delta depuis l’aperçu).
  - *Contrats* : `CONFIG_LOT` de `Synchronisation.tsx` doit recevoir les amis stockés à cet instant (voir T-108).
  - *Pièges* : une `Config` sans `amis` ne doit pas rendre « passées » les poses de thème ; seules les étiquettes d’échange dépendent des amis.
  - *Vérifier* : `npx vitest run tests/unit/revision.test.ts tests/unit/lot-etiquettes.test.ts && npm run check`

## T-106 — Regroupement d’aperçu, totaux et durée
- **Couche** : logique · **Agent** : dev-core
- **Dépend de** : T-104 · **Parallélisable** : [P]
- **SC couverts** : SC-014 (logique), SC-016, SC-017 · **Règles design** : DT-07, DT-09
- **Fichiers concernés** (liste fermée) :
  - `src/lib/apercuEtiquettes.ts` (créé)
  - `tests/unit/apercu-etiquettes.test.ts` (créé)
- **Critères d’acceptation**
  1. `regrouperEtiquettes(collection, registre, config)` renvoie des lignes `{ nom, cartes, exemplaires, nouvelle, genre }` regroupées par nom (`genre` : statut, échange, thème), ordonnées Statut, échanges, thèmes du plus précis au plus général, puis par libellé (DT-07).
  2. Totaux : poses prévues, dont thèmes et échanges, nombre de noms nouveaux (absents du registre), durée en minutes = ⌈requêtes × 6 s / 60⌉, formulée « H h M min » au-delà d’une heure (DT-09, SC-016) ; même quand aucun type d’étiquette n’est disponible.
  3. `nonPosees` du lot (homonyme, nom trop long, au-delà de la limite du site) est exposé avec carte et raison.
  4. Aucune ligne si aucune étiquette n’est attendue ; au plus 100 lignes retournées pour l’affichage, avec le nombre restant.
  5. 5 000 cartes, 20 amis × 10 thèmes : calcul < 500 ms (SC-017).
  6. Le calcul est pur : aucun appel à `chrome.*`, aucune lecture du jeton.
- **Tests attendus**
  - `tests/unit/apercu-etiquettes.test.ts` : AC1 à AC6.
- **Brief de contexte**
  - *Pourquoi* : l’aperçu doit montrer ce qui serait posé et son volume avant « Lancer » (G5), même sans envoi possible.
  - *État actuel* : `Synchronisation.tsx` expose `dureeMinutes` (l.116) et `totauxParType` ; rien ne regroupe les étiquettes par nom. `lot.ts` (T-104) fournit `exemplairesAttendus`.
  - *À faire* : fonction pure + types exportés ; réutiliser la formule de durée (6 s) sans importer `Synchronisation.tsx` (dupliquer la constante est interdit : l’exporter depuis ce module serait un fichier hors liste ; recopier la formule dans `apercuEtiquettes.ts` avec un test d’égalité à `dureeMinutes`).
  - *Contrats* : spec SC-014 à 016 ; H11 (le volume de poses et retraits dus à un changement de taxonomie est visible).
  - *Pièges* : un exemplaire non relié n’est pas compté ; une carte `idsSite` en conflit est écartée comme dans le lot.
  - *Vérifier* : `npx vitest run tests/unit/apercu-etiquettes.test.ts && npm run check`

## T-107 — Amis initiaux : fusion automatique (Benjamin, Anatole)
- **Couche** : données · **Agent** : dev-core
- **Dépend de** : T-103 · **Parallélisable** : [P]
- **SC couverts** : SC-024 · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `src/config/amis.ts` (créé)
  - `src/lib/stockage.ts`
  - `tests/unit/stockage.test.ts`
- **Critères d’acceptation**
  1. `src/config/amis.ts` exporte `AMIS_INITIAUX: Ami[]` (Benjamin : `barrage`, `tibet` ; Anatole : `ukraine`) et `VERSION_AMIS_INITIAUX = 1`.
  2. `chargerPreferences()` : si le drapeau `amisInitiaux` du stockage est absent ou inférieur à `VERSION_AMIS_INITIAUX`, applique `fusionnerAmisInitiaux` aux préférences lues (ou aux valeurs par défaut si aucune), écrit **en une seule opération** les préférences fusionnées et le drapeau, puis les renvoie.
  3. Drapeau à jour : les préférences sont renvoyées telles que stockées, sans fusion (un thème décoché n’est pas rajouté).
  4. Préférences illisibles : valeurs par défaut en mémoire, rien n’est écrit ni écrasé.
  5. Un échec d’écriture renvoie quand même les préférences fusionnées en mémoire et ne pose pas le drapeau.
  6. `AMIS_INITIAUX` n’est importé que par `stockage.ts`.
- **Tests attendus**
  - `tests/unit/stockage.test.ts` (extension, `chrome.storage` simulé) : AC1 à AC6 avec préférences vides, existantes avec Benjamin partiel, avec un ami « benjamin » en minuscules, et avec un thème décoché après fusion.
- **Brief de contexte**
  - *Pourquoi* : Alexis veut que Benjamin aime les barrages et le Tibet et Anatole l’Ukraine, ajoutés automatiquement (2026-11-09).
  - *État actuel* : `stockage.ts` `chargerPreferences` (l.125-128) appelle `lirePreferences` ; `enregistrerPreferences` écrit sous la clé `preferences`.
  - *À faire* : clé séparée pour le drapeau (les `Preferences` `version: 2` ne changent pas) ; utiliser `fusionnerAmisInitiaux` de T-103. Ne pas modifier `preferencesParDefaut`.
  - *Contrats* : `chrome.storage` confiné à `stockage.ts` ; fichier de réglages d’Alexis comme `src/config/prix.ts`.
  - *Pièges* : plusieurs appels simultanés à `chargerPreferences` (App et Synchronisation) : la fusion est idempotente, pas de double ami ; ne jamais écraser une donnée illisible.
  - *Vérifier* : `npx vitest run tests/unit/stockage.test.ts tests/unit/tri.test.ts && npm run check`

## T-108 — UI : « Étiquettes prévues » dans l’aperçu
- **Couche** : ui · **Agent** : dev-ui
- **Dépend de** : T-105, T-106, T-107 · **Parallélisable** : —
- **SC couverts** : SC-014, SC-015, SC-016, SC-019 · **Règles design** : DT-01 à DT-14
- **Fichiers concernés** (liste fermée) :
  - `src/app/EtiquettesPrevues.tsx` (créé)
  - `src/app/Synchronisation.tsx`
  - `src/app/App.tsx`
  - `tests/unit/etiquettes-prevues.test.ts` (créé)
- **Critères d’acceptation**
  1. Dans l’aperçu, après les totaux et avant « Cartes non incluses » et « Lancer », une section « Étiquettes prévues (envoi pas encore possible) » liste chaque nom attendu avec cartes, exemplaires et état (« nouvelle · non disponible » / « non disponible ») selon DT-05 à DT-07 (SC-014).
  2. Total prévu avec poses de thème et d’échange, noms nouveaux et durée « une fois disponible » (DT-09) ; `details` « Étiquettes non posées (N) » avec raisons (DT-08) (SC-016).
  3. L’avertissement de visibilité (texte exact de DT-04) précède « Lancer » dans l’ordre du document dès qu’une étiquette est attendue, et est absent sinon (SC-015).
  4. Ces actions ne comptent pas dans « Lancer les N actions » ; 0 requête et jeton non lu pendant l’ouverture et la consultation.
  5. `Synchronisation` reçoit `preferences` (via `App.tsx`) et construit la `Config` du lot à partir de ses amis, y compris pour la revérification de `contexteExecution` (lue au moment de l’exécution).
  6. Rendu texte seul (nom d’ami de 300 caractères avec retour à la ligne), `summary` ≥ 44 px, tableau avec `th scope="col"`, listes à 375 px sans perte de contenu, aucune classe de couleur hors tokens (SC-019).
- **Tests attendus**
  - `tests/unit/etiquettes-prevues.test.ts` (rendu serveur React) : AC1 à AC3, AC6. L’e2e est en T-109.
- **Brief de contexte**
  - *Pourquoi* : rendre visibles, avant tout envoi, les étiquettes d’échange et de thème et leur volume (G5).
  - *État actuel* : `Synchronisation.tsx` : `CONFIG_LOT` constant (l.323-327) utilisé pour la revérification (l.353), `preparerLot` avec une `Config` figée (l.198-212), section d’aperçu l.800-925, `Props` l.560-578. `App.tsx` : état `preferences` (l.56) et montage de `<Synchronisation>` (l.227).
  - *À faire* : composant `EtiquettesPrevues` pur sur les sorties de T-106 ; insérer ; remplacer `CONFIG_LOT` par une fabrique `configDuLot(preferences)` ; `contexteExecution` relit `chargerPreferences()` au moment de la revérification. Ne pas ajouter de token, ne pas modifier `tokens.css` (DT-01).
  - *Contrats* : design.md DT-01 à DT-14 ; D-34 (jamais `text-muted` sur `bg-line`) ; D-41 ; AGENTS.md (pas de `innerHTML`).
  - *Pièges* : `Synchronisation.tsx` fait 956 lignes : n’y mettre que le câblage ; l’aperçu est figé à l’ouverture (H24), les préférences lues à ce moment-là ; les noms d’amis sont libres.
  - *Vérifier* : `npx vitest run tests/unit/etiquettes-prevues.test.ts tests/unit/synchronisation.test.ts && npm run check && npm run build`

## T-109 — E2e et captures
- **Couche** : tests · **Agent** : dev-test
- **Dépend de** : T-108 · **Parallélisable** : [P]
- **SC couverts** : SC-014, SC-015, SC-017, SC-019, SC-020 · **Règles design** : DT-03 à DT-14
- **Fichiers concernés** (liste fermée) :
  - `tests/e2e/etiquettes.spec.ts` (créé)
  - `tests/e2e/fixtures/collection-etiquettes.json` (créé)
- **Critères d’acceptation**
  1. Collection fictive (cartes chien, pont, Tibet, Ukraine, barrage, statut `echanger` avec amis Léa et Hugo) : l’aperçu liste « #Chien », « #Animaux », « #À échanger Léa » et « Statut · Échanger » avec les bons nombres ; l’état est « nouvelle · non disponible » (SC-014).
  2. 0 requête vers le site (toute autre requête est bloquée) et jeton non lu pendant l’ouverture et la consultation (SC-014).
  3. Avertissement de visibilité présent avant « Lancer » avec une étiquette attendue, absent sans (SC-015).
  4. `details` « Étiquettes non posées » utilisable au clavier ; nom d’ami de 300 caractères sans défilement horizontal à 375 px (SC-019).
  5. Captures à 375, 768 et 1280 px, thèmes clair et sombre, dans `test-results/captures/` ; `prefers-reduced-motion` : aucune animation.
  6. L’aperçu s’affiche en moins de 500 ms après le clic pour 5 000 cartes fictives (SC-017) ; l’export CSV contient les nouveaux libellés (SC-020).
- **Tests attendus**
  - `tests/e2e/etiquettes.spec.ts` : AC1 à AC6 (contexte via `tests/e2e/extension.ts`).
- **Brief de contexte**
  - *Pourquoi* : prouver le comportement dans l’extension chargée et produire les captures de la PR UI.
  - *État actuel* : `tests/e2e/extension.ts` (contexte), `assistant.spec.ts` et `extension.spec.ts` montrent le motif ; les fixtures existantes sont dans `tests/e2e/fixtures/`.
  - *À faire* : amorcer le stockage avec la collection et les préférences fictives (G2), ouvrir l’aperçu, vérifier. Aucun test ne contacte le vrai site.
  - *Contrats* : AGENTS.md (e2e Playwright, données fictives, pas de `captures-site/`).
  - *Pièges* : l’aperçu exige un onglet WikiMasters pour « Lancer », pas pour être consulté ; mesurer le temps côté page.
  - *Vérifier* : `CI=1 npm run test:e2e`

## T-110 — Documentation
- **Couche** : docs · **Agent** : dev-core
- **Dépend de** : T-108 · **Parallélisable** : [P]
- **SC couverts** : — (cohérence des documents) · **Règles design** : —
- **Fichiers concernés** (liste fermée) :
  - `AGENTS.md`
  - `README.md`
- **Critères d’acceptation**
  1. `AGENTS.md` § Architecture mentionne les étiquettes de thème et d’échange (« #À échanger <nom> » remplace « Ami · <nom> »), `src/lib/apercuEtiquettes.ts`, `src/config/amis.ts` et le registre v2.
  2. `README.md` décrit en deux phrases ces étiquettes et le fait qu’elles ne sont pas envoyées tant que le contrat des étiquettes n’est pas relevé.
  3. Aucune règle du cadre WikiMasters n’est modifiée.
- **Tests attendus**
  - Aucun nouveau test : les preuves sont `git diff` et `npm run check`.
- **Brief de contexte**
  - *Pourquoi* : AGENTS.md est la constitution du dépôt ; elle doit décrire les modules ajoutés.
  - *État actuel* : AGENTS.md § Architecture ne cite pas `lot.ts` ni le registre.
  - *À faire* : ajouter deux ou trois puces, sans toucher aux sections « Cadre d’usage » et « Ne jamais faire ».
  - *Contrats* : français, typographie française.
  - *Pièges* : ne pas inscrire de donnée réelle du compte ; ne pas toucher à `specs/synchro-complete/` (le remplacement de « Ami · … » y est consigné par `spec.refined.md`).
  - *Vérifier* : `npm run check`

## T-901 à T-904 — Retouches de revue (faites)
- **T-901** (#35), **T-902** (#36), **T-903** (#46) : performance (SC-017), mergées.
- **T-904** (retouches des mineurs de revue) :
  1. `tests/unit/lot.test.ts` : le titre « longueur inconnue (null) » dit désormais que seul le plafond du registre, 200, s’applique.
  2. `src/lib/lot.ts` : `EtiquettesCarte` en `readonly string[]`, interface et `WeakMap` remontées au-dessus de la fonction.
  3. `src/app/EtiquettesPrevues.tsx` : « (envoi pas encore possible) », « non disponible » et « une fois disponible » dépendent de la prop `disponible` (défaut : `false`, tests existants inchangés).
  4. `tests/unit/tri.test.ts` : fusion d’un ami initial saisi en minuscules (« benji »).
  5. `tests/unit/stockage.test.ts` : prénoms fictifs (Benji, Anna) par `vi.mock` de `src/config/amis.ts` ; les vrais prénoms restent dans le seul fichier de réglages (G2).
- **Vérifier** : `npm run check && npm run build`
