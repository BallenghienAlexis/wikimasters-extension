# WM Collection

Extension Chrome personnelle pour préparer le tri, l'échange et la vente d'une collection de cartes [WikiMasters](https://www.wiki-masters.com). Non affiliée au jeu.

## Ce qu'elle fait aujourd'hui

- Lire les cartes de chaque page Collection que vous ouvrez sur WikiMasters, et relever la moyenne du marché quand vous ouvrez « Mettre aux enchères ».
- Déduire les thèmes de chaque carte, et gérer vos thèmes et ceux de vos amis à tout moment.
- Proposer un tri : garder, échanger avec un ami, vendre, défausser.
- Préparer les étiquettes de statut, de thème et d'échange (« #À échanger <nom> » pour vos amis) et en montrer l'aperçu. Elles ne sont pas envoyées au site tant que le contrat des étiquettes n'est pas relevé.
- Lister les ventes à lancer selon vos places libres (5 enchères au plus).
- Afficher un repère avec votre décision sur les cartes du site.
- Se synchroniser seule avec le site, si vous l’activez (voir ci-dessous).
- Éditer chaque carte, filtrer, repérer les doublons, importer et exporter en CSV ou JSON.

**Elle ne clique sur rien sur le site** : vous défaussez, vendez et échangez vous-même. Le cadre et ses raisons sont dans [AGENTS.md](AGENTS.md).

## Synchronisation automatique

Tournez les pages vous-même, ou laissez la synchro lire pour vous : l’extension peut lire votre collection, vos étiquettes et le prix du marché de vos cartes par l’API interne du site (requêtes `GET` en lecture seule). **Elle est désactivée par défaut.** Le `robots.txt` du site interdit `/api/` : le risque de bannissement est réel, et il est assumé (décision du 2026-11-09, détail dans [AGENTS.md](AGENTS.md)).

Pour l’activer :

1. Ouvrez la page de gestion (clic sur l’icône) et, dans la section « Synchronisation automatique », mettez l’interrupteur sur « Activée » (Espace au clavier).
2. Gardez un onglet WikiMasters ouvert, connecté à votre compte : la synchro part au chargement d’une page du site, puis toutes les 30 min tant que l’onglet est visible.

À savoir :

- Les requêtes utilisent votre session de navigateur ; l’extension ne lit ni jeton ni cookie.
- Cadence fixe : 6 s entre deux requêtes, 10 par minute au plus. Une lecture complète des pages prend plusieurs minutes (environ 14 min pour 134 pages). Ensuite, seul ce qui a changé est relu, et les prix manquants ou périmés sont relevés par lots.
- Le bouton « Arrêter » coupe tout de suite. Si le site répond 401, 403 ou 429, ou après 3 échecs, la synchro s’arrête et ne reprend pas avant 30 min.
- Vos décisions et vos valeurs saisies à la main ne sont jamais écrasées. Les étiquettes lues sur le site servent à afficher les « Écarts avec le site » ; rien n’est corrigé sur le site.

## Régler les prix

Tout se trouve dans [src/config/prix.ts](src/config/prix.ts) : seuil de défausse, limite d'enchères, matrice valeur marchande → prix de départ. Après une modification, lancez `npm run build` puis rechargez l'extension.

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
