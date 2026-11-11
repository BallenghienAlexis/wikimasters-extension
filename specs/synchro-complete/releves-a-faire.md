# Relevés réseau à faire sur le PC d’Alexis (écriture sur le site)

Décision d’Alexis du 2026-11-11 : l’écriture est autorisée, les relevés sont faits par Claude, sans manipulation de sa part. **Aucune valeur secrète n’est consignée** : ni cookie, ni jeton, ni clé d’API, ni identifiant réel. On note des formes (`<uuid>`, `<jwt>`), des noms d’en-têtes, des statuts, des bornes.

## Moyen d’accès
Une session Chrome pilotable sur le PC d’Alexis, onglet connecté à `https://www.wiki-masters.com` (outils `mcp__claude-in-chrome__*` : `read_network_requests`, `javascript_tool`, `navigate`, `computer`) ou, à défaut, DevTools via le MCP navigateur de l’app. Le fil doit seulement lire le trafic, jamais copier de valeur d’en-tête d’authentification dans un fichier ou un message.

## R1. Authentification de `/api/` en écriture
- Page `/collection`, ouvrir « Mettre aux enchères » sur **une carte de test à très bas prix** (ou une carte en double sans valeur) et valider avec le plus petit prix et la durée la plus courte, puis noter la requête `POST /api/marketplace`.
- Noter : noms des en-têtes présents (pas leurs valeurs), `content-type`, présence d’un en-tête CSRF/`x-*`/`authorization`, `origin`/`referer`, corps exact (clés et types), statut (201), forme de la réponse (clés).
- Question à trancher : les cookies de même origine suffisent-ils ? (rejouer un `fetch` même origine sans en-tête ajouté depuis la console sur une carte de test et noter le statut).

## R2. Bornes et erreurs de l’enchère
- Bornes de `base_amount` (min, max) et de `duration_minutes` (valeurs acceptées) : lire le formulaire et provoquer une erreur de validation (prix 0, très grand) ; noter statut et forme de l’erreur.
- Lien `card_id` ↔ `user_card_id` (déjà connu : `id` ≠ `card_id`) : quel identifiant l’enchère attend-elle ? Noter lequel est envoyé.
- Erreurs 401, 403, 429 : forme de la réponse si obtenues (ne pas les provoquer volontairement).
- Appel d’annulation d’une enchère (nom de route) : à noter si le site l’émet à l’annulation ; l’extension ne l’émettra pas.

## R3. Défausse
- Défausser **une carte en triple ou sans valeur** choisie par Alexis (action irréversible : demander l’accord d’Alexis sur la carte avant, dans le bloc « Ce dont j’ai besoin de toi »).
- Noter : `POST /api/user-cards/<id>/discard`, en-têtes (noms), corps (aucun ?), statut, forme de la réponse, appels qui suivent (`rpc/get_my_profile`).

## R4. Étiquettes (hôte Supabase)
- Créer une étiquette de test, la poser, la retirer depuis `/collection`.
- Noter : **hôte exact** (`<projet>.supabase.co`), chemin, méthode, **noms** des en-têtes (`apikey`, `authorization`, `content-profile`, `prefer`…), où se trouve le jeton (cookie, `localStorage`, `sessionStorage` : nom de la clé seulement) et la clé d’API publique (nom de l’endroit, jamais la valeur), corps, statut, forme des réponses (`return=representation` : identifiants renvoyés).
- Filtre exact du `DELETE /rest/v1/user_card_tags` (paramètres de requête, `<uuid>` en forme), et si l’étiquette `tags` est supprimée ou non.
- Limites : longueur maximale d’un nom, nombre d’étiquettes par exemplaire et par compte (provoquer l’erreur sur le compte de test), unicité des noms (erreur 409 ?), couleur obligatoire et valeurs admises.
- Visibilité des étiquettes pour les autres joueurs (page publique d’un profil, si elle existe) : oui / non / inconnu.

## R5. Expiration de session
- Durée de vie du jeton (champ `exp` du JWT : noter seulement la durée), comportement d’un jeton expiré (statut 401 ou 400 ?), existence d’un rafraîchissement automatique par la page (l’extension ne lit jamais de jeton de rafraîchissement).

## Livrable du fil de relevé
`specs/synchro-complete/contrat-api.md` mis à jour (sections « Authentification » et « Reste à relever » réduites), puis les entrées de `src/lib/contrat/{enchere,defausse,etiquettes}.ts`, `src/lib/jeton.ts` (source du jeton) et `src/lib/reseau.ts` complétées, en PR.
