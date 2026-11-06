# WM Collection

Extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes [WikiMasters](https://www.wiki-masters.com). Non affiliée au jeu.

## Ce qu'elle fait aujourd'hui

- Importer une collection depuis un fichier JSON.
- Éditer localement chaque carte : statut (à trier, garder, échanger, vendre), prix cible, note.
- Rechercher, filtrer par statut, repérer les doublons.
- Exporter en CSV ou en JSON.

**Elle ne lit pas encore le site et ne modifie rien dessus.** Le cadre et ses raisons sont dans [AGENTS.md](AGENTS.md).

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
