// POC B : classement purement structuré par Wikidata. Aucun mot-clé libre, aucune lecture du texte.
// Entrée : graphe.json (récolté par recolter.mjs). Sortie : 0 à 4 identifiants du catalogue.
import { readFileSync, existsSync } from 'node:fs';
import { TABLE, BARRIERES } from './table-classes.mjs';

const POIDS_PROPRIETE = { P31: 1, P106: 1, P136: 1.1, P641: 1.1, P101: 0.5, P921: 0.6, P279: 1, P361: 0.8, P17: 0.5, P495: 0.5, self: 1 };
const PROFONDEUR_MAX = 6;
export const MAX_THEMES = 4;

export function chargerGraphe(fichier) {
  const graphe = JSON.parse(readFileSync(fichier, 'utf8'));
  // Chaînes de taxons (P171) récoltées à part par taxons.mjs.
  const fTaxons = fichier.replace('graphe.json', 'taxons.json');
  if (existsSync(fTaxons)) {
    for (const [q, t] of Object.entries(JSON.parse(readFileSync(fTaxons, 'utf8')))) graphe.entites[q] = { ...(graphe.entites[q] ?? { l: t.l }), P171: t.P171 };
  }
  return graphe;
}

/** Remonte le graphe depuis l'entité : renvoie { theme → meilleur score }, chaque classe de la table comptant selon sa distance. */
export function candidats(graphe, qid, options = {}) {
  const E = graphe.entites;
  const racine = E[qid];
  if (!racine) return { scores: new Map(), trace: [] };
  const scores = new Map();
  const trace = [];
  const vus = new Map(); // qid → plus petite distance
  const file = [];
  // Départ : la valeur de chaque propriété descriptive est à distance 0 ; sa propre chaîne P279 monte ensuite.
  // Les valeurs d'une même propriété sont classées par Wikidata : la 1re pèse plus que la 5e (Michael Jordan : basketteur avant joueur de baseball).
  for (const p of ['P31', 'P106', 'P136', 'P641', 'P101', 'P921', 'P279', 'P361', 'P17', 'P495']) (racine[p] ?? []).forEach((v, i) => file.push([v, 0, p, 1 / (1 + (p === 'P106' ? 0.6 : 0.3) * i)]));
  file.push([qid, 0, 'self', 1]); // le sujet lui-même est un thème (Bouddhisme, Guerre du Vietnam…)
  while (file.length) {
    const [n, d, p, rang = 1] = file.shift();
    if (d > PROFONDEUR_MAX) continue;
    if (vus.has(n) && vus.get(n) <= d) continue;
    vus.set(n, d);
    if (BARRIERES.has(n)) continue; // classe trop générale : on ne monte pas plus haut
    const themes = TABLE[n];
    if (themes) {
      for (const entree of themes) {
        const [t, w] = entree.split(':');
        const s = ((POIDS_PROPRIETE[p] ?? 1) * rang * (w ? Number(w) : 1)) / (1 + d);
        if (s > (scores.get(t) ?? 0)) { scores.set(t, s); trace.push(`${t} ← ${E[n]?.l ?? n} (${n}, ${p}, d=${d})`); }
      }
    }
    const e = E[n];
    if (!e) continue;
    for (const v of e.P279 ?? []) file.push([v, d + 1, p, rang]);
    for (const v of e.P171 ?? []) file.push([v, d + 0.2, p, rang]); // taxon parent : chaînes longues, pas de perte de score à chaque rang
    if (p === 'P361') for (const v of e.P361 ?? []) file.push([v, d + 1, p, rang]);
  }
  return { scores, trace };
}

const REGNES = { Q729: 'animaux', Q756: 'plantes', Q764: 'champignon' };
function chaineTaxon(graphe, qid) {
  let n = qid;
  for (let i = 0; i < 30 && n; i++) {
    if (REGNES[n]) return REGNES[n];
    n = graphe.entites[n]?.P171?.[0];
  }
  return null;
}

/** Choix final : seuil de score, parents retirés (on garde le plus précis), 4 au plus. */
export function themesDe(graphe, qid, options = {}) {
  const { scores, trace } = candidats(graphe, qid, options);
  const seuil = options.seuil ?? 0.3;
  // Repli taxon : aucune classe précise (félin, rapace…) mais la chaîne P171 mène au règne des animaux ou des plantes.
  if (!scores.size) {
    const regne = chaineTaxon(graphe, qid);
    if (regne) scores.set(regne, 1);
  }
  const tries = [...scores.entries()].filter(([, s]) => s >= seuil).sort((a, b) => b[1] - a[1]);
  const meilleur = tries[0]?.[1] ?? 0;
  // Relatif : un thème nettement moins soutenu que le meilleur est écarté (précision avant rappel).
  const humain = (graphe.entites[qid]?.P31 ?? []).includes('Q5');
  const relatif = humain ? (options.relatifHumain ?? 0.8) : (options.relatif ?? 0.6);
  let choisis = tries.filter(([, s]) => s >= meilleur * relatif).map(([t]) => t);
  const aEcarter = new Set();
  for (const t of choisis) for (const p of options.parentsDe?.(t) ?? []) aEcarter.add(p);
  choisis = choisis.filter((t) => !aEcarter.has(t)).slice(0, MAX_THEMES);
  return { themes: choisis, trace };
}

export function themesDuTitre(graphe, titreWikipedia, options) {
  const info = graphe.titres[titreWikipedia] ?? graphe.titres[titreWikipedia.replaceAll("'", '’')] ?? graphe.titres[titreWikipedia.replaceAll('’', "'")];
  if (!info || !info.qid || info.homonymie) return { themes: [], trace: [info?.homonymie ? 'page d’homonymie' : 'sans identifiant Wikidata'] };
  return themesDe(graphe, info.qid, options);
}
