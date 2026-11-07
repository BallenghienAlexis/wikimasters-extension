import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Fichiers simulés : lintText n'a pas besoin qu'ils existent.
const RACINE = resolve(__dirname, '..', '..');

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: RACINE, overrideConfigFile: resolve(RACINE, 'eslint.config.mjs') });
});

async function erreurs(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: resolve(RACINE, filePath) });
  return (res?.messages ?? []).filter((m) => m.severity === 2).map((m) => `${m.ruleId ?? 'parse'} : ${m.message}`);
}

/** Une erreur de règle ESLint (ruleId non nul), jamais une simple erreur d’analyse. */
function exigerErreurDeRegle(messages: string[]): void {
  expect(messages).not.toEqual([]);
  for (const m of messages) expect(m.startsWith('parse :'), m).toBe(false);
}

describe('SC-018 (AC4) : lecture du stockage du site interdite hors jeton.ts', () => {
  const formes: Record<string, string> = {
    localStorage: "export const v = localStorage.getItem('a');",
    "window['sessionStorage']": "export const v = window['sessionStorage'].getItem('a');",
    'globalThis.document.cookie': 'export const c = globalThis.document.cookie;',
    cookieStore: "export const c = cookieStore.get('a');",
    indexedDB: "export const d = indexedDB.open('base');",
  };
  const fichiers = ['src/content/executant.ts', 'src/app/x.tsx', 'src/lib/lot.ts'];
  for (const [nom, code] of Object.entries(formes)) {
    for (const f of fichiers) {
      it(`${nom} est une erreur dans ${f}`, async () => {
        exigerErreurDeRegle(await erreurs(code, f));
      });
    }
  }
});

describe('SC-018 (AC4) : import de jeton.ts', () => {
  const imp = (chemin: string) => `import { enteteAuthentification } from '${chemin}';\nexport const j = enteteAuthentification;`;

  it('depuis src/content/executant.ts : erreur', async () => {
    exigerErreurDeRegle(await erreurs(imp('../lib/jeton'), 'src/content/executant.ts'));
  });
  it('depuis src/app/x.tsx : erreur', async () => {
    exigerErreurDeRegle(await erreurs(imp('../lib/jeton'), 'src/app/x.tsx'));
  });
  it('depuis src/lib/lot.ts : erreur', async () => {
    exigerErreurDeRegle(await erreurs(imp('./jeton'), 'src/lib/lot.ts'));
  });
  it('depuis src/lib/reseau.ts : aucune erreur', async () => {
    expect(await erreurs(imp('./jeton'), 'src/lib/reseau.ts')).toEqual([]);
  });
});
