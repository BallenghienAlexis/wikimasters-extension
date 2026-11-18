#!/usr/bin/env node
// POC A — collecte de la page Wikipédia COMPLÈTE (wikitexte, catégories visibles, sections, liens) : À LANCER SUR UN PC AVEC INTERNET
// (le conteneur de développement n'a pas accès à fr.wikipedia.org). Lecture seule (GET), une requête à la fois, 1 s + gigue 0–0,3 s,
// arrêt immédiat sur 403 ou 429, reprise possible. Seul le TITRE de la page est envoyé : ni compte, ni cookie, ni jeton.
// Une seule requête par carte (`action=parse`), contrairement au POC voisin qui en fait trois.
//
// Usage : node specs/poc-themes/poc-a-page-complete/collecter.mjs <titres.json> <pages.json> [reprise.jsonl]
//   titres.json : ["Wagon", ...] ou [{ "wikipedia": "Wagon" }, ...] ou { "cartes": [...] } (« wikipedia » puis « titre »)
//   pages.json  : { "<titre>": <réponse brute action=parse> } à passer au banc par POC_PAGES=<pages.json>
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const API = 'https://fr.wikipedia.org/w/api.php';
const PAUSE_MS = 1000;
const GIGUE_MS = 300;

export const urlParse = (titre) =>
  `${API}?${new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', page: titre, prop: 'wikitext|categories|sections|links|properties', disabletoc: '1' })}`;

export function lireTitres(brut) {
  const liste = Array.isArray(brut) ? brut : Array.isArray(brut?.cartes) ? brut.cartes : [];
  return [...new Set(liste.map((x) => (typeof x === 'string' ? x : x?.wikipedia ?? x?.titre)).filter((t) => typeof t === 'string' && t.length > 0))];
}

const lireUneFois = (titre) => fetch(urlParse(titre), { headers: { 'User-Agent': 'poc-themes (script de recherche, lecture seule)', Accept: 'application/json' } });

async function main() {
  const [, , entree, sortie, reprise = `${sortie}.jsonl`] = process.argv;
  if (!entree || !sortie) { console.error('Usage : node collecter.mjs <titres.json> <pages.json> [reprise.jsonl]'); process.exit(2); }
  const titres = lireTitres(JSON.parse(readFileSync(entree, 'utf8')));
  const faits = new Map();
  if (existsSync(reprise)) for (const l of readFileSync(reprise, 'utf8').split('\n')) { if (l.trim()) { const { titre, reponse } = JSON.parse(l); faits.set(titre, reponse); } }
  let i = 0;
  for (const titre of titres) {
    i += 1;
    if (faits.has(titre)) continue;
    await new Promise((r) => setTimeout(r, PAUSE_MS + Math.random() * GIGUE_MS));
    let rep = await lireUneFois(titre);
    // 429 : on respecte `Retry-After` (adresse partagée par d'autres usages) et on réessaie 4 fois au plus avant d'arrêter.
    for (let essai = 1; rep.status === 429 && essai <= 4; essai += 1) {
      const attente = Math.min(120, Number(rep.headers.get('retry-after')) || 30 * essai);
      console.log(`429 sur « ${titre} » : attente de ${attente} s (essai ${essai}/4)`);
      await new Promise((r) => setTimeout(r, (attente + 2) * 1000));
      rep = await lireUneFois(titre);
    }
    if (rep.status === 403 || rep.status === 429) { console.error(`${rep.status} : arrêt à « ${titre} », relancer plus tard (reprise automatique).`); break; }
    const reponse = rep.ok ? await rep.json() : { erreurHttp: rep.status };
    faits.set(titre, reponse);
    appendFileSync(reprise, `${JSON.stringify({ titre, reponse })}\n`);
    console.log(`${i}/${titres.length} ${titre}${rep.ok ? '' : ` (HTTP ${rep.status})`}`);
  }
  writeFileSync(sortie, JSON.stringify(Object.fromEntries(faits)));
  console.log(`${faits.size}/${titres.length} pages écrites dans ${sortie}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
