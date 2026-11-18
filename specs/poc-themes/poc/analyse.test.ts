// Diagnostic : thèmes faux les plus fréquents par méthode (POC_PAGES requis). Sortie : POC_ANALYSE.
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CARTES_REFERENCE } from '../../../tests/benchmark-themes/cartes';
import { ancetres } from './signaux';
import { METHODES } from './methodes';
import type { Jeu, Page } from './types';

it('analyse des faux thèmes', () => {
  if (!process.env.POC_PAGES || !process.env.POC_ANALYSE) return;
  const jeu = JSON.parse(readFileSync(process.env.POC_PAGES, 'utf8')) as Jeu;
  const pages = new Map<string, Page>(jeu.cartes.map((c) => [c.page.titre, c.page]));
  const out: string[] = [];
  for (const m of METHODES) {
    const faux = new Map<string, string[]>();
    for (const c of CARTES_REFERENCE) {
      const p = pages.get(c.titre);
      if (!p) continue;
      const ok = new Set([...c.themes, ...(c.acceptables ?? []), ...c.themes.flatMap((t) => [...ancetres(t)])]);
      for (const id of m.predire(p)) if (!ok.has(id)) faux.set(id, [...(faux.get(id) ?? []), c.titre]);
    }
    const top = [...faux.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
    out.push(`## ${m.nom}\n` + top.map(([id, t]) => `${id} ×${t.length} (${t.slice(0, 4).join('; ')})`).join('\n'));
  }
  writeFileSync(process.env.POC_ANALYSE, out.join('\n\n'));
});
