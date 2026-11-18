#!/usr/bin/env node
// POC thèmes — collecte des données publiques de Wikipédia et Wikidata pour un jeu de cartes, À LANCER SUR UN PC AVEC INTERNET
// (le conteneur de développement n'a pas accès à fr.wikipedia.org). Lecture seule (GET), un seul fil, 1 requête par seconde,
// arrêt immédiat sur 403 ou 429. Seul le titre d'une carte est envoyé : ni compte, ni cookie, ni jeton. Aucune dépendance.
//
// Usage : node specs/poc-themes/poc/collecter.mjs <cartes.json> <sortie.json> [reprise.jsonl]
//   cartes.json : [{ "titre": "...", "description": "...", "wikipedia": "titre de la page (facultatif)", "attendu": ["train"], "toleres": [] }, ...]
//                 (ou { "cartes": [...] } ; « descriptionSite » accepté à la place de « description »).
//                 Le jeu de tests/benchmark-themes/ s'exporte dans ce format : POC_EXPORT_CARTES=cartes.json npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts
//   sortie.json : jeu au format de types.ts (origine « reel »), à passer au banc d'essai par POC_JEU=<sortie.json>
//   reprise.jsonl : fichier de reprise (une page par ligne) ; relancer la commande saute les titres déjà collectés.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const WIKIPEDIA = 'https://fr.wikipedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const PROPRIETES = ['P31', 'P106', 'P136', 'P641'];
const PAUSE_MS = 1000;

const estObjet = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

export const urlWikipedia = (titre) =>
  `${WIKIPEDIA}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'categories|pageprops|extracts', exintro: '1', explaintext: '1', ppprop: 'disambiguation|wikibase_item', cllimit: 'max', clshow: '!hidden', titles: titre })}`;
export const urlEntite = (qid) => `${WIKIDATA}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims|descriptions', languages: 'fr', ids: qid })}`;
export const urlLibelles = (ids) => `${WIKIDATA}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'labels', languages: 'fr', ids: ids.slice(0, 20).join('|') })}`;

/** Page Wikipédia : introduction complète, catégories visibles, homonymie, identifiant Wikidata. */
export function lirePageWikipedia(brut) {
  const page = estObjet(brut) && estObjet(brut.query) && Array.isArray(brut.query.pages) ? brut.query.pages[0] : null;
  if (!estObjet(page) || page.missing === true || page.invalid === true) return { resume: '', categories: [], homonymie: false, qid: null };
  const props = estObjet(page.pageprops) ? page.pageprops : {};
  const qid = typeof props.wikibase_item === 'string' && /^Q\d+$/.test(props.wikibase_item) ? props.wikibase_item : null;
  const categories = Array.isArray(page.categories) ? page.categories.filter((c) => estObjet(c) && typeof c.title === 'string').map((c) => c.title.replace(/^[^:]+:/, '')) : [];
  return { resume: typeof page.extract === 'string' ? page.extract : '', categories, homonymie: 'disambiguation' in props, qid };
}

/** Entité Wikidata : courte description française, être humain (Q5), identifiants des classes (propriétés fermées). */
export function lireEntite(brut, qid) {
  const e = estObjet(brut) && estObjet(brut.entities) ? brut.entities[qid] : null;
  if (!estObjet(e)) return { description: '', humain: false, ids: [] };
  const description = estObjet(e.descriptions) && estObjet(e.descriptions.fr) && typeof e.descriptions.fr.value === 'string' ? e.descriptions.fr.value : '';
  const claims = estObjet(e.claims) ? e.claims : {};
  const ids = [];
  let humain = false;
  for (const prop of PROPRIETES) {
    for (const c of (Array.isArray(claims[prop]) ? claims[prop] : []).slice(0, 5)) {
      const id = estObjet(c) && estObjet(c.mainsnak) && estObjet(c.mainsnak.datavalue) && estObjet(c.mainsnak.datavalue.value) ? c.mainsnak.datavalue.value.id : null;
      if (typeof id !== 'string' || !/^Q\d+$/.test(id)) continue;
      if (prop === 'P31' && id === 'Q5') humain = true;
      else if (!ids.includes(id) && ids.length < 20) ids.push(id);
    }
  }
  return { description, humain, ids };
}

