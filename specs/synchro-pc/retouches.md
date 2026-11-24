# Retouches — synchro-pc

## À reprendre
- **E2e et captures aux 3 breakpoints** (SC-006, SC-007) : le sélecteur de dossier de Chrome n'est pas pilotable par Playwright ; à faire avec un faux `showDirectoryPicker`. `src/app/SynchroPc.tsx`.
- **Horodatages par champ** : à brancher quand le fil « import entre PC » les aura ajoutés ; remplacera `modifieLe` par fichier (`src/lib/synchroPc.ts`, `fusionnerFichiersPc`). Effacer une édition ne se propage pas tant que c'est fait.
- **Compression gzip** au-delà de 500 Ko (`CompressionStream`) : non faite, le fichier fait environ 1,7 Mo.
- **Exception de lint** (`eslint.config.mjs`, bloc `src/app/dossierPc.ts`) plus large que nécessaire : elle lève aussi `cookie`, `localStorage`, `sessionStorage`. À restreindre à `indexedDB`.
- **Nouveaux PC** : un fichier d'un PC jamais vu est fusionné sans aperçu ; afficher les nouveaux PC dans Réglages avant de les fusionner.
