# Retouches — sauvegarde

## À reprendre
- Registre des étiquettes (traité le 2026-11-24, `src/lib/sauvegardeRegistre.ts`) : le fichier porte noms, poses et retraits à la main par carte locale ; l'import les garde en attente (`etiquettesImportees`) et ne les reprend que si le site les confirme. Limite : une carte à plusieurs exemplaires est reprise pour tous ses exemplaires (le site ne dit pas lequel porte l'étiquette) ; à affiner si un conflit apparaît.
- Journal d'exécution des lots (`journal`) : non sauvegardé (historique, non nécessaire pour reprendre le travail).
- Captures de la section « Sauvegarde complète » (3 breakpoints, clair/sombre) : non faites ; à ajouter sur le modèle de `tests/e2e/plafond-defausse.spec.ts`.
- src/lib/sauvegarde.ts:72 et :130 : `syncAuto` est écrit et exigé, mais l'import l'ignore (interrupteur d'ici conservé). Le rendre facultatif dans une prochaine version du format.
- Mémoire de synchro (PR #210, 2026-11-23), points mineurs de revue reportés :
  - src/lib/stockage.ts:700 et src/app/Sauvegarde.tsx:88 : petite fenêtre de concurrence, une vérification Wikipédia en vol peut réécrire le cache en mémoire entre l'écriture des caches et le rechargement ; suspendre le planificateur (ou attendre sa requête en vol) avant d'écrire les caches.
  - src/lib/stockage.ts:691 : `ErreurImportSynchroEnCours` (refus d'import tant que le bail est tenu) sans test ; ajouter un test unitaire de `ecrireDonneesSauvegarde` avec un faux `chrome.storage` et un bail en cours.
  - tests/e2e/sauvegarde.spec.ts:47 : vérifier, après le rechargement, que `wikipedia` et `etatSynchro` contiennent bien ce qui a été importé.
  - Le registre des étiquettes (`registre`) reste non sauvegardé (point ci-dessus inchangé) : la pose d'étiquettes sur le 2ᵉ PC dépend toujours de lui.
