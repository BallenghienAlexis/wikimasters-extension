// POC thèmes — banc d'essai. Lancer : npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts
// Jeu : POC_JEU=<chemin vers un JSON au format Jeu> (sinon le mini-jeu provisoire). Le rapport est écrit dans POC_SORTIE si défini.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDS_THEMES } from '../../../src/lib/themes';
import { mesurer, tableau } from './evaluation';
import { METHODES } from './methodes';
import { calculerSignaux } from './signaux';
import type { Jeu } from './types';

const chemin = process.env.POC_JEU ?? new URL('./jeu-provisoire.json', import.meta.url).pathname;
const jeu = JSON.parse(readFileSync(chemin, 'utf8')) as Jeu;

describe('POC thèmes', () => {
  it('le jeu ne cite que des thèmes du catalogue', () => {
    for (const c of jeu.cartes) for (const id of [...c.attendu, ...(c.toleres ?? [])]) expect(IDS_THEMES, `${c.page.titre} : ${id}`).toContain(id);
  });

  it('mesure chaque méthode et écrit le rapport', () => {
    const mesures = METHODES.map((m) => mesurer(m.nom, jeu.cartes, (c) => m.predire(c.page)));
    const detail = jeu.cartes.map((c) => {
      const sig = calculerSignaux(c.page);
      const cols = METHODES.map((m) => `${m.nom.split(' ')[0]}=${JSON.stringify(m.predire(c.page))}`).join(' ');
      return `- ${c.page.titre} (attendu ${JSON.stringify(c.attendu)}) : ${cols} ; signaux ${JSON.stringify(sig)}`;
    });
    const sortie = `Jeu : ${chemin} (origine « ${jeu.origine} », ${jeu.cartes.length} cartes)\n\n${tableau(mesures)}\n\nDétail par carte :\n${detail.join('\n')}\n`;
    console.log(sortie);
    if (process.env.POC_SORTIE) writeFileSync(process.env.POC_SORTIE, sortie);
    expect(mesures).toHaveLength(METHODES.length);
  });
});
