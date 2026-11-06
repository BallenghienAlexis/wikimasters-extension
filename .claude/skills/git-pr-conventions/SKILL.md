---
name: git-pr-conventions
description: Conventions git et GitHub du workflow SDD WM Collection - branches, commits, ouverture de PR avec gh, labels, merge. Utilisé par les agents dev, verifier et l'orchestrateur.
---

# Git et PR

## Branches et worktrees
- Tâche : branche `feat/T-xxx-slug` dans `.worktrees/T-xxx-slug` (créé par l'orchestrateur depuis `origin/main`). Travaille **uniquement** dans ce dossier : `cd <worktree>` en tête de chaque commande Bash.
- Artefacts de spec : `sdd/<feature>-specs` ; vérification : `sdd/<feature>-verification`.
- Jamais de commit sur `main`, jamais de `--force` ; corrections de revue = nouveaux commits sur la même branche.

## Commits
Conventional Commits en français : `test(T-007): couvre le choix du thème`, `feat(T-007): ajoute le sélecteur de thème`, `fix(T-007): corrige le contraste du filet (revue n°2)`. Corps : pourquoi, en 1-3 lignes.

## Ouvrir la PR
```bash
git push -u origin feat/T-xxx-slug
gh pr create --base main --head feat/T-xxx-slug \
  --title "T-xxx: <titre de la tâche>" \
  --label sdd --label couche:<couche> --label statut:en-revue \
  --body-file <fichier>   # rempli d'après .github/pull_request_template.md
```
Le corps reprend : lien vers la tâche (`specs/<feature>/tasks.md#t-xxx`), SC couverts, résumé, preuves (sortie des commandes de `verification`), captures (UI : commitées dans `specs/<feature>/captures/T-xxx/` ou glissées via l'artefact CI), checklist cochée.

## Sans `gh` (Claude Code sur le web, conteneur cloud)
`gh` peut être absent ou sans jeton. Dans ce cas :
- l'agent dev pousse sa branche et écrit le corps de PR dans un fichier temporaire hors du dépôt, puis rend `PR_PRÊTE <branche> <fichier>` au lieu de `PR_OUVERTE` ;
- l'orchestrateur ouvre la PR, pose labels et assignation, publie les verdicts et merge via l'API GitHub (outils MCP `create_pull_request`, `issue_write`, `add_issue_comment`, `merge_pull_request` avec `expectedHeadSha`) ;
- les revues lisent le diff avec `git diff origin/<base>...origin/<branche>` au lieu de `gh pr diff` ;
- `git push --delete` est refusé par le proxy git du cloud : chaque branche poussée doit finir comme tête d'une PR mergée, que GitHub supprime (`delete_branch_on_merge`) .

## Merge (orchestrateur uniquement)
`gh pr merge <n> --squash --delete-branch`, seulement si `gh pr checks <n>` est vert et les deux verdicts sont `APPROVED` (PR de documents de l'orchestrateur : CI et `security-reviewer` seulement, voir `AGENTS.md`). Jamais `--admin`.
