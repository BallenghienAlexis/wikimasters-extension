// Mesure sur un export réel (aucune référence : couverture, accord avec la production, échantillon à relire).
// Le fichier d'export et le graphe récolté ne sont jamais committés. Lancer avec :
//   EXPORT=/chemin/export.json GRAPHE=/chemin/graphe.json SORTIE=/chemin/dossier \
//   npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts reel
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { themesPrincipaux, parentsDe } from '../../../src/lib/themes';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
import { deductionProduction } from '../../../tests/benchmark-themes/production';
// @ts-expect-error module JS sans types
import { chargerGraphe, themesDuTitre } from './classer.mjs';

interface Ligne { titre: string; description: string }

it('mesure sur l’export réel', async () => {
  const { EXPORT, GRAPHE, SORTIE } = process.env;
  if (!EXPORT || !GRAPHE || !SORTIE) return; // hors lancement manuel : rien à faire
  const cartes: Ligne[] = JSON.parse(readFileSync(EXPORT, 'utf8'));
  const graphe = chargerGraphe(GRAPHE);
  let n = 0, prodNonVide = 0, bNonVide = 0, hybNonVide = 0, deuxNonVides = 0, identiques = 0, chevauchent = 0, disjoints = 0, bSeul = 0, prodSeul = 0, sansQid = 0;
  const lignes: Record<string, unknown>[] = [];
  for (const c of cartes) {
    const prod = themesPrincipaux({ titre: c.titre, description: c.description });
    const info = graphe.titres[c.titre];
    if (!info?.qid) sansQid += 1;
    const r = themesDuTitre(graphe, c.titre, { parentsDe });
    const b: string[] = r.themes;
    n += 1;
    if (prod.length) prodNonVide += 1;
    if (b.length) bNonVide += 1;
    if (prod.length || b.length) hybNonVide += 1;
    if (prod.length && b.length) {
      deuxNonVides += 1;
      const commun = b.filter((t) => prod.includes(t));
      if (commun.length === b.length && commun.length === prod.length) identiques += 1;
      else if (commun.length) chevauchent += 1;
      else disjoints += 1;
    } else if (b.length) bSeul += 1;
    else if (prod.length) prodSeul += 1;
    lignes.push({ titre: c.titre, description: c.description, prod, b, trace: r.trace.slice(0, 3) });
  }
  const resume = { cartes: n, sansIdentifiantWikidata: sansQid, productionNonVide: prodNonVide, bNonVide, hybrideNonVide: hybNonVide, lesDeuxNonVides: deuxNonVides, identiques, chevauchement: chevauchent, disjoints, bSeulement: bSeul, productionSeulement: prodSeul };
  writeFileSync(`${SORTIE}/resume.json`, JSON.stringify(resume, null, 1));
  writeFileSync(`${SORTIE}/lignes.json`, JSON.stringify(lignes));
  // Cartes réelles de référence (277, descriptions du site) : B, production et hybride sur le même échantillon.
  const b = (c: { titre: string; wikipedia: string }): string[] => themesDuTitre(graphe, c.wikipedia, { parentsDe }).themes;
  const sec = (c: { titre: string; description: string; wikipedia: string }): string[] => { const x = b(c); return x.length ? x : deductionProduction(c) as string[]; };
  const prodSinonB = (c: { titre: string; description: string; wikipedia: string }): string[] => { const p = deductionProduction(c) as string[]; return p.length ? p : b(c); };
  const opts = { source: 'reelle' as const, fiabiliteMin: 'moyenne' as const };
  const textes = [
    formaterRapport(await evaluer(deductionProduction, opts), 'Production — cartes réelles'),
    formaterRapport(await evaluer(b, opts), 'POC B — cartes réelles'),
    formaterRapport(await evaluer(sec, opts), 'Hybride B sinon production — cartes réelles'),
    formaterRapport(await evaluer(prodSinonB, opts), 'Hybride production sinon B — cartes réelles'),
  ];
  const detailB = (await evaluer(b, opts)).details.map((d) => ({ titre: d.titre, categorie: d.categorie, predits: d.predits, reference: d.reference, faux: d.faux, manquants: d.manquants }));
  writeFileSync(`${SORTIE}/detail-b.json`, JSON.stringify(detailB));
  writeFileSync(`${SORTIE}/reelles.txt`, textes.join('\n\n'));
});
