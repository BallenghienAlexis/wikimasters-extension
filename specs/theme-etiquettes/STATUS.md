# STATUS — theme-etiquettes

- **Besoin** : « Thèmes précis et étiquettes de thème sur le site » (Alexis, 2026-11-08) : étendre `src/lib/themes.ts` (pont, tunnel, chien, chat, cheval…), garder la cohérence avec l’assistant de tri (Garder / Échanger + nom de l’ami), et poser les thèmes précis comme étiquettes sur le site (« Thème · chien ») en plus de « Statut · … » et « Ami · … ».
- **Étape courante** : 1-spec
- **Mis à jour** : 2026-11-08

## Gate spec
- [ ] Spec validée par Alexis — date : … — termes : « … »

## Planification
- [ ] spec.md · [ ] spec.refined.md · [ ] design.md · [ ] plan.md · [ ] tasks.md · [ ] PR des artefacts mergée (#…)

## Décisions par défaut
Hypothèses non bloquantes de `refine`, adoptées sans question.
- 2026-11-08 — Décision d’Alexis (question posée en session) : les thèmes précis deviennent AUSSI des étiquettes sur le site, en plus des étiquettes Statut et Ami.

## Tâches
| Tâche | Vague | Agent | Branche | Worktree | PR | Itération | CI | Revue | Sécurité | Statut |
|---|---|---|---|---|---|---|---|---|---|---|

Statuts : à-faire · tests-écrits · en-revue · changements-demandés · mergée · escalade

## Mineurs à reprendre
| PR | fichier:ligne | Point | Suite (T-9xx ou décliné + raison) |
|---|---|---|---|

## Vérification
- [ ] verification.md (#PR …) — écarts : …

## Livraison
- [ ] PR vers `main` (#…) — SHA : …
- [ ] Branches et worktrees du run supprimés

## Journal
- 2026-11-08 — Démarrage. Prérequis : `gh` authentifié ; main à `f7c5c43`. Le réglage `delete_branch_on_merge` n’a pas pu être lu (appel `gh api` refusé par l’environnement) ; les merges précédents du dépôt ont bien supprimé leurs branches distantes. Dépendance : le pose réelle des étiquettes est le lot T-024 de `synchro-complete`, bloqué par des relevés.
