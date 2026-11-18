// Ligne de base de production sur le même jeu, pour comparer (écrit base.txt).
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
import { deductionProduction } from '../../../tests/benchmark-themes/production';

it('base', async () => {
  writeFileSync(new URL('./base.txt', import.meta.url).pathname, formaterRapport(await evaluer(deductionProduction), 'Production (titre + description)'));
});
