import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Fichiers simulés : lintText n'a pas besoin qu'ils existent.
const RACINE = resolve(__dirname, '..', '..');
const AUTRE = 'src/lib/autre.ts';
const RESEAU = 'src/lib/reseau.ts';
const JETON = 'src/lib/jeton.ts';
const FILE = 'src/lib/file.ts';
const CONTENT = 'src/content/index.ts';
const APP = 'src/app/Page.tsx';

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: RACINE, overrideConfigFile: resolve(RACINE, 'eslint.config.mjs') });
});

async function erreurs(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: resolve(RACINE, filePath) });
  return (res?.messages ?? []).filter((m) => m.severity === 2).map((m) => `${m.ruleId ?? 'parse'} : ${m.message}`);
}

async function interdit(code: string, filePath: string) {
  expect(await erreurs(code, filePath)).not.toEqual([]);
}

async function permis(code: string, filePath: string) {
  expect(await erreurs(code, filePath)).toEqual([]);
}

describe('SC-017 (AC1) : API réseau interdites hors src/lib/reseau.ts', () => {
  const formes: Record<string, string> = {
    fetch: "export const r = fetch('https://exemple.test/');",
    'globalThis.fetch': "export const r = globalThis.fetch('https://exemple.test/');",
    "window['fetch']": "export const r = window['fetch']('https://exemple.test/');",
    XMLHttpRequest: 'export const x = new XMLHttpRequest();',
    WebSocket: "export const w = new WebSocket('wss://exemple.test/');",
    EventSource: "export const e = new EventSource('https://exemple.test/');",
    'navigator.sendBeacon': "export const b = navigator.sendBeacon('https://exemple.test/', 'x');",
    "navigator['sendBeacon']": "export const b = navigator['sendBeacon']('https://exemple.test/', 'x');",
  };
  for (const [nom, code] of Object.entries(formes)) {
    it(`SC-017 : ${nom} est interdit dans src/lib`, () => interdit(code, AUTRE));
    it(`SC-017 : ${nom} est interdit dans src/content`, () => interdit(code, CONTENT));
    it(`SC-017 : ${nom} est interdit dans src/app`, () => interdit(code, APP));
    it(`SC-017 : ${nom} est permis dans src/lib/reseau.ts`, () => permis(code, RESEAU));
  }
});

describe('SC-017 (AC2) : cookies et stockage du site interdits hors src/lib/jeton.ts', () => {
  const formes: Record<string, string> = {
    'document.cookie': 'export const c = document.cookie;',
    'globalThis.document.cookie': 'export const c = globalThis.document.cookie;',
    "document['cookie']": "export const c = document['cookie'];",
    cookieStore: "export const c = cookieStore.get('a');",
    localStorage: "export const v = localStorage.getItem('a');",
    sessionStorage: "export const v = sessionStorage.getItem('a');",
    "window['localStorage']": "export const v = window['localStorage'].getItem('a');",
    'globalThis.sessionStorage': "export const v = globalThis.sessionStorage.getItem('a');",
    indexedDB: "export const d = indexedDB.open('base');",
  };
  for (const [nom, code] of Object.entries(formes)) {
    it(`SC-017 : ${nom} est interdit dans src/lib`, () => interdit(code, AUTRE));
    it(`SC-017 : ${nom} est interdit dans src/app`, () => interdit(code, APP));
  }

  it('SC-017 : la lecture de document.cookie est permise dans jeton.ts', () =>
    permis('export const c = document.cookie;', JETON));
  it('SC-017 : la lecture via globalThis.document.cookie est permise dans jeton.ts', () =>
    permis('export const c = globalThis.document.cookie;', JETON));
  it('SC-017 : cookieStore.get est permis dans jeton.ts', () =>
    permis("export const c = cookieStore.get('a');", JETON));
  it('SC-017 : localStorage.getItem est permis dans jeton.ts', () =>
    permis("export const v = localStorage.getItem('a');", JETON));
  it("SC-017 : window['sessionStorage'].getItem est permis dans jeton.ts", () =>
    permis("export const v = window['sessionStorage'].getItem('a');", JETON));
});

