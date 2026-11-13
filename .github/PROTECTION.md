# Protection du dépôt (public et participatif)

Ces réglages ne vivent pas dans les fichiers du dépôt : ils demandent un accès administrateur. Les fichiers (`CODEOWNERS`, workflows, `dependabot.yml`, `SECURITY.md`) sont, eux, appliqués dès le merge.

## À faire une fois (Settings)
1. **Rules › Rulesets › New ruleset › Import a ruleset** : `.github/rulesets-main.json`.
   PR obligatoire, `ci` verte et à jour (émise par GitHub Actions), fils de discussion résolus, squash seul, historique linéaire, ni suppression ni push forcé. **Aucun contournement, pas même administrateur** : la CI est incontournable. 0 approbation GitHub exigée, car le dépôt a un seul propriétaire et le gate des revues `reviewer` / `security-reviewer` est appliqué par l'orchestrateur (`AGENTS.md`) ; les contributeurs externes ne peuvent de toute façon pas fusionner. `CODEOWNERS` demande tout de même ta revue sur chaque PR.
2. **General › Pull Requests** : squash seul, **Automatically delete head branches**.
3. **Code security** : activer Dependency graph, Dependabot alerts et security updates, **Secret scanning** et **Push protection**, **Private vulnerability reporting**, et laisser CodeQL au workflow `codeql.yml` (ne **pas** activer le « Default setup », il entrerait en conflit).
4. **Actions › General** : « Require approval for all outside collaborators » pour les PR de forks, et permissions par défaut du `GITHUB_TOKEN` en **lecture seule**.
5. **General › Features** : garder Issues, désactiver Wiki et Projects s'ils ne servent pas.

## Avant de passer le dépôt en public
Le dépôt est aujourd'hui privé et ces fichiers restent utiles tels quels. Le rendre public publie tout l'historique (archives de sessions, relevés de l'API interne, clé publique du site). C'est une décision d'Alexis, non prise ici.

## Reste à faire
Épingler les actions par SHA (Dependabot les tient ensuite à jour).
