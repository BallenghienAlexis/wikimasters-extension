# STATUS — refonte-ihm
- **Étape courante** : 2.1-refine terminée (RAFFINÉE : 33 corrections, 18 hypothèses H1 à H18, aucun point bloquant) ; arrêt avant 2.2 sur consigne
- **Mis à jour** : 2026-11-13

## Gate design
- [x] Variante choisie par Alexis : **variante 1** (onglets + tableau de bord), 2026-11-13
- [x] Hypothèses H1 à H5 adoptées par défaut (aucune réponse d’Alexis, non bloquantes)
- [x] Design validé : variante 1 + effets harmonisés (D-08), « applique le nouveau design à l’extension » (Alexis, 2026-11-13, 16:03) → `spec.refined.md`, `tasks.md`, puis code par vagues

## Décisions d’Alexis (2026-11-13)
- Tableau de bord léger ; détails dans Collection, Ventes, Synchro et un onglet **Lots**.
- Bandeau d’activité dépliable (synchro, lots), masqué quand inactif.
- Animations fluides (D-04) et tableau de tri interactif ; tri des tableaux avec réordonnancement animé (D-05) ; barre de répartition avec zoom et détail au survol (D-06).

## Décisions par défaut (2026-11-13)
H1 à H18 : voir `spec.refined.md` § Hypothèses (adoptées par défaut). Les plus visibles : H9 (pas de pause pour la synchro en lecture, pause des lots plafonnée à 15 min), H11 (pause de 30 min d’AGENTS.md étendue aux lots, y compris sur « Lancer »), H4 (durée restante = 0,25 s par action, valeur de `SECONDES_PAR_ACTION`), H7 (« À trier » et « En vente » sans couleur dédiée : `muted` et `vendre` hachuré), H8 (4 durées de mouvement).
Rappel H1 à H5 initiales : H1 valeur estimée = valeurs connues × quantité ; H2 lot = groupe d’actions de même type d’un run ; H3 prochaine synchro = prochaine lecture complète réussie ; H4 durée restante = actions restantes × 0,25 s / concurrence ; H5 une action sautée par 403 par carte apparaît « passée : exemplaire indisponible ».

## Suite (non lancée : consigne de s’arrêter après 2.1)
2.2 designer/architect (design.md et plan.md existent déjà, à réviser si `refine` change la spec) → 2.3 tasks → 2.4 publication des artefacts → 3 exécution par vagues.
