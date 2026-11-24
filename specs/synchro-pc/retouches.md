# Retouches — synchro-pc

## À reprendre
- **Horodatages par champ** : à brancher quand le fil « import entre PC » les aura ajoutés ; affinera `modifieLe` (par fichier, écrit dans le fichier) (`src/lib/synchroPc.ts`, `fusionnerFichiersPc`). Effacer une édition ne se propage pas tant que c'est fait.
- **Compression gzip** au-delà de 500 Ko (`CompressionStream`) : non faite, le fichier fait environ 1,7 Mo.
- **Exception de lint** (`eslint.config.mjs`, bloc `src/app/dossierPc.ts`) plus large que nécessaire : elle lève aussi `cookie`, `localStorage`, `sessionStorage`. À restreindre à `indexedDB`.
- **Nouveaux PC** : un fichier d'un PC jamais vu est fusionné sans aperçu ; afficher les nouveaux PC dans Réglages avant de les fusionner.

- `src/app/useSynchroPc.ts` (`choisir`) : pas de test sur le cas « le sélecteur ne renvoie rien » ni sur le libellé d'erreur avec le nom de l'exception (retouche de la PR #233).

- `src/app/dossierPc.ts` (`choisirDossier`) : pas de test unitaire des deux cas « sélecteur fermé » (retour `null`) et « échec de mémorisation IndexedDB » (dossier gardé, `erreurMemoire` renseigné), avec `showDirectoryPicker` et `indexedDB` simulés (revue de la PR #234) ; à compléter par le champ `detailAnnulation` (PR #235).

- `src/lib/reseau.ts:59` (`classerConflit`) : la regex `already` est large ; un 409 « already … » sans rapport avec une carte perdue écarterait la carte un jour au lieu d’attendre une minute. À resserrer (par ex. `already (listed|on sale|discarded)`) dès qu’un relevé du site donne la forme exacte, avec un test de `classerConflit` pour « déjà en vente » et « already » (revue de la PR #236).
- Même défaut de liste blanche sur `main` avant la PR #236 : corrigé pour « déjà posée sur le site » et « étiquette déjà sur le site (identifiant inconnu) » ; à garder en tête pour toute nouvelle cause de `reseau.ts` (test `messages.test.ts`).
