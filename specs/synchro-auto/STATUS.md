# STATUS — synchro-auto

- **Besoin** : « synchronisation WikiMasters vers l'extension 100 % automatique, sans navigation de ma part » (Alexis, 2026-11-09)
- **Étape courante** : 1-spec (brouillon, en attente de la décision d'Alexis)
- **Mis à jour** : 2026-11-09 16:00

## Gate spec
- [ ] Spec validée par Alexis — date : … — termes : « … »
- [x] 2026-11-09 — Alexis : « oui » au risque, « oui » à l'onglet ouvert (via le chat du projet).
- [x] (ancien) Décision de risque : lecture automatique de `/api/my-collection` (hors `robots.txt`, zone grise des règles), bannissement possible — Alexis assume ? Option A seule, ou A puis C ?
- [x] Relevés collection, stats, étiquettes, authentification : faits dans Chrome le 2026-11-09 (`releve-api.md`)
- [ ] Relevé de la valeur marchande : bloqué (`/sales` = PRO) ; ouverture de la fenêtre « Mettre aux enchères » avec relevé réseau à faire par Alexis par Alexis (réponses de `my-collection`/`stats`, endpoint de la valeur marchande, lecture de `tags`/`user_card_tags`, authentification)

## Planification
- [x] spec.md · [ ] spec.refined.md · [ ] design.md · [ ] plan.md · [ ] tasks.md · [ ] PR des artefacts mergée

## Journal
- 2026-11-09 16:00 — Spec brouillon rédigée. Vérifié : aucune lecture automatique n'est prévue ailleurs (synchro-complete = écriture ; theme-etiquettes = thèmes).
- 2026-11-09 16:02 — Demande d'Alexis : étendre à toute synchro site → extension (prix du marché, étiquettes). Spec élargie (G5, SC-011 à SC-014).
- 2026-11-09 16:20 — Relevé Chrome : cookies de même origine, étiquettes dans my-collection, prix du marché bloqué (PRO). Règle du bloc final déplacée dans la PR #27.
