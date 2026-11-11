# Procédure de relevé réseau des étiquettes (à exécuter sur le PC d'Alexis)

Objectif : combler « Reste à relever » de `contrat-api.md` pour débloquer T-024 (étiquettes) et T-021 (jeton). Exécutable par un fil avec accès au navigateur de l'ordinateur d'Alexis (outils Chrome ou accès à la machine), ou par Alexis à la main.

## Règles
- **Aucune valeur secrète n'est notée, collée, journalisée ni committée** : ni jeton, ni valeur d'`apikey`, ni cookie, ni identifiant réel (utilisateur, carte, exemplaire, étiquette). On note des **noms** et des **formes** (`XXX` pour un identifiant, `<jwt>` pour un jeton).
- Compte réel d'Alexis, une **carte de test** et une étiquette de test nommée `WM test relevé`. Une seule pose et un seul retrait. Aucune enchère, défausse ni autre action de jeu.
- Aucun script injecté dans la page. Lecture du trafic réseau (outils de développement) et des **noms** de clés de stockage seulement.
- Résultat : écrit dans `specs/synchro-complete/contrat-api.md` (section « Étiquettes — relevé ») sans valeur, puis PR. Brut éventuel : `captures-site/` (jamais committé).

## Étapes
1. Ouvrir `https://www.wiki-masters.com/collection`, onglet Réseau des outils de développement, « Conserver le journal », filtre `rest/v1`.
2. Sur la carte de test : créer l'étiquette `WM test relevé` (si elle n'existe pas), la poser, puis la retirer.
3. Pour chacune des trois requêtes (`POST …/tags`, `POST …/user_card_tags`, `DELETE …/user_card_tags`) noter :
   - **A. Hôte** : origine exacte (`https://<projet>.supabase.co` ?) et chemin complet ;
   - **B. En-têtes de requête : noms seulement** (`apikey`, `authorization`, `content-type`, `prefer`, `accept-profile`, `content-profile`, autres), et si `apikey` est identique d'une requête à l'autre ;
   - **C. Query** : pour le `DELETE`, le filtre complet avec `XXX` à la place des valeurs (ex. `?user_card_id=eq.XXX&tag_id=eq.XXX`) ; pour les `POST`, le paramètre `select=` ;
   - **D. Corps** : noms et types des champs (déjà connus : `user_id`, `name`, `color` ; `user_card_id`, `tag_id`) ; valeur de `color` acceptée (format, ex. `#rrggbb` ou nom) ;
   - **E. Réponse** : code HTTP, noms des champs renvoyés (notamment l'identifiant de l'étiquette créée), en-têtes de réponse CORS (`access-control-allow-origin`, `access-control-allow-headers`) ;
   - **F. CORS** : présence d'une requête préliminaire `OPTIONS` et son code.
4. **Jeton** (noms seulement) : onglet Application › Cookies et Stockage local de `wiki-masters.com` : nom du cookie ou de la clé qui porte la session (souvent `sb-<projet>-auth-token`), et forme de la valeur (JSON avec `access_token` ? cookie découpé en `.0`/`.1` ?). Indiquer si l'`apikey` apparaît dans le code de la page (oui/non, pas sa valeur).
5. **Limites et visibilité** : tenter de créer une étiquette de 1, 30, 50, 100 caractères (retirer ensuite) pour trouver la longueur maximale ; relever le nombre maximal d'étiquettes par carte et par compte s'il est affiché ; vérifier si une étiquette est visible par un autre joueur (page publique de la carte ou de la collection) ; noter le code et la forme du message d'erreur d'un doublon de nom.
6. **Erreurs** : si possible sans forcer, noter la forme (`code`, `message`, `details`) d'une réponse 4xx obtenue (doublon de nom, étiquette déjà posée).
7. Retirer l'étiquette de test de la carte, puis la supprimer du site si le site le permet.

## Livrable
Section « Étiquettes — relevé » de `contrat-api.md` avec les points A à F, jeton, limites, visibilité, erreurs ; mise à jour de « Reste à relever ». Ensuite : T-019, T-021, T-024, T-025 puis T-026 (e2e).
