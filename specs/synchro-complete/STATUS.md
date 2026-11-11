# STATUS — synchro-complete

- **Besoin** : « synchronisation complète » avec WikiMasters : poser les étiquettes (thèmes et « #À échanger »), mettre aux enchères et défausser depuis l’extension (Alexis, 2026-11-07).
- **Étape courante** : 3-exécution, **suspendue** (17 tâches sur 26 mergées)
- **Mis à jour** : 2026-11-11

## Gate spec
- [x] Spec validée par Alexis — 2026-11-07 ; option B (lecture du jeton en mémoire dans `jeton.ts`) choisie le même jour.

## Tâches
- Mergées : T-001 à T-017 et T-901.
- Non lancées : T-018 (e2e sans requête), T-019 (`reseau.ts`), T-020 (non-fuite du jeton), T-021 à T-025 (lecture du jeton, défausse, enchère, étiquettes, identifiants d’exemplaire, **bloquées par des relevés**), T-026 (e2e complet).
- Aucune écriture n’est émise : `reseau.ts` n’existe pas et la table du contrat est vide.

## Bloquant : relevés à faire par Alexis (voir `contrat-api.md` § « Reste à relever »)
Hôte et en-têtes de `/rest/v1`, mode d’authentification des écritures `/api/`, filtre du `DELETE user_card_tags`, lien `card_id` ↔ `user_card_id`, limites et visibilité des étiquettes, bornes de `base_amount`, formes d’erreur, identifiants renvoyés à la création.

## Reprise
Alexis a demandé de relancer l’écriture (2026-11-11). Dès les relevés fournis, commencer par T-018 et T-019, puis la défausse et l’enchère (`/api/`) avant les étiquettes (`/rest/v1`).
Points de `retouches.md` § « À reprendre » toujours ouverts.
