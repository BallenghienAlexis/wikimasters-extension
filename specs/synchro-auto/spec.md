# Spec — Synchronisation automatique de la collection

- **Feature** : `synchro-auto` · **Auteur** : agent spec · **Date** : 2026-11-09
- **Besoin d'origine** : « parcourir toutes les pages est très long, et il faut le refaire à chaque nouvelle page créée ou à chaque redémarrage du navigateur. Il faudrait une synchronisation WikiMasters vers l'extension 100 % automatique, sans navigation de ma part. » (Alexis, 2026-11-09)
- **Validation** : voir `STATUS.md` (gate humain). **Aucun code avant l'accord d'Alexis.**

## 0. État de l'existant (vérifié)
- Aujourd'hui, la lecture est **uniquement visuelle** : `src/content/index.ts` + `src/lib/lecteur.ts` lisent les cartes de la page `/collection` ouverte ; `src/lib/synchro.ts` ne fait que suivre les pages déjà lues (« Prochaine page à ouvrir : N »). Le joueur tourne les pages lui-même.
- **Rien n'est prévu pour une lecture automatique** : `synchro-complete` couvre l'*écriture* (étiquettes, enchères, défausses), pas la lecture. La seule trace est `plan.md` T-B2, qui envisage `GET /api/my-collection` comme action de lecture dans la file, **uniquement** pour récupérer les `user_card_id`, et seulement après « Lancer ».
- `specs/theme-etiquettes` (PR #24, documents seulement) ne touche pas à la lecture.
- Le contrat relevé le 2026-11-07 (`synchro-complete/contrat-api.md`) contient déjà `GET /api/my-collection?sort=rarity&page=N&stats=0` (page à partir de 0) et `GET /api/my-collection/stats?sort=rarity`. **Forme des réponses et mode d'authentification de `/api/` : non relevés.**
- Briques réutilisables : `file.ts` (cadence fixe 6 s, 10 requêtes max par 60 s, arrêt sur 401/403/429, 3 échecs), `jeton.ts` (seul module qui lit le jeton, content script, origine du site), journal et registre.

## 0 bis. Relevé du 2026-11-09 (voir `releve-api.md`)
- L'API `/api/` s'authentifie par **cookies de même origine** : la lecture n'a pas besoin du jeton. Le service worker resterait inutilisable (hôte non autorisé dans le manifeste), l'option A tient.
- Les **étiquettes** sont déjà dans `my-collection` (`tags`) et `stats` (`tagOptions`) : pas de lecture Supabase, pas de requête en plus.
- Le **prix du marché** est bloqué : `/api/marketplace/cards/<id>/sales` exige un compte PRO (403). Source de la valeur affichée dans « Mettre aux enchères » inconnue.
- Une lecture complète = 134 pages ≈ 14 min à 6 s la requête.

## 1. Goals
- G1 — La collection locale se met à jour **sans que le joueur ouvre ni tourne une page `/collection`**.
- G2 — Une synchro se déclenche seule : au chargement d'une page du site, au démarrage du navigateur (dès qu'un onglet WikiMasters s'ouvre) et périodiquement tant qu'un onglet du site est ouvert.
- G3 — Elle est **incrémentale** : une page n'est relue que si le total ou son contenu a changé ; une nouvelle carte ne coûte pas un parcours complet.
- G5 — Même principe pour **toute** donnée WikiMasters → extension : le **prix du marché** (valeur marchande de chaque carte, aujourd'hui relevée seulement quand le joueur ouvre la fenêtre « Mettre aux enchères » ou saisie à la main) et les **étiquettes** posées sur le site (aujourd'hui non relues), sans intervention du joueur.
- G4 — Elle reste prudente : cadence fixe, arrêt immédiat sur 401/403/429, journal, interrupteur visible dans l'interface.

## 2. Options étudiées
| Option | Principe | Verdict |
|---|---|---|
| A. Lecture API depuis le content script (**recommandée**) | Un onglet WikiMasters est ouvert (n'importe quelle page). Le content script appelle `GET /api/my-collection?page=N` en séquence, à cadence fixe, avec le jeton lu en mémoire par `jeton.ts`. | Compatible avec le cadre actuel : aucune nouvelle permission, jeton confiné. Limite : exige un onglet du site ouvert. |
| B. Service worker + cookies + `chrome.alarms` | Le worker interroge le site seul, même navigateur « fermé sur le site ». | Exige `host_permissions` (aujourd'hui aucune) et sans doute `cookies` ; le worker ne peut pas lire le jeton dans la page ; la règle « Ne jamais faire » interdit de lire cookies et jetons hors du content script. Mode d'authentification de `/api/` inconnu. **Changement de cadre : décision d'Alexis requise.** |
| C. Onglet de fond ouvert par l'extension | `chrome.alarms` ouvre un onglet WikiMasters épinglé en arrière-plan, y lance A, puis le ferme. | Zéro action de Alexis, mais ouverture d'onglets automatiques, plus visible côté site, permission `tabs`/`alarms`. À garder pour une seconde étape, une fois A éprouvée. |
| D. Statu quo + aide | Garder la lecture visuelle et ajouter seulement un rappel « page N à relire ». | Ne résout pas le besoin. |

**Recommandation** : A d'abord (le plus petit pas, sans nouvelle permission), C en suite éventuelle. B est écartée tant que le jeton ne peut pas rester confiné.

## 3. Scope
**Inclus**
- Entrée `lecture` dans la table du contrat (`GET /api/my-collection`) avec validateur de réponse écrit d'après un relevé réel.
- Exécuteur de synchro de lecture dans le content script, réutilisant la cadence de `file.ts` (jamais plus vite que 6 s entre deux requêtes).
- Déclencheurs : chargement d'une page du site, puis minuteur (périodicité à fixer, par défaut 30 min) tant que l'onglet reste ouvert ; pas de relance si une synchro a eu lieu depuis moins de N minutes (horodatage dans `chrome.storage.local`).
- Mode incrémental : `GET /api/my-collection/stats` d'abord (une requête) ; si le total n'a pas bougé et qu'une synchro complète existe, on ne relit rien ; sinon relecture des pages (ou arrêt dès qu'une page est identique à celle déjà stockée, si le tri s'y prête : à vérifier au relevé).
- Fusion dans la collection locale par le même chemin que la lecture visuelle (`fusionnerDansStockage`), sans jamais écraser une décision `decidePar: 'moi'`.
- Interrupteur « Synchronisation automatique » (désactivée par défaut), état et dernière synchro dans l'interface, entrées au journal.

- **Prix du marché** : relevé automatique de la valeur marchande, par carte, pour alimenter l'assistant de tri et la file de vente. **Bloqué tant que la source n'est pas relevée** (SC-011) : `/sales` exige un compte PRO ; sinon l'extension garde la saisie à la main. Seulement pour les cartes dont la valeur est inconnue ou plus ancienne que N jours, à la même cadence fixe ; jamais en rafale.
- **Étiquettes** : relecture des étiquettes du site **via `my-collection` et `stats`** (aucune requête de plus, aucun appel à l'hôte Supabase) pour que l'extension reflète ce qui est réellement posé (Statut · …, Ami · …, Thème · …) et détecte les écarts, y compris après une modification faite à la main sur le site. 
- Les trois synchros partagent un seul ordonnanceur : collection d'abord, puis étiquettes, puis prix du marché ; une seule requête en vol, une seule file, un budget de requêtes par fenêtre commun.

**Exclu**
- Toute écriture sur le site (reste dans `synchro-complete`).
- Service worker qui appelle le site ; `host_permissions` ; lecture de cookies.
- Ouverture automatique d'onglets (option C, seconde spec).
- Contournement de limites du site, en-têtes falsifiés, parallélisme.

## 4. Success Criteria
| ID | Critère | Vérifiable par |
|---|---|---|
| SC-001 | ~~Relevé préalable~~ **Fait le 2026-11-09** (`releve-api.md`) ; reste à figer les erreurs 401/429 : forme de la réponse de `my-collection` et de `stats`, authentification de `/api/`, comportement des pages vides et des erreurs, ajouté à `contrat-api.md`, écrit par Alexis ou d'après ses captures, jamais deviné. | manuel |
| SC-002 | Page du site ouverte, option activée, aucune synchro récente : la collection locale est mise à jour sans interaction, et le nombre de requêtes émises est égal au nombre de pages à relire. | e2e (site fictif) |
| SC-003 | Total inchangé depuis la dernière synchro complète : une seule requête (`stats`) est émise. | unitaire + e2e |
| SC-004 | Une carte ajoutée : seules les pages touchées sont relues (ou arrêt dès la première page identique, selon le relevé). | unitaire |
| SC-005 | Deux requêtes sont toujours séparées d'au moins 6 s ; jamais plus de 10 par minute ; une seule synchro à la fois, même avec plusieurs onglets ouverts. | unitaire (horloge simulée) |
| SC-006 | Réponse 401, 403 ou 429, ou 3 échecs : arrêt immédiat, aucune reprise automatique avant le prochain déclencheur espacé d'au moins 30 min ; entrée au journal. | unitaire |
| SC-007 | Option désactivée (défaut) : aucune requête n'est émise. | e2e |
| SC-008 | Une décision `decidePar: 'moi'` n'est jamais modifiée par la synchro. | unitaire |
| SC-009 | Le jeton n'apparaît ni dans le stockage, ni dans le journal, ni dans l'interface ; seul `jeton.ts` le lit. | unitaire existant étendu |
| SC-011 | **Relevé préalable prix** : endpoint, forme de la réponse et clé de la valeur marchande par carte, écrits dans `contrat-api.md` d'après les captures d'Alexis. | manuel |
| SC-012 | Les étiquettes (`tags` de chaque exemplaire, `tagOptions`) sont stockées à chaque lecture de page, sans requête supplémentaire. | unitaire |
| SC-013 | Option activée : une valeur marchande inconnue ou périmée est relevée seule ; une valeur saisie à la main n'est jamais écrasée sans être signalée ; le budget commun de requêtes (SC-005) vaut pour les trois synchros ensemble. | unitaire |
| SC-014 | Une étiquette modifiée ou retirée à la main sur le site est détectée à la synchro suivante et affichée comme écart dans l'interface ; la synchro ne corrige rien sur le site. | unitaire + e2e |
| SC-010 | Réponse de forme inattendue : la carte est ignorée, la synchro continue, le journal le note (comme `lecteur.ts`). | unitaire |

## 5. Constraints
- **Cadre WikiMasters** : `/api/` est en `Disallow` dans le `robots.txt` et les règles interdisent les outils qui agissent « à la place du joueur » ; une lecture automatique en arrière-plan est plus proche de cette zone que la lecture visuelle. **Risque de bannissement non nul, à assumer par une décision écrite d'Alexis (voir STATUS).** Le trafic reste celui de l'onglet du joueur (même origine, même session), à faible cadence.
- **Permissions** : aucune ajoutée pour l'option A.
- **Rétrocompatibilité** : nouvelle clé de stockage (horodatage, option) avec numéro de version et migration ; export CSV/JSON inchangés.
- **Accessibilité** : interrupteur au clavier, état annoncé, contrastes AA, tokens existants uniquement.
- **Données** : tests et fixtures fictifs.

## 6. Non-Goals
- Synchroniser l'état des enchères ou les amis.
- Corriger automatiquement les écarts d'étiquettes (c'est une écriture, donc `synchro-complete`).
- Fonctionner navigateur fermé ou sans aucun onglet WikiMasters.

## Hypothèses
- H1 — Un onglet WikiMasters est presque toujours ouvert quand Alexis joue ; l'option A suffit pour le besoin (« à chaque redémarrage du navigateur » = dès que le site est rouvert).
- H2 — La lecture API utilise les cookies de même origine ; le jeton n'est pas lu.
- H5 — Décisions d'Alexis du 2026-11-09 : risque lié à `/api/` assumé, onglet WikiMasters ouvert accepté.
- H4 — Les prix et les étiquettes passent par le même mécanisme (option A, onglet ouvert) ; leurs endpoints ne sont pas encore relevés, donc rien n'est deviné.
- H3 — Périodicité par défaut : 30 min, minimum 10 min.
