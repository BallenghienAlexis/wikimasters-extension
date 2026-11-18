// Complément de récolte : chaîne de taxons (P171, « taxon parent ») des cartes dont l'entité est un taxon.
// Écrit taxons.json (cache séparé de graphe.json). Lecture seule, mêmes précautions que recolter.mjs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = 'poc-themes-research/0.1 (lecture seule, recherche)';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, credentials: 'omit' });
    if (r.ok) { await attendre(1500); return r.json(); }
    if (r.status === 429 || r.status >= 500) { await attendre(15000 * (i + 1)); continue; }
    throw new Error('HTTP ' + r.status);
  }
  throw new Error('trop de 429');
}
const graphe = JSON.parse(readFileSync(new URL('./graphe.json', import.meta.url), 'utf8'));
const FICHIER = new URL('./taxons.json', import.meta.url).pathname;
const cache = existsSync(FICHIER) ? JSON.parse(readFileSync(FICHIER, 'utf8')) : {};
const TAXONS = new Set(['Q16521', 'Q23038290', 'Q713623', 'Q55983715', 'Q136772238', 'Q1160573']);
const depart = Object.values(graphe.titres).map((t) => t.qid).filter((q) => q && (graphe.entites[q]?.P31 ?? []).some((c) => TAXONS.has(c)));
let front = depart;
for (let niveau = 0; niveau < 12 && front.length; niveau++) {
  const a = front.filter((q) => !cache[q]);
  for (let i = 0; i < a.length; i += 50) {
    const lot = a.slice(i, i + 50);
    const j = await get('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims|labels', languages: 'fr|en', ids: lot.join('|') }));
    for (const q of lot) {
      const e = j.entities?.[q] ?? {};
      cache[q] = { l: e.labels?.fr?.value ?? e.labels?.en?.value ?? q, P171: (e.claims?.P171 ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, 2) };
    }
    writeFileSync(FICHIER, JSON.stringify(cache));
  }
  front = [...new Set(front.flatMap((q) => cache[q]?.P171 ?? []))];
}
console.error('fini taxons', Object.keys(cache).length);
