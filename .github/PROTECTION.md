# Protection de `main`

Ces réglages ne vivent pas dans les fichiers du dépôt : ils demandent un accès administrateur.

1. GitHub › Settings › Rules › Rulesets › New ruleset › **Import a ruleset**, puis choisir `.github/rulesets-main.json`.
2. Settings › General › Pull Requests : cocher **Allow squash merging** seul, et **Automatically delete head branches**.
3. Le contrôle requis est `ci` (job de `.github/workflows/ci.yml`).

Revues requises : 0 approbation GitHub, car le dépôt n'a qu'un propriétaire et le gate des revues `reviewer` / `security-reviewer` est appliqué par l'orchestrateur (voir `AGENTS.md`). Passer à 1 si un second relecteur arrive.
