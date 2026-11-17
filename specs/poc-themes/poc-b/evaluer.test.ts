// Évaluation du POC B sur le banc d'essai (tests/benchmark-themes). Hors production : lance avec
//   npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts
// Lit graphe.json (récolté par recolter.mjs) : aucun réseau ici. Écrit resultats.json et rapport.txt.
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
import { parentsDe } from '../../../src/lib/themes';
import { deductionProduction } from '../../../tests/benchmark-themes/production';
// @ts-expect-error module JS sans types
import { chargerGraphe, themesDuTitre } from './classer.mjs';

describe('POC B Wikidata', () => {
  it('score le banc d’essai', async () => {
    const graphe = chargerGraphe(new URL('./graphe.json', import.meta.url).pathname);
    const traces: Record<string, string[]> = {};
    const options = { parentsDe };
    const deduire = (c: { titre: string; wikipedia: string }): string[] => {
      const r = themesDuTitre(graphe, c.wikipedia, options);
      traces[c.titre] = r.trace;
      return r.themes;
    };
    const rapport = await evaluer(deduire);
    const haute = await evaluer(deduire, { fiabiliteMin: 'moyenne' });
    // Variantes combinées (indicatif) : B d'abord, production en secours ; ou accord des deux (précision maximale).
    const sec = (c: { titre: string; description: string; wikipedia: string }): string[] => { const b = deduire(c); return b.length ? b : deductionProduction(c) as string[]; };
    const accord = (c: { titre: string; description: string; wikipedia: string }): string[] => { const b = deduire(c); const p = new Set(deductionProduction(c) as string[]); const commun = b.filter((t) => p.has(t)); return commun.length ? commun : b; };
    const hybride = await evaluer(sec);
    const hybride2 = await evaluer(accord);
    const texte = [formaterRapport(rapport, 'POC B — Wikidata (toutes les cartes)'), '', formaterRapport(haute, 'POC B — Wikidata (fiabilité moyenne ou haute)'), '', formaterRapport(hybride, 'Hybride : B, sinon production'), '', formaterRapport(hybride2, 'Hybride : thèmes communs B ∩ production (sinon B)')].join('\n');
    writeFileSync(new URL('./rapport.txt', import.meta.url).pathname, texte);
    writeFileSync(new URL('./resultats.json', import.meta.url).pathname, JSON.stringify({ details: rapport.details.map((d) => ({ ...d, trace: traces[d.titre] })), global: rapport.global, pieges: rapport.pieges, parCategorie: rapport.parCategorie }, null, 1));
    console.log(texte);
  });
});
