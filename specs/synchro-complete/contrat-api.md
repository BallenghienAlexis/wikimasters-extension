# Contrat de l'API du site (synchro-complete)

Résumé de la capture réelle faite par Alexis le 2026-11-07 (brute dans `captures-site/lecture-collection.md`, dossier ignoré par git). Aucun cookie, jeton, en-tête ni valeur de carte ici. Tout ce qui n'est pas listé est **inconnu et ne doit pas être deviné** ; il reste à relever (voir « Reste à relever »).

Origine de l'onglet : `https://www.wiki-masters.com`.

## Lectures (capturées)
| Méthode | Chemin | Remarque |
|---|---|---|
| GET | `/api/my-collection?sort=rarity&page=N&stats=0` | `page` part de 0 |
| GET | `/api/my-collection/stats?sort=rarity` | |
| GET | `/api/marketplace/mine` | `{ sellingCount, maxConcurrentAuctions }` ; limite du site : 5 enchères simultanées |
| GET | `/api/marketplace/<id>` | relu par le site après une mise aux enchères |

## Écritures (capturées)
| Action | Méthode et chemin | Corps | Réponse |
|---|---|---|---|
| Créer une étiquette | `POST /rest/v1/tags?select=…` | `{ user_id: string, name: string, color: string }` | 201 |
| Lier l'étiquette à une carte | `POST /rest/v1/user_card_tags` | `{ user_card_id: string, tag_id: string }` | 201 |
| Retirer l'étiquette d'une carte | `DELETE /rest/v1/user_card_tags` | aucun ; filtre en query (**non relevé**) | 204 ; l'étiquette `tags` n'est pas supprimée |
| Mettre aux enchères | `POST /api/marketplace` | `{ card_id: string, base_amount: number, duration_minutes: number }` | 201 |
| Défausser | `POST /api/user-cards/<user_card_id>/discard` | aucun | 200 |

- Durées d'enchère proposées par le site : 10 min, 30 min, 1 h, 3 h, 6 h, 12 h ; mise de départ par défaut : 10.
- `user_card_id` (exemplaire possédé) est le même identifiant pour l'étiquette et la défausse. `card_id` de l'enchère (relevé 2026-11-11) : identifiant de la carte (`card_id` de `my-collection`, ≠ `user_card_id`) ; l'enchère part de l'origine du site, cookies de session, seul en-tête `content-type` (aucun en-tête d'authentification), réponse 201 `{ auction_id }`. Défausse : même authentification supposée (cookies de même origine), **non rejouée en réel** (décision d'Alexis du 2026-11-11 : pas de test, valeur > 5 à éviter).
- Le site demande une confirmation côté interface avant la défausse (dernière copie : retrait définitif, 1 wikibidou rendu).
- Après une défausse, le site appelle `POST /rest/v1/rpc/get_my_profile` (solde).
- Une enchère n'était plus active quelques minutes après sa création (annulée) ; l'appel d'annulation n'est pas capturé : **l'extension ne l'émet pas** (« non annulable par l'extension »).

## Authentification
- `/rest/v1/...` (étiquettes) : API de type REST authentifiée par le jeton de session du site ; hôte exact non relevé (SC-002 (d) à vérifier : même origine que l'onglet ?).
- `/api/...` : mécanisme **non relevé** (cookies de même origine ou jeton).
- Décision d'Alexis (option B, 2026-11-07) : lecture en mémoire du jeton de session autorisée dans un seul module, au moment d'émettre la requête, sans jamais le stocker, le journaliser, l'afficher ni l'envoyer hors de l'origine du site (AGENTS.md « Ne jamais faire »).

## Étiquettes — relevé du 2026-11-11 (captures d'Alexis, en-têtes de réponse seulement)
- **Hôte** : `https://cyrxjeppjqsxxjayfrur.supabase.co/rest/v1/` (projet Supabase du site, **autre origine** que `https://www.wiki-masters.com`). Réponses derrière Cloudflare, `Content-Profile: public`.
- **CORS** : `Access-Control-Allow-Origin: https://www.wiki-masters.com` : un `fetch` depuis un onglet du site est accepté ; l'origine de l'extension ne le serait pas.
- **Pose** : `POST /rest/v1/user_card_tags` → `201 Created`, `Content-Length: 0` (**corps de réponse vide** : rien à valider ni à lire).
- **Retrait** : `DELETE /rest/v1/user_card_tags?user_card_id=eq.<user_card_id>&tag_id=eq.<tag_id>` → `204 No Content`. **Filtre relevé** : les deux conditions `eq.`, valeurs encodées.
- **Lecture vue au passage** : `GET /rest/v1/cards?select=summary&id=eq.<card_id>` → 200, `{"summary":null}` (format PostgREST, `application/vnd.pgrst.object+json`). Non utilisée par l'extension.
- Le jeton est un JWT signé ES256 émis par `…/auth/v1` (en-têtes `Sb-Jwt-*` de la réponse).
- **En-têtes de requête du `POST user_card_tags` (noms, relevé du 2026-11-11)** : `apikey` (clé anonyme publique du projet), `authorization: Bearer <jeton de session>` (JWT expirant en environ 1 h : 401 attendu à l'expiration), `content-profile: public`, `content-type: application/json`, `accept`. **Corps confirmé** : `{ user_card_id: <uuid>, tag_id: <uuid> }`, rien d'autre.
- **Session (relevé du 2026-11-11, noms et forme seulement)** : cookie `sb-cyrxjeppjqsxxjayfrur-auth-token`, **découpé en deux morceaux** `….0` et `….1` à concaténer ; valeur = préfixe `base64-` puis JSON encodé en base64 avec les champs `access_token`, `token_type`, `expires_in`, `expires_at`, `refresh_token`, `user`. L'extension n'extrait que `access_token` (jamais `refresh_token` ni `user`) ; expiration ≈ 1 h : jeton expiré, arrêt propre sans rafraîchissement. À vérifier : le cookie est-il lisible par `document.cookie` (pas HttpOnly) ?
- **Création d'étiquette (relevé du 2026-11-11, noms seulement)** : réponse = un objet avec les champs `id` (UUID de l'étiquette), `user_id`, `name`, `created_at`, `color` (`#rrggbb`). Le corps de requête `{ user_id, name, color }` a été relevé le 2026-11-07. L'en-tête `Prefer: return=representation` et la forme exacte (objet ou tableau d'un élément) sont à confirmer au premier essai ; une réponse hors contrat arrête le lot.
- **Toujours non relevé** : limites de nombre et de longueur, code d'erreur d'un nom en double, cookie lisible par `document.cookie` (à confirmer au premier essai). Visibilité : supposée visible des autres joueurs (décision d'Alexis du 2026-11-11).

## Reste à relever (SC-001)
Mode d'authentification de `/api/` (étiquettes : relevées le 2026-11-11), bornes de `base_amount`, forme des erreurs (401, 403, 429), limites de nombre et de longueur des étiquettes.
