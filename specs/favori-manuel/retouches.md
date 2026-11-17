# Retouches — étoile de favori et thèmes choisis (PR #183)

## À reprendre

- Captures de la Collection aux 3 breakpoints (360, 768, 1280) : colonne Favori, étoile cochée « À envoyer au site », fenêtre des thèmes ouverte. Non jointes : pas de Chromium compatible dans l’environnement du fil. À produire par `npm run test:e2e` en local ou depuis l’artefact de la CI.
- `src/lib/lot.ts` (bloc « Synchronisation du choix manuel ») et `src/lib/collection.ts` (fusion des cartes lues) : `choixFavori` reste stocké après envoi. Un geste fait ensuite à la main sur le site est inversé par le lot suivant. Piste : signaler l’écart dans l’aperçu, ou remettre `choixFavori` à `null` quand la synchro voit le site aligné. Décision produit à prendre.
- `src/lib/lot.ts` (décochage) : un PATCH par exemplaire, car on ignore lequel porte l’étoile. Piste : afficher le nombre d’écritures dans l’aperçu.
- `src/lib/themesChoisis.ts` : `filtrerThemesChoisis` ne filtre pas le catalogue dans un contexte où `themes.ts` n’est pas chargé (content script). Sans effet aujourd’hui, le content script ne calcule pas d’étiquettes.
