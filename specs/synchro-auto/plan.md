# Plan — Synchronisation automatique

Entrées : `spec.refined.md`, `design.md`, `releve-api.md`.

## Architecture
- **Approche (option A)** : un exécuteur dans le content script, sur toute page `wiki-masters.com`, lit l'API en `GET` même origine (`fetch(url, { credentials: 'same-origin' })`), sans en-tête ajouté et **sans lire le jeton** (`jeton.ts` n'est pas concerné). Ordre : `stats` → pages de `my-collection` → `sales?scope=summary` par carte à relever.
- **Incrémental** : si `stats.total` et le nombre d'étiquettes sont inchangés depuis la dernière synchro complète, seule la requête `stats` part. Sinon on relit les pages ; les pages sont lues en `sort=added` (plus récent d'abord) avec arrêt anticipé quand seules de nouvelles cartes arrivent ; sinon relecture complète (≈ 14 min pour 134 pages).
- **Données** : `my-collection` fournit déjà `id` (exemplaire), `card_id`, `starred`, `count`, `tags` ; `stats.tagOptions` fournit la liste des étiquettes. Rien d'autre à lire pour les étiquettes.
- **Prix** : `sales?scope=summary` → `summary.<rareté>.average` → `valeurMarchande` ; jamais la route sans `scope=summary` (403 PRO).
- **Ordonnanceur unique** : une file, une requête en vol, 6 s entre deux requêtes, 10 par fenêtre de 60 s (constantes de `file.ts`), arrêt immédiat sur 401/403/429, 3 échecs, aucune reprise avant 30 min. Un bail dans `chrome.storage.local` (horodatage, expiration) évite deux synchros dans deux onglets.
- **Déclencheurs** : chargement d'une page du site, puis minuteur de 30 min tant que l'onglet est visible (`visibilitychange`), seulement si l'option est activée et la dernière synchro a plus de 30 min.
- **Fichiers** : créés `src/lib/lectureApi.ts`, `src/lib/ordonnanceur.ts`, `src/lib/ecarts.ts`, `src/content/synchroAuto.ts`, `src/app/SynchroAuto.tsx` ; modifiés `src/lib/collection.ts` (étiquettes du site, migration), `src/lib/stockage.ts`, `src/content/index.ts`, `src/app/App.tsx`, `AGENTS.md`, `README.md`.
- **Flux** : `index.ts` → `synchroAuto` → `ordonnanceur` (horloge et transport injectés) → `lectureApi` (validation) → `fusionnerDansStockage` → page de gestion (écoute du stockage).
- **Alternatives écartées** : service worker + cookies + `chrome.alarms` (exige `host_permissions`/`cookies`, hôte non autorisé) ; onglet de fond automatique (seconde spec) ; lecture de `/rest/v1/tags` (hôte Supabase tiers, inutile).
- **Contraintes** : permission `storage` seule ; aucun `host_permissions` ; schéma de stockage versionné avec migration ; `click`, `submit`, `dispatchEvent`, `focus` toujours interdits ; tests sans contact avec le vrai site.

## 1. Task list
| Lot | Description | Couche | Dépend de | SC | D-xx |
|---|---|---|---|---|---|
| L1 | Validation et conversion des réponses (`lectureApi.ts`) | logique | — | SC-010, SC-012, SC-013 | — |
| L2 | Schéma : étiquettes du site, préférence, horodatages, bail ; migration | données | — | SC-007, SC-009, SC-012 | — |
| L3 | Ordonnanceur (cadence, budget, arrêts, incrémental, bail) | logique | L1, L2 | SC-003, SC-004, SC-005, SC-006, SC-008, SC-013 | — |
| L4 | Écarts d'étiquettes (`ecarts.ts`) | logique | L2 | SC-014 | — |
| L5 | Exécuteur du content script et déclencheurs | infra | L3 | SC-002, SC-007 | — |
| L6 | Interface : interrupteur, état, écarts, journal | ui | L4, L5 | SC-002, SC-014 | D-01 à D-03 |
| L7 | E2e sur site fictif et captures | tests | L6 | SC-002 à SC-007 | D-01 |
| L8 | `AGENTS.md`, `README.md` | docs | L7 | — | — |

## 2. Estimations
| Lot | Heures |
|---|---|
| L1 | 3 |
| L2 | 3 |
| L3 | 6 |
| L4 | 2 |
| L5 | 4 |
| L6 | 4 |
| L7 | 4 |
| L8 | 1 |
| **Total** | **27** |

## 3. Risques
| Lot | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| L3/L5 | Bannissement lié à une lecture automatique (`/api/` en `Disallow`) | moyenne | élevé | Risque assumé par Alexis ; option désactivée par défaut ; cadence fixe ; arrêt immédiat sur 401/403/429 ; budget commun |
| L3 | Tri instable entre deux lectures : une page décalée fait rater une carte | moyenne | moyen | Relecture complète si le total change ; arrêt anticipé seulement si le total a augmenté, les étiquettes sont inchangées et l'écart est expliqué par la lecture |
| L5 | Un seul onglet à la fois, onglet en arrière-plan ralenti par Chrome | élevée | faible | Bail, minuteur tolérant, état « en attente » affiché |
| L1 | Forme des réponses modifiée par le site | moyenne | moyen | Validation stricte, carte ignorée et journalisée (SC-010) |
| L3 | 6 668 prix à relever, trop long | élevée | moyen | Priorité (à décider, valeur absente ou périmée), reprise à la synchro suivante |

## 4. Ordre d'exécution
- Vague 1 (parallèle) : L1, L2.
- Vague 2 (parallèle) : L3, L4.
- Vague 3 : L5.
- Vague 4 : L6.
- Vague 5 : L7. Vague 6 : L8.
- Chemin critique : L2 → L3 → L5 → L6 → L7.

## 5. Quick wins vs long terme
- **Quick wins** : L1 + L3 + L5 en lecture seule donnent déjà la collection à jour sans navigation.
- **Long terme** (nouvelle spec) : onglet de fond ouvert par `chrome.alarms` ; correction automatique des écarts d'étiquettes (écriture, `synchro-complete`) ; relevé de la fin d'enchère.
