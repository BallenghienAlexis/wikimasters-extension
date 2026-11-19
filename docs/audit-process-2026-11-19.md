# Audit des process — 2026-11-19 (suite de l'audit du 2026-11-17)

Point de départ : `docs/audit-process-2026-11-17.md`, HEAD `dab4966` (PR #200). Aucune règle de sécurité modifiée.

## 1. Points du 17/11 : état aujourd'hui

| Point du 17/11 | État vérifié | Preuve |
|---|---|---|
| Relevé d'affluence : arrêt après 3 échecs | **Résolu** (AGENTS.md du 17/11 : plus d'arrêt sur échecs ordinaires) ; plus de `MAX_ECHECS_RELEVE` dans le code | `grep MAX_ECHECS src/content/synchroAuto.ts` : aucun résultat |
| Durée restante des prix sous-estimée | **Résolu** : 1,65 s par prix | `src/lib/progression.ts:9` |
| Code mort `raison 'echecs'` de la synchro de lecture | **Toujours là**, volontairement : sert à lire d'anciens `statutSynchro` stockés | `ordonnanceur.ts:139`, `synchroAuto.ts:165`, `statutSynchro.ts:92` |
| `AGENTS.md` empilé | **Résolu** (tableau « État courant par process », archives dans `docs/archives/`) | `AGENTS.md` |
| `MAX_ECHECS` à plusieurs valeurs | Intentionnel : écritures 3, Wikipédia 3, IA 5, tableau d'AGENTS.md | – |

## 2. Doublons trouvés (corrigés dans la PR jointe, comportement identique)

| Doublon | Où | Correction |
|---|---|---|
| Code `human_verification_required` défini 3 fois (constante de `actions.ts`, constante privée d'`ordonnanceur`, littéral dans `libelleLecture`) | `actions.ts:133`, `ordonnanceur.ts:42`, `suiviVentes.ts:109` | une seule constante (`actions.ts`) |
| Pas d'attente de 5 s défini 2 fois (`PAS_ATTENTE_PRIX_MS`, `PAS_ATTENTE_MS`) + littéral `5000` des stats | `ordonnanceur.ts:36` et `:498`, `ventes.ts:28` | `PAS_ATTENTE_MS` partout (l'export `PAS_ATTENTE_PRIX_MS` reste) |
| Pause de 30 min des écritures redéfinie | `suiviVentes.ts:42` (`PAUSE_ECRITURE_MS`) | égale à `PAUSE_LOTS_MS` |

## 3. Constats sans modification (à garder tels quels)

- `DELAI_SYNCHRO_MS` (30 min entre deux synchros, `synchroAuto.ts:42`) a la même valeur que la pause 401/429 mais un autre sens : volontairement séparée.
- Les 3 chemins « attente 5 s puis +5 s » (prix, suivi/relance, stats) ont la même formule mais des états différents ; les fusionner toucherait des boucles de sécurité, pas fait.
- Contradiction produit : aucune trouvée entre « sans thème fiable = à classer », « 1 à 4 thèmes », « jamais À classer/Autres » et PR #200 (classes Wikidata en repli seulement, catégories en confirmation).

## 4. Garde-fous vérifiés inchangés
Anti-bot jamais contourné, 401/429 en pause de 30 min, pas de pause sur 403 des lots, gigue, 3 en vol, bail, verrou de requête, revérification, plafond de défausse, mise en vente 1 h, permissions et hôtes du manifeste.
