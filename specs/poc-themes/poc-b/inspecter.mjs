// Aide à la rédaction de la table : pour chaque carte, valeurs de P31/P106/P136/P641/P101 et classes parentes.
import { readFileSync } from 'node:fs';
const { CARTES_REFERENCE: cartes } = await import('../../../tests/benchmark-themes/cartes.ts');
const g = JSON.parse(readFileSync(new URL('./graphe.json', import.meta.url), 'utf8'));
const E = g.entites; const lab = (q) => E[q]?.l ?? q;
for (const c of cartes) {
  const info = g.titres[c.wikipedia]; const q = info?.qid;
  if (!q) { console.log(`${c.titre} [${c.themes}] -- ${info?.homonymie ? 'HOMONYMIE' : 'sans qid'}`); continue; }
  const e = E[q]; if (!e) { console.log(`${c.titre} [${c.themes}] -- entité non récoltée`); continue; }
  const parts = [];
  for (const p of ['P31', 'P106', 'P136', 'P641', 'P101']) for (const v of (e[p] ?? []).slice(0, 3)) {
    const sup = (E[v]?.P279 ?? []).slice(0, 2).map(lab);
    parts.push(`${p}:${lab(v)}(${v})${sup.length ? '<' + sup.join('/') : ''}`);
  }
  console.log(`${c.titre} [${c.themes}] ${info.homonymie ? 'HOMONYMIE ' : ''}` + parts.join(' ; '));
}
