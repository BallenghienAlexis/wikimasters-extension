// Affiche, pour chaque classe de la table, son libellé Wikidata récolté, pour relire la table d'un coup d'œil.
// Une classe « non récoltée » n'a pas été rencontrée dans le graphe du jeu de test : son QID est à confirmer sur wikidata.org.
import { readFileSync, existsSync } from 'node:fs';
import { TABLE } from './table-classes.mjs';
const g = JSON.parse(readFileSync(new URL('./graphe.json', import.meta.url), 'utf8'));
const tx = existsSync(new URL('./taxons.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./taxons.json', import.meta.url), 'utf8')) : {};
let inconnus = 0;
for (const [q, themes] of Object.entries(TABLE)) {
  const l = g.entites[q]?.l ?? tx[q]?.l;
  if (!l) inconnus++;
  console.log(`${q}\t${l ?? '— non récoltée —'}\t→ ${themes.join(', ')}`);
}
console.error(`${Object.keys(TABLE).length} classes, ${inconnus} non récoltées`);
