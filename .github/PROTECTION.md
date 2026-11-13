# Protection du dépôt (public et participatif)

Ces réglages ne vivent pas dans les fichiers du dépôt : ils demandent un accès administrateur. Les fichiers (`CODEOWNERS`, workflows, `dependabot.yml`, `SECURITY.md`) sont, eux, appliqués dès le merge.

## À faire une fois (Settings)
1. **Rules › Rulesets › New ruleset › Import a ruleset** : `.github/rulesets-main.json`.
   PR obligatoire, `ci` verte et à jour, 1 approbation avec revue du propriétaire du code, fils de discussion résolus, squash seul, historique linéaire, ni suppression ni push forcé. Les administrateurs peuvent contourner **par PR** (c'est ce qui permet au flux SDD de fusionner une fois la CI verte et les revues `reviewer` / `security-reviewer` approuvées).
2. **General › Pull Requests** : squash seul, **Automatically delete head branches**.
3. **Code security** : activer Dependency graph, Dependabot alerts et security updates, **Secret scanning** et **Push protection**, **Private vulnerability reporting**, et CodeQL (le workflow `codeql.yml` l'alimente).
4. **Actions › General** : « Require approval for all outside collaborators » pour les PR de forks, et permissions par défaut du `GITHUB_TOKEN` en **lecture seule**.
5. **General › Features** : garder Issues, désactiver Wiki et Projects s'ils ne servent pas.
