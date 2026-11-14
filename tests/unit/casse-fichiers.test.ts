import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Windows et macOS ignorent la casse : deux fichiers de src/ ou tests/ dont le
// chemin ne diffère que par la casse (extension exclue) se résolvent mal à l’import.
describe('casse des fichiers', () => {
  it('aucun chemin de src/ ou tests/ ne collisionne sans tenir compte de la casse', () => {
    const fichiers = execFileSync('git', ['ls-files', 'src', 'tests'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const vus = new Map<string, string>();
    const collisions: string[] = [];
    for (const f of fichiers) {
      const cle = f.replace(/\.[^./]+$/, '').toLowerCase();
      const autre = vus.get(cle);
      if (autre !== undefined && autre !== f) collisions.push(`${autre} ≈ ${f}`);
      else vus.set(cle, f);
    }
    expect(collisions).toEqual([]);
  });
});