export function lireLibelles(brut) {
  if (!estObjet(brut) || !estObjet(brut.entities)) return [];
  return Object.values(brut.entities).flatMap((e) => (estObjet(e) && estObjet(e.labels) && estObjet(e.labels.fr) && typeof e.labels.fr.value === 'string' ? [e.labels.fr.value] : []));
}

export class ArretSite extends Error {}

async function lire(url, journal) {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  let rep = await fetch(url, { headers: { 'User-Agent': 'poc-themes (script de recherche, lecture seule)', Accept: 'application/json' } });
  // POC_ATTENDRE_429=1 : sur une IP partagée, attendre le délai demandé par Wikimedia (Retry-After, 120 s au plus) puis réessayer, 5 fois au plus.
  for (let essai = 0; rep.status === 429 && process.env.POC_ATTENDRE_429 === '1' && essai < 5; essai++) {
    const attente = Math.min(120, Number(rep.headers.get('retry-after')) || 30);
    journal(`  429 : attente de ${attente} s (essai ${essai + 1}/5)`);
    await new Promise((r) => setTimeout(r, attente * 1000));
    rep = await fetch(url, { headers: { 'User-Agent': 'poc-themes (script de recherche, lecture seule)', Accept: 'application/json' } });
  }
  if (rep.status === 403 || rep.status === 429) throw new ArretSite(`${rep.status} sur ${new URL(url).host} : arrêt, relancer plus tard (reprise automatique)`);
  if (!rep.ok) { journal(`  HTTP ${rep.status} ignoré`); return null; }
  return rep.json();
}

export async function collecterPage(carte, journal = () => {}) {
  const w = lirePageWikipedia(await lire(urlWikipedia(carte.wikipedia ?? carte.titre), journal));
  let wd = { description: '', humain: false, ids: [] };
  let classes = [];
  if (w.qid) {
    wd = lireEntite(await lire(urlEntite(w.qid), journal), w.qid);
    if (wd.ids.length > 0) classes = lireLibelles(await lire(urlLibelles(wd.ids), journal));
  }
  return {
    titre: carte.titre,
    descriptionSite: carte.descriptionSite ?? carte.description ?? '',
    resume: w.resume,
    categories: w.categories,
    homonymie: w.homonymie,
    descriptionWikidata: wd.description ? [wd.description] : [],
    classesWikidata: classes,
    idsClassesWikidata: wd.ids,
    humain: wd.humain,
  };
}

async function principal() {
  const [entree, sortie, reprise = `${process.argv[3]}.reprise.jsonl`] = process.argv.slice(2);
  if (!entree || !sortie) { console.error('Usage : node collecter.mjs <cartes.json> <sortie.json> [reprise.jsonl]'); process.exit(2); }
  const brut = JSON.parse(readFileSync(entree, 'utf8'));
  const cartes = Array.isArray(brut) ? brut : brut.cartes;
  const faites = new Map();
  if (existsSync(reprise)) for (const l of readFileSync(reprise, 'utf8').split('\n').filter(Boolean)) { const p = JSON.parse(l); faites.set(p.titre, p); }
  const journal = (m) => console.log(m);
  let i = 0;
  try {
    for (const carte of cartes) {
      i++;
      if (faites.has(carte.titre)) continue;
      journal(`${i}/${cartes.length} ${carte.titre}`);
      const page = await collecterPage(carte, journal);
      faites.set(carte.titre, page);
      appendFileSync(reprise, `${JSON.stringify(page)}\n`);
    }
  } catch (e) {
    if (!(e instanceof ArretSite)) throw e;
    console.error(e.message);
  }
  const jeu = { origine: 'reel', cartes: cartes.filter((c) => faites.has(c.titre)).map((c) => ({ page: faites.get(c.titre), attendu: c.attendu ?? [], ...(c.toleres ? { toleres: c.toleres } : {}), ...(c.note ? { note: c.note } : {}) })) };
  writeFileSync(sortie, JSON.stringify(jeu, null, 1));
  console.log(`${jeu.cartes.length}/${cartes.length} cartes écrites dans ${sortie}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
