# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Spécificités Claude Code

- **Orchestration = session principale.** Un sous-agent Claude Code ne peut pas lancer d'autres sous-agents. `/sdd` fait donc jouer le rôle `orchestrator` à la session principale (elle lit `.claude/agents/orchestrator.md` et le suit) ; c'est elle qui lance les autres agents, en parallèle quand `tasks.md` le permet.
- **Questions à Alexis = session principale.** Les sous-agents ne dialoguent pas avec l'utilisateur. `spec` et `refine` renvoient un bloc `QUESTIONS` ; la session principale le pose avec `AskUserQuestion` puis relance l'agent avec les réponses.
- **Worktrees visibles.** La session principale crée elle-même `git worktree add .worktrees/T-xxx-slug -b feat/T-xxx-slug origin/main`, note le chemin dans `STATUS.md`, et passe ce chemin absolu à l'agent dev. Pas de worktree caché : Alexis doit pouvoir tout voir (`git worktree list`).
- **Skills** dans `.claude/skills/` : chaque agent lit uniquement ceux que son fichier cite.
- **Permissions** : `.claude/settings.json` autorise les commandes du pipeline (npm, git, gh). Le hook `.claude/hooks/garde-fous.mjs` (PreToolUse sur Bash et PowerShell) bloque le push vers `main`, tout push forcé, `gh pr merge --admin` et la modification de la protection de branche, quelle que soit la place des options. Ne pas contourner ces règles.
- **Windows** : le hook est en Node pour fonctionner sans Python, et couvre aussi l'outil PowerShell.