describe('SC-017 (AC2) : écritures interdites partout, jeton.ts compris', () => {
  const ecritures: Record<string, string> = {
    'localStorage.setItem': "localStorage.setItem('a', 'b');",
    'sessionStorage.setItem': "sessionStorage.setItem('a', 'b');",
    'localStorage.removeItem': "localStorage.removeItem('a');",
    'sessionStorage.removeItem': "sessionStorage.removeItem('a');",
    'localStorage.clear': 'localStorage.clear();',
    'sessionStorage.clear': 'sessionStorage.clear();',
    "window['localStorage'].setItem": "window['localStorage'].setItem('a', 'b');",
    'globalThis.sessionStorage.clear': 'globalThis.sessionStorage.clear();',
    'affectation document.cookie': "document.cookie = 'a=b';",
    'affectation globalThis.document.cookie': "globalThis.document.cookie = 'a=b';",
    "affectation document['cookie']": "document['cookie'] = 'a=b';",
    'cookieStore.set': "cookieStore.set('a', 'b');",
    'cookieStore.delete': "cookieStore.delete('a');",
    'affectation localStorage.cle': "localStorage.cle = 'x';",
    "affectation window['localStorage'].cle": "window['localStorage'].cle = 'x';",
    'affectation sessionStorage.cle': "sessionStorage.cle = 'x';",
    'indexedDB.deleteDatabase': "indexedDB.deleteDatabase('base');",
    'écriture store.put (indexedDB)': "export function f(store: IDBObjectStore) { store.put({ a: 1 }); }",
  };
  for (const [nom, code] of Object.entries(ecritures)) {
    it(`SC-017 : ${nom} est interdit dans jeton.ts`, () => interdit(code, JETON));
  }
  for (const nom of ['localStorage.setItem', 'localStorage.clear', 'affectation document.cookie', 'cookieStore.set', 'affectation localStorage.cle']) {
    it(`SC-017 : ${nom} est interdit dans src/lib`, () => interdit(ecritures[nom] ?? '', AUTRE));
  }
  it('SC-017 : indexedDB hors jeton.ts est interdit même en lecture', () =>
    interdit("export const r = indexedDB.databases();", AUTRE));
});

describe('SC-018 (AC3) : confinement du jeton', () => {
  const imp = "import { lireJeton } from './jeton';\nexport const j = lireJeton;";
  it('SC-018 : importer jeton depuis reseau.ts est permis', () => permis(imp, RESEAU));
  it('SC-018 : importer jeton depuis un autre module de src/lib est interdit', () => interdit(imp, AUTRE));
  it('SC-018 : importer jeton depuis src/content est interdit', () =>
    interdit("import { lireJeton } from '../lib/jeton';\nexport const j = lireJeton;", CONTENT));
  it('SC-018 : importer jeton depuis src/app est interdit', () =>
    interdit("import { lireJeton } from '../lib/jeton';\nexport const j = lireJeton;", APP));
  it('SC-018 : importer jeton.ts avec extension est interdit hors reseau.ts', () =>
    interdit("import { lireJeton } from './jeton.ts';\nexport const j = lireJeton;", AUTRE));

  it('SC-018 : console.log est interdit dans jeton.ts', () => interdit("console.log('x');", JETON));
  it('SC-018 : console.error est interdit dans reseau.ts', () => interdit("console.error('x');", RESEAU));
  it('SC-018 : console.log reste permis dans un module ordinaire', () => permis("console.log('x');", AUTRE));
});

describe('SC-010 (AC4) : aléatoire interdit dans file, reseau et jeton', () => {
  const formes: Record<string, string> = {
    'Math.random': 'export const n = Math.random();',
    "Math['random']": "export const n = Math['random']();",
    'crypto.getRandomValues': 'export const n = crypto.getRandomValues(new Uint8Array(4));',
    'crypto.randomUUID': 'export const n = crypto.randomUUID();',
    'globalThis.crypto.randomUUID': 'export const n = globalThis.crypto.randomUUID();',
  };
  for (const [nom, code] of Object.entries(formes)) {
    for (const f of [FILE, RESEAU, JETON]) {
      it(`SC-010 : ${nom} est interdit dans ${f}`, () => interdit(code, f));
    }
  }
  it('SC-010 : Math.random reste permis dans un module ordinaire', () =>
    permis('export const n = Math.random();', AUTRE));
});

describe('AC5 : aucune action sur le site à la place du joueur', () => {
  const actions = ['click', 'submit', 'requestSubmit', 'dispatchEvent', 'focus'];
  for (const a of actions) {
    it(`${a} reste interdit dans src/content`, () =>
      interdit(`export function f(el: HTMLElement) { (el as any).${a}(); }`, CONTENT));
    it(`${a} reste interdit dans src/lib`, () =>
      interdit(`export function f(el: HTMLElement) { (el as any).${a}(); }`, AUTRE));
  }
  it('lecture simple du DOM permise dans src/content', () =>
    permis("export const t = document.querySelector('p')?.textContent ?? '';", CONTENT));
  it('innerHTML reste interdit dans src/lib', () =>
    interdit("export function f(el: HTMLElement) { el.innerHTML = 'x'; }", AUTRE));
});

describe('Cas négatifs', () => {
  it('code ordinaire sans réseau : aucune erreur', () =>
    permis('export const somme = (a: number, b: number): number => a + b;', AUTRE));
  it('une variable locale nommée comme une propriété interdite ne déclenche rien', () =>
    permis('export const o = { fetchee: 1, cookies: 2 };', AUTRE));
  it('tests/ n’est pas concerné par les interdictions réseau', () =>
    permis("export const r = fetch('https://exemple.test/');", 'tests/unit/exemple.test.ts'));
  it('tests/ n’est pas concerné par les interdictions de stockage', () =>
    permis("localStorage.setItem('a', 'b');", 'tests/unit/exemple.test.ts'));
  it('tests/ n’est pas concerné par l’interdiction de l’aléatoire', () =>
    permis('export const n = Math.random();', 'tests/unit/file.test.ts'));
});
