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

## Projet GitHub (suivi des issues et demandes)
Projet : https://github.com/users/BallenghienAlexis/projects/1 (colonnes du champ Status : Backlog, Ready, In progress, In review, Done).

**Sans jeton (dans le projet, onglet Workflows)** : activer « Auto-add to project » (filtre `is:issue,pr repo:BallenghienAlexis/wikimasters-extension`), « Item added to project » (Status = Backlog), « Item closed » et « Pull request merged » (Status = Done).

**Avec jeton** : `.github/workflows/projet.yml` ajoute aussi les éléments et pose le statut :

| Évènement | Colonne |
|---|---|
| Issue ouverte ou rouverte | Backlog |
| Étiquette `statut:accepté` | Ready |
| Issue assignée | In progress |
| PR ouverte en brouillon, ou remise en brouillon | In progress |
| PR ouverte (prête) ou prête pour revue | In review |
| Issue ou PR fermée, PR fusionnée | Done |

Les colonnes sont lues par leur nom (liste `noms` du script) : renommer une colonne demande d'ajuster cette liste.

### Créer le jeton `PROJECT_TOKEN`, pas à pas
1. GitHub › photo de profil › **Settings** › tout en bas **Developer settings** › **Personal access tokens** › **Tokens (classic)** › **Generate new token** › **Generate new token (classic)**.
2. Note : `wikimasters-projet`. Expiration : 90 jours (à renouveler).
3. Cocher **uniquement** `project` (lecture et écriture des projets). Rien d'autre.
4. **Generate token**, puis copier la valeur affichée (elle ne s'affiche qu'une fois).
5. Dépôt `wikimasters-extension` › **Settings** › **Secrets and variables** › **Actions** › **New repository secret** : nom `PROJECT_TOKEN`, valeur = le jeton, **Add secret**.
6. Répéter en **Settings** › **Secrets and variables** › **Dependabot** › **New repository secret** (même nom, même valeur), pour les PR de Dependabot.
7. Ne jamais coller le jeton dans une issue, une PR, un fichier ou un message. S'il fuit : le révoquer dans la même page, en créer un autre.

Un jeton « fine-grained » ne convient pas : il ne peut pas accéder à un projet d'utilisateur. Sans le secret, le workflow se termine sans rien faire.
