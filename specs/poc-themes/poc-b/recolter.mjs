// Récolte (lecture seule) : titre → identifiant Wikidata → entités et ancêtres (P279), mis en cache dans graphe.json.
// Usage : NODE_USE_ENV_PROXY=1 node --experimental-strip-types recolter.mjs (depuis le dossier du POC ; variable utile seulement derrière un proxy)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = 'poc-themes-research/0.1 (lecture seule, recherche)';
const PAUSE = 1500;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, essais = 12) {
  for (let i = 0; i < essais; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, credentials: 'omit' });
    if (r.ok) { await attendre(PAUSE); return r.json(); }
    if (r.status === 429 || r.status >= 500) { await attendre(15000 * (i + 1)); continue; }
    throw new Error(`HTTP ${r.status} ${url}`);
  }
  throw new Error('trop de 429 ' + url);
}
const FICHIER = new URL('./graphe.json', import.meta.url).pathname;
const cache = existsSync(FICHIER) ? JSON.parse(readFileSync(FICHIER, 'utf8')) : { titres: {}, entites: {} };
const sauver = () => writeFileSync(FICHIER, JSON.stringify(cache));
const PROPS_CARTE = ['P31', 'P106', 'P136', 'P641', 'P101', 'P921', 'P495', 'P17', 'P279', 'P2578', 'P361'];
const wp = 'https://fr.wikipedia.org/w/api.php?';
// Les titres partent par lots de 50 (une seule requête pour 50 cartes : bien moins de charge pour Wikipédia).
const droit = (t) => t.replaceAll('’', "'"); // WikiMasters écrit ’, Wikipédia indexe '
async function qidsDesTitres(titres) {
  const j = await get(wp + new URLSearchParams({ action: 'query', format: 'json', redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item|disambiguation', titles: titres.map(droit).join('|') }));
  const alias = new Map();
  for (const n of j.query?.normalized ?? []) alias.set(n.from, n.to);
  for (const r of j.query?.redirects ?? []) alias.set(r.from, r.to);
  const pages = new Map(Object.values(j.query?.pages ?? {}).map((p) => [p.title, p]));
  for (const t of titres) {
    let cible = droit(t);
    for (let i = 0; i < 3 && alias.has(cible); i++) cible = alias.get(cible);
    const p = pages.get(cible) ?? {};
    cache.titres[t] = { qid: p.pageprops?.wikibase_item ?? null, homonymie: p.pageprops?.disambiguation !== undefined, page: p.title ?? null };
  }
  sauver();
}
async function entites(ids) {
  const a = ids.filter((i) => !cache.entites[i]);
  for (let i = 0; i < a.length; i += 50) {
    const lot = a.slice(i, i + 50);
    const j = await get('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims|labels', languages: 'fr|en', ids: lot.join('|') }));
    for (const id of lot) {
      const e = j.entities?.[id] ?? {};
      const o = { l: e.labels?.fr?.value ?? e.labels?.en?.value ?? id };
      for (const p of PROPS_CARTE) {
        const v = (e.claims?.[p] ?? []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
        if (v.length) o[p] = v.slice(0, 8);
      }
      cache.entites[id] = o;
    }
    sauver();
  }
}
// Sans argument : le jeu du banc d'essai. Avec un fichier JSON [{ titre, description, wikipedia? }] (export de la collection) : ces cartes.
const cartes = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], 'utf8')).map((c) => ({ ...c, wikipedia: c.wikipedia ?? c.titre }))
  : (await import('../../../tests/benchmark-themes/cartes.ts')).CARTES_REFERENCE;
const aFaire = [...new Set(cartes.map((c) => c.wikipedia))].filter((t) => !cache.titres[t] || (!cache.titres[t].qid && !cache.titres[t].homonymie));
for (let i = 0; i < aFaire.length; i += 50) await qidsDesTitres(aFaire.slice(i, i + 50));
// BFS : on charge les entités des cartes, puis les ancêtres par P279 (et les cibles de P31/P106/P136/P641/P101/P921) jusqu'à 6 niveaux.
let front = [...new Set(Object.values(cache.titres).map((t) => t.qid).filter(Boolean))];
const vus = new Set();
for (let niveau = 0; niveau < 7 && front.length; niveau++) {
  await entites(front);
  front.forEach((i) => vus.add(i));
  const suivants = new Set();
  for (const id of front) {
    const e = cache.entites[id];
    const cles = niveau === 0 ? ['P31', 'P279', 'P106', 'P136', 'P641', 'P101', 'P921', 'P495', 'P17', 'P2578'] : ['P279'];
    for (const p of cles) for (const v of e[p] ?? []) if (!vus.has(v)) suivants.add(v);
    // un genre ou un métier a ses propres P279 ; une instance (P31) de niveau 1 remonte aussi par P31 une fois (classe de classes).
  }
  front = [...suivants];
  console.error(`niveau ${niveau + 1}: ${front.length} entités`);
}
sauver();
console.error('fini', Object.keys(cache.entites).length, 'entités');
