---
description: Vérification finale d'une feature - retouches, chaque SC prouvé sur la branche d'intégration (main par défaut), verification.md, réouverture des écarts
argument-hint: <feature>
---

Joue l'orchestrateur (`.claude/agents/orchestrator.md`) pour **les étapes 5 à 7** sur la feature `$ARGUMENTS` : vérifie que toutes ses tâches sont mergées, traite les mineurs (tâche T-9xx retouches, étape 5), lance `verifier`, puis merge sa PR ou rouvre les tâches en écart, et termine par la livraison sur `main` et le nettoyage.
