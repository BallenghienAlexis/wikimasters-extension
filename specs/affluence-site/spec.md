# Affluence : relevé automatique de l’activité du site

## Besoin (Alexis, 2026-11-11)
Les créneaux d’affluence doivent se mettre à jour automatiquement avec l’analyse d’affluence du **site**, pas seulement avec ses propres ventes. Suite de `specs/affluence`.

## Décision d’Alexis
« J’autorise les requêtes get » (2026-11-11) : `GET` en lecture seule vers une route de listing du marché. Risque de bannissement rappelé et assumé. Inscrite dans AGENTS.md.

## Route
Route relevée par Alexis le 2026-11-11 : `GET /api/marketplace?page=1&limit=50&sort=recent&mine=1`, réponse `{ auctions: [...] }`, champ `created_at` (ISO) ; `end_at` donne la fin (non retenu). Chaque annonce contient aussi le vendeur : jamais conservé. Réserve : `mine=1` limite peut-être le listing à ses propres enchères ; si l’histogramme ne reflète que ses ventes, retirer ce paramètre dans la config.

Historique : la route n’était pas relevée à l’origine. Elle se règle dans `src/config/affluence.ts` (`routeMarche`, `null` avant le relevé du 2026-11-11 : fonction inerte). Elle doit commencer par `/api/marketplace` ; l’historique des ventes (`/sales` sans `scope=summary`, réservé PRO) est refusé. Relevé à faire par Alexis : page Marché, F12, onglet Réseau, noter l’URL du listing et le champ d’horodatage d’une annonce (`champsHorodatage`).

## Comportement
- Dans la synchronisation automatique (activée par défaut depuis le 2026-11-11), après la synchro et si aucun arrêt : une requête vers `routeMarche`, 0,2 s après la précédente (6 s avant le 2026-11-12), au plus toutes les 30 min (le déclenchement existant), comptée dans le budget commun.
- 401, 403, 429 : pause de 30 min, rien n’est retenu.
- Seuls les horodatages des annonces sont conservés (liste blanche de champs) : clé `affluenceSite`, 2 000 au plus, sans doublon. Aucun joueur, carte ni montant.
- Les relevés du site et les ventes du joueur alimentent ensemble l’histogramme 7 × 24 ; au-delà de 20 observations, les heures fortes sont déduites (top 25 %, au moins 2 évènements par créneau) à la place des créneaux par défaut.

## Critères
- SC-1 : sans route, aucune requête vers le marché.
- SC-2 : avec une route valide, un seul GET, 0,2 s après la précédente, horodatages seuls notés.
- SC-3 : 403 → rien noté, reprise repoussée de 30 min.
- SC-4 : route hors marché ou historique complet des ventes refusée.
- SC-5 : stockage versionné, borné, sans doublon ; valeur illisible ignorée.
