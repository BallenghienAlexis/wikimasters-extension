// POC thèmes — branchement sur le banc d'essai commun (tests/benchmark-themes/, 317 cartes) pour des chiffres comparables aux autres POC.
//
// 1. Export des cartes pour le collecteur : POC_EXPORT_CARTES=cartes.json npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts
// 2. Collecte sur un PC avec internet : node specs/poc-themes/poc/collecter.mjs cartes.json pages.json
// 3. Mesure : POC_PAGES=pages.json POC_RAPPORT=rapport-benchmark.txt npx vitest run --config specs/poc-themes/poc/vitest.poc.config.ts
// Sans POC_PAGES, seule la ligne de base de production est mesurée : les méthodes de vote ont besoin du contenu des pages.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARTES_REFERENCE } from '../../../tests/benchmark-themes/cartes';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
import { deductionProduction } from '../../../tests/benchmark-themes/production';
import { METHODES } from './methodes';
import type { Jeu, Page } from './types';

describe('banc d\'essai commun', () => {
  it('exporte les cartes pour le collecteur', () => {
    const sortie = process.env.POC_EXPORT_CARTES;
    if (!sortie) return;
    const cartes = CARTES_REFERENCE.map((c) => ({ titre: c.titre, description: c.description, wikipedia: c.wikipedia, attendu: c.themes, toleres: c.acceptables ?? [] }));
    writeFileSync(sortie, JSON.stringify(cartes, null, 1));
    expect(cartes.length).toBe(CARTES_REFERENCE.length);
  });

  it('mesure la production et, si les pages sont collectées, chaque méthode', async () => {
    const parties: string[] = [formaterRapport(await evaluer(deductionProduction, { fiabiliteMin: 'moyenne' }), 'production (titre + description, sans page Wikipédia)')];
    const chemin = process.env.POC_PAGES;
    if (chemin) {
      const jeu = JSON.parse(readFileSync(chemin, 'utf8')) as Jeu;
      const pages = new Map<string, Page>(jeu.cartes.map((c) => [c.page.titre, c.page]));
      const manquantes = CARTES_REFERENCE.filter((c) => !pages.has(c.titre)).length;
      parties.push(`Pages collectées : ${pages.size} / ${CARTES_REFERENCE.length} (${manquantes} sans page : leurs thèmes comptent comme « sans thème »).`);
      for (const m of METHODES) {
        const rapport = await evaluer(({ titre }) => {
          const page = pages.get(titre);
          return page ? m.predire(page) : [];
        }, { fiabiliteMin: 'moyenne' });
        parties.push(formaterRapport(rapport, m.nom));
      }
    } else parties.push('POC_PAGES absent : méthodes de vote non mesurées (pages Wikipédia non collectées).');
    const sortie = parties.join('\n\n');
    console.log(sortie);
    if (process.env.POC_RAPPORT) writeFileSync(process.env.POC_RAPPORT, sortie);
    expect(parties.length).toBeGreaterThan(0);
  });
});
