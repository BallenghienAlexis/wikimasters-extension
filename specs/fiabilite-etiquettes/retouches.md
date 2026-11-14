# Retouches — fiabilité des étiquettes (PR #144)

## À reprendre

- `src/app/GestionAmis.tsx:63` : test de rendu vérifiant que les étiquettes de l’extension (« #Chien », « #À classer », « #À échanger … ») ne sont pas proposées aux amis alors qu’une étiquette du joueur l’est.
- `src/lib/themes.ts:320-336` : test figeant le repli du filtre des noms propres quand `normaliser` change la longueur du texte (ligature « œ »).
- Captures de Réglages › Thèmes aux 3 breakpoints, et passage de `npm run test:e2e` en local (le navigateur de la session ne correspond pas à la version de Playwright ; la CI l’exécute).
