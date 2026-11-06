---
description: Lance le pipeline SDD complet sur un besoin (arrêt seulement à la validation de la spec et en cas d'escalade)
argument-hint: <besoin en une phrase> | reprendre <feature>
---

Lis `.claude/agents/orchestrator.md` et joue ce rôle jusqu'au bout pour : $ARGUMENTS

Si l'argument commence par « reprendre », reprends `specs/<feature>/STATUS.md` à l'étape notée. Ne t'arrête qu'au gate de validation de la spec et en cas d'escalade. Va jusqu'au bout de l'étape 7 : retouches, vérification, merge sur `main`, nettoyage des branches et des worktrees. Ne laisse à Alexis que ce que GitHub ou l'environnement refuse réellement.
