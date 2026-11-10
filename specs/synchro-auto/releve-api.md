# Relevé de l'API du site (lecture) — synchro-auto

Relevé fait le 2026-11-09 dans Chrome, onglet `https://www.wiki-masters.com/collection`, par lecture du trafic réseau de la page et trois `GET` en lecture seule. Aucun cookie, jeton ni identifiant réel n'est consigné ici : formes seulement. Aucune écriture, aucun clic de confirmation.

## Authentification
- `/api/*` : **cookies de même origine** (`fetch(url, { credentials: 'same-origin' })` suffit, aucun en-tête ajouté). **Le jeton n'est donc pas nécessaire pour lire** : `jeton.ts` n'est pas concerné par la synchro de lecture.
- `/rest/v1/*` (étiquettes, profil) : hôte **différent** du site, un projet Supabase (`*.supabase.co`), avec un jeton JWT. À éviter pour la lecture (voir ci-dessous).

## Lectures utiles
| GET | Réponse (forme) |
|---|---|
| `/api/my-collection/stats?sort=rarity` | `{ total, totalUnique, rarityCounts: { C, R, PC, SR, UR, L }, tagOptions: [{ id, user_id, name, color, created_at, cardCount }] }` |
| `/api/my-collection?sort=rarity&page=N&stats=0` | `{ collection: [ … ≤ 50 ], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] }` |
| `/api/marketplace/mine` | `{ sellingCount, maxConcurrentAuctions }` |

Élément de `collection` : `{ id (= user_card_id), card_id, count, starred, is_shiny, obtained_at, user_id, tags: [{ id, name, color, user_id, created_at }], card: { id, atk, def, lang, rarity, q_score, category, image_url, pageviews, created_at, hide_image, wikipedia_url, wikipedia_title } }`.

Constats :
- **Les étiquettes de chaque exemplaire sont dans `my-collection`** (`tags`), et la liste de toutes les étiquettes avec leur nombre de cartes est dans `stats` (`tagOptions`). **Aucune lecture de `/rest/v1/tags` ni de `user_card_tags` n'est nécessaire** : la synchro des étiquettes se fait avec les mêmes requêtes que la collection, sans toucher à l'hôte Supabase.
- `id` (exemplaire) ≠ `card_id` : le lien est donc connu, ce qui règle l'inconnue « `card_id` ↔ `user_card_id` » de `contrat-api.md`.
- `starred` correspond au favori du site ; `pendingTradeCardIds` liste les cartes engagées dans un échange.
- Collection d'Alexis le jour du relevé : 6 675 exemplaires, 6 668 cartes distinctes → **134 pages** de 50. À 6 s par requête, une lecture complète dure environ **14 minutes** ; d'où l'intérêt du mode incrémental (`stats` d'abord, 1 requête).
- Le paramètre `page` **commence à 0** (vérifié en direct) ; chaque page compte 50 éléments au plus. Une page hors limites (au-delà de la dernière) renvoie 200 avec `collection: []` (fin de parcours fiable).
- Le site appelle aussi `/api/notifications` et `/api/trades?active=1` à chaque chargement.

## Prix du marché : **débloqué** (relevé du 2026-11-09, fenêtre « Mettre aux enchères » ouverte puis annulée)
- Source : `GET /api/marketplace/cards/<card_id>/sales?scope=summary` (un appel par **carte**, `card_id` et non l'identifiant d'exemplaire ; la fenêtre l'émet à l'ouverture, avec `GET /api/marketplace/mine`).
- Réponse : `{ wikipedia_title, summary: { <rareté>: { average: number } }, isPro: boolean }`. Exemple de forme : `summary: { L: { average: 276 } }`. `average` est la valeur marchande de la fenêtre.
- **Sans PRO, `scope=summary` répond 200** ; la même route sans `scope=summary` répond 403 `pro_required` (historique complet). L'extension n'utilise donc que `?scope=summary`.
- Plusieurs raretés possibles dans `summary` : le validateur lit la clé de la rareté de l'exemplaire et ignore le reste.
- Coût : une requête par carte (6 668 cartes distinctes) ; à 6 s l'une, impossible en une fois. Le relevé se fait par ordre de priorité (cartes à vendre ou à décider d'abord, valeur absente ou périmée), jamais en rafale.
