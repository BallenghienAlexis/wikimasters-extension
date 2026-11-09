# WM Collection

Extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes [WikiMasters](https://www.wiki-masters.com). Non affiliée au jeu.

## Ce qu'elle fait aujourd'hui

- Lire les cartes de chaque page Collection que vous ouvrez sur WikiMasters, et relever la moyenne du marché quand vous ouvrez « Mettre aux enchères ».
- Déduire les thèmes de chaque carte, et gérer vos thèmes et ceux de vos amis à tout moment.
- Proposer un tri : garder, échanger avec un ami, vendre, défausser.
- Préparer les étiquettes de statut, de thème et d’échange (« #À échanger <nom> » pour vos amis) et en montrer l’aperçu. Elles ne sont pas envoyées au site tant que le contrat des étiquettes n’est pas relevé.
- Lister les ventes à lancer selon vos places libres (5 enchères au plus).
- Afficher un repère avec votre décision sur les cartes du site.
- Éditer chaque carte, filtrer, repérer les doublons, importer et exporter en CSV ou JSON.

**Elle ne clique sur rien sur le site** : vous tournez les pages, défaussez, vendez et échangez vous-même. Le cadre et ses raisons sont dans [AGENTS.md](AGENTS.md).

## Régler les prix

Tout se trouve dans [src/config/prix.ts](src/config/prix.ts) : seuil de défausse, limite d'enchères, valeur de repli par rareté, matrice valeur marchande → prix de départ. Après une modification, lancez `npm run build` puis rechargez l'extension.

## Démarrer

```bash
npm ci
```

```bash
npm run build
```

Puis dans Chrome : `chrome://extensions` › mode développeur › « Charger l'extension non empaquetée » › dossier `dist/`. Un clic sur l'icône ouvre la collection.

Pour essayer sans données réelles, importez `tests/e2e/fixtures/collection-fictive.json`.

## Format d'import

```json
{
  "version": 1,
  "cartes": [
    { "id": "identifiant-unique", "titre": "Titre", "rarete": "Rare", "quantite": 2, "url": "https://exemple.test/carte" }
  ]
}
```

Seuls `id` et `titre` sont obligatoires. Un import met à jour les cartes de même `id` en gardant votre édition locale, sauf si le fichier fournit `statut`, `prixCible` ou `note`.

## Développer avec des agents

Le workflow Spec-Driven Development vient de LifeLog : voir [AGENTS.md](AGENTS.md) et `/sdd <besoin>`. Il exige un dépôt GitHub distant pour les étapes de PR.

| Dossier | Contenu |
|---|---|
| `.claude/agents/` | Rôles : spec, refine, designer, architect, tasks, dev-*, reviewer, security-reviewer, verifier, orchestrator |
| `.claude/commands/` | `/sdd` et ses étapes séparées |
| `.claude/skills/` | Conventions partagées (spec, tâches, tokens, captures, revue, vérification, git) |
| `.claude/hooks/` | Garde-fous git (`node .claude/hooks/garde-fous.test.mjs` pour les tester) |
| `specs/_templates/` | Modèles des artefacts |
