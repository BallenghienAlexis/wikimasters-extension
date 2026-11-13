# Plan — Refonte de l’interface (après choix de la variante)

Découpage valable pour la variante 1 ; les variantes 2 et 3 changent seulement la vague 3.

## Vague 0 — Données (couche `src/lib`, sans UI)
- T-301 Sélecteurs de tableau de bord : `src/lib/tableauDeBord.ts` (SC-001), tests d’abord.
- T-302 Modèle de progression : `src/lib/progression.ts` (étapes, global, par étape, durée restante ; SC-002/003) à partir de `StatutSynchro`, `EtatFile`, lot.
- T-303 Détail d’erreur et sauts : enrichir journal/état de file (rang, total, lot), `src/lib/ignorees.ts` + stockage + migration, branchement file/ordonnanceur (SC-004 à 007).

## Vague 1 — Squelette (UI, dépend de T-301)
- T-304 Navigation par onglets + barre d’état globale, découpage de `App.tsx`.
- T-305 Onglet Tableau de bord (KPI, répartition, santé).

## Vague 2 — Synchro (UI, dépend de T-302 et T-303)
- T-306 Onglet Synchro : barres, étapes, tâches en cours / à venir / terminées.
- T-307 Panneau d’erreur + Ignorées + historique filtrable.

## Vague 3 — Rangement
- T-311 Onglet Lots (aperçu des lots à appliquer, sélection, lancement ; réutilise `lot.ts`, `apercuEtiquettes.ts`, `execution.ts`), en parallèle de T-306.
- T-308 Onglets Collection (avec analyses), Ventes (assistant de tri, file de vente) déplacés sans changement de logique.
- T-312 Tableau de tri interactif (glisser-déposer, flèches clavier, animations D-04) et motion de base (apparitions, barres, dépliages), en parallèle de T-308.
- T-309 Onglet Réglages repliables.
- T-310 e2e adaptés (SC-010), captures 3 largeurs × 2 thèmes, accessibilité.

Parallélisme : T-301, T-302 en parallèle ; T-304 en parallèle de T-303 ; T-306 et T-307 en parallèle ; T-308 et T-309 en parallèle. Risque principal : la taille de `Synchronisation.tsx` (1 123 lignes) à découper sans régression (T-306/307).
