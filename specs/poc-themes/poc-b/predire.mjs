// Prédictions du POC B pour un export de collection : node predire.mjs export.json > predictions-b.json
// (après recolter.mjs export.json et taxons.mjs). Sortie : { titre: [thèmes du catalogue] }, sans « autres » ni « à classer ».
import { readFileSync } from 'node:fs';
import { chargerGraphe, themesDuTitre } from './classer.mjs';
const graphe = chargerGraphe(new URL('./graphe.json', import.meta.url).pathname);
const cartes = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sortie = {};
for (const c of cartes) sortie[c.titre] = themesDuTitre(graphe, c.wikipedia ?? c.titre, {}).themes;
console.log(JSON.stringify(sortie, null, 1));
