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
- Une page au-delà de la dernière renvoie 200 avec `collection: []` (fin de parcours fiable).
- Le site appelle aussi `/api/notifications` et `/api/trades?active=1` à chaque chargement.

## Prix du marché : **bloqué**
- Le site lit l'historique des ventes par `GET /api/marketplace/cards/<card_id>/sales`.
- Ce point renvoie **403** `pro_required` (« La vue du marché est réservée aux comptes PRO ») pour le compte d'Alexis. Un seul appel a été fait ; il ne doit pas être répété (403 = arrêt immédiat de la file).
- La « valeur marchande » affichée dans la fenêtre « Mettre aux enchères » vient donc d'une autre source, **non relevée** (la fenêtre n'a pas été ouverte : elle ne se consulte pas sans geste sur le site). À relever avec un relevé réseau pendant l'ouverture de cette fenêtre.
- Si la valeur n'est lisible que par un compte PRO, la synchro du prix du marché est impossible sans PRO : l'extension garde alors la saisie à la main et le repli par rareté (`src/config/prix.ts`).
