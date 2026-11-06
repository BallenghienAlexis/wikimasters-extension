---
description: Exécute une tâche - worktree, tests d'abord (dev-test), code (dev de la couche), PR
argument-hint: <T-xxx> [feature]
---

Joue l'orchestrateur (`.claude/agents/orchestrator.md`) pour **l'étape 3 sur la seule tâche $ARGUMENTS** : vérifie que ses dépendances sont mergées, crée son worktree, lance `dev-test` puis l'agent de sa couche, note la PR dans `STATUS.md`. Ne lance pas la revue.
