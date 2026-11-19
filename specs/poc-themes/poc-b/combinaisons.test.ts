// Mesure hors extension : combinaisons production / Wikidata (POC B) sur les 277 cartes réelles.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { parentsDe } from '../../../src/lib/themes';
import { evaluer } from '../../../tests/benchmark-themes/scoring';
import { deductionProduction } from '../../../tests/benchmark-themes/production';
// @ts-expect-error module JS sans types
import { chargerGraphe, themesDuTitre } from './classer.mjs';

type C = { titre: string; description: string; wikipedia: string };
it('combinaisons', async () => {
  const graphe = chargerGraphe('specs/poc-themes/poc-b/graphe.json');
  const B = (c: C): string[] => themesDuTitre(graphe, c.wikipedia, { parentsDe }).themes;
  const P = (c: C): string[] => deductionProduction(c) as string[];
  const lie = (t: string[]) => new Set(t.flatMap((x) => [x, ...parentsDe(x)]));
  const cap = (t: string[]) => [...new Set(t)].slice(0, 4);
  const combos: Record<string, (c: C) => string[]> = {
    'Production': P,
    'B (Wikidata) seul': B,
    'Production sinon B': (c) => { const p = P(c); return p.length ? p : B(c); },
    'B sinon production': (c) => { const b = B(c); return b.length ? b : P(c); },
    'Production ∪ B (4 max, production d’abord)': (c) => cap([...P(c), ...B(c)]),
    'Production filtrée par B (garde les thèmes confirmés ; sinon B), vide→B': (c) => {
      const p = P(c), b = B(c);
      if (!p.length) return b;
      if (!b.length) return p;
      const lb = lie(b); const ok = p.filter((t) => lb.has(t) || b.some((x) => parentsDe(t).includes(x)));
      return ok.length ? ok : b;
    },
    'Accord seul (production ∩ B, sinon l’un si l’autre vide)': (c) => {
      const p = P(c), b = B(c);
      if (!p.length) return b; if (!b.length) return p;
      const lb = lie(b); const ok = p.filter((t) => lb.has(t));
      return ok.length ? ok : [];
    },
    'Accord ou B (désaccord → B)': (c) => {
      const p = P(c), b = B(c);
      if (!p.length) return b; if (!b.length) return p;
      const lb = lie(b); const ok = p.filter((t) => lb.has(t));
      return ok.length ? cap([...ok, ...b]) : b;
    },
  };
  const opts = { source: 'reelle' as const, fiabiliteMin: 'moyenne' as const };
  const out: string[] = [];
  for (const [nom, f] of Object.entries(combos)) {
    const g = (await evaluer(f, opts)).global;
    out.push(`${nom}\t${(g.precision * 100).toFixed(1)}\t${(g.rappel * 100).toFixed(1)}\t${(g.f1 * 100).toFixed(1)}\t${(g.tauxSansThemeATort * 100).toFixed(1)}\t${((g.tauxFauxSurCartesVides ?? 0) * 100).toFixed(1)}\t${g.cartes}`);
  }
  writeFileSync('/tmp/combos.tsv', out.join('\n'));
});
