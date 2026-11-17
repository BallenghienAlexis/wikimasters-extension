# Retouches — mise en vente

## À reprendre
- `src/content/suiviVentes.ts` (lecture) : prendre le bail pendant la lecture comme le relevé d’affluence (`synchroAuto.ts:200`).
- `src/content/suiviVentes.ts:183` : propager la pause 401/429 d’une écriture dans `arretJusqua`.
- `src/lib/stockage.ts:430` : valider chaque élément de `actives` et `terminees`.
- Relever `history` pour une vente réelle (`final_price`) avant de se fier aux non-ventes.
- Captures de l’onglet aux 3 breakpoints.
