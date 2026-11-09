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
const SYNCHRO_AUTO = 'src/content/synchroAuto.ts';
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

const BACKGROUND = 'src/background.ts';

describe('Déstructuration : réseau', () => {
  const formes: Record<string, string> = {
    'const { fetch } = globalThis': 'export const { fetch: f } = globalThis;',
    'const { fetch } = window': 'export const { fetch: f } = window;',
    'const { XMLHttpRequest } = globalThis': 'export const { XMLHttpRequest: X } = globalThis;',
    'const { WebSocket } = globalThis': 'export const { WebSocket: W } = globalThis;',
    'const { EventSource } = globalThis': 'export const { EventSource: E } = globalThis;',
    'const { sendBeacon } = navigator': 'export const { sendBeacon: s } = navigator;',
  };
  for (const [nom, code] of Object.entries(formes)) {
    for (const f of [AUTRE, CONTENT, APP, JETON, BACKGROUND]) {
      it(`SC-017 : ${nom} est interdit dans ${f}`, () => interdit(code, f));
    }
    it(`SC-017 : ${nom} est permis dans src/lib/reseau.ts`, () => permis(code, RESEAU));
  }
});

describe('Réseau interdit dans jeton.ts et background.ts', () => {
  const codes = [
    "export const r = fetch('https://exemple.test/');",
    "export const r = globalThis.fetch('https://exemple.test/');",
    'export const x = new XMLHttpRequest();',
    "export const b = navigator.sendBeacon('https://exemple.test/', 'x');",
  ];
  for (const code of codes) {
    it(`SC-017 : ${code} est interdit dans jeton.ts`, () => interdit(code, JETON));
    it(`SC-017 : ${code} est interdit dans background.ts`, () => interdit(code, BACKGROUND));
  }
});

describe('Déstructuration : stockage et cookies', () => {
  const formes: Record<string, string> = {
    'const { cookie } = document': 'export const { cookie } = document;',
    'const { localStorage: ls } = window': 'export const { localStorage: ls } = window;',
    'const { sessionStorage } = globalThis': 'export const { sessionStorage: s } = globalThis;',
    'const { cookieStore } = globalThis': 'export const { cookieStore: c } = globalThis;',
    'const { indexedDB } = globalThis': 'export const { indexedDB: i } = globalThis;',
    'const { cookie } = globalThis.document': 'export const { cookie: c } = globalThis.document;',
  };
  for (const [nom, code] of Object.entries(formes)) {
    it(`SC-017 : ${nom} est interdit dans src/lib`, () => interdit(code, AUTRE));
    it(`SC-017 : ${nom} est interdit dans src/app`, () => interdit(code, APP));
    it(`SC-017 : ${nom} est interdit dans src/content`, () => interdit(code, CONTENT));
  }
  it('SC-017 : const { setItem } = localStorage est interdit dans jeton.ts', () =>
    interdit('export const { setItem } = localStorage;', JETON));
  it('SC-017 : const { indexedDB } = globalThis est interdit dans src/lib (variante)', () =>
    interdit('export const { indexedDB: i } = globalThis;', AUTRE));
});

describe('Déstructuration : aléatoire', () => {
  const formes: Record<string, string> = {
    'const { random } = Math': 'export const { random } = Math;',
    'const { getRandomValues } = crypto': 'export const { getRandomValues } = crypto;',
    'const { randomUUID } = crypto': 'export const { randomUUID } = crypto;',
    'const { randomUUID } = globalThis.crypto': 'export const { randomUUID } = globalThis.crypto;',
  };
  for (const [nom, code] of Object.entries(formes)) {
    for (const f of [FILE, RESEAU, JETON]) {
      it(`SC-010 : ${nom} est interdit dans ${f}`, () => interdit(code, f));
    }
  }
});

describe('SC-017 : écritures IndexedDB interdites dans jeton.ts', () => {
  const ecritures: Record<string, string> = {
    "s.delete('k')": "export function f(s: IDBObjectStore) { s.delete('k'); }",
    'cursor.update(v)': 'export function f(cursor: IDBCursor, v: unknown) { cursor.update(v); }',
    'cursor.delete()': 'export function f(cursor: IDBCursor) { cursor.delete(); }',
    "s.createIndex('i', 'p')": "export function f(s: IDBObjectStore) { s.createIndex('i', 'p'); }",
    "s.deleteIndex('i')": "export function f(s: IDBObjectStore) { s.deleteIndex('i'); }",
    "db.transaction('s', 'readwrite')": "export function f(db: IDBDatabase) { return db.transaction('s', 'readwrite'); }",
    "db.transaction('s', 'versionchange')": "export function f(db: IDBDatabase) { return db.transaction('s', 'versionchange'); }",
    "indexedDB.open('x', 2)": "indexedDB.open('x', 2);",
    's.add(v)': 'export function f(s: IDBObjectStore, v: unknown) { s.add(v); }',
    's.clear()': 'export function f(s: IDBObjectStore) { s.clear(); }',
    "db.createObjectStore('s')": "export function f(db: IDBDatabase) { db.createObjectStore('s'); }",
  };
  for (const [nom, code] of Object.entries(ecritures)) {
    it(`SC-017 : ${nom} est interdit dans jeton.ts`, () => interdit(code, JETON));
  }
  it('SC-017 : Set.add et Map.delete restent permis hors jeton.ts', () =>
    permis(
      'export function f(s: Set<string>, m: Map<string, number>) { s.add("a"); m.delete("a"); }',
      AUTRE,
    ));
});

describe('Contournements réalistes (mineurs)', () => {
  it('SC-017 : window[`localStorage`] (clé en gabarit) est interdit dans src/lib', () =>
    interdit('export const v = window[`localStorage`].getItem("a");', AUTRE));
  it('SC-017 : document[`cookie`] (clé en gabarit) est interdit dans src/lib', () =>
    interdit('export const c = document[`cookie`];', AUTRE));
  it('AC5 : .click.call(el) est interdit dans src/content', () =>
    interdit('export function f(el: HTMLElement) { el.click.call(el); }', CONTENT));
});

describe('T-205 : fetch autorisé dans src/content/synchroAuto.ts et seulement là', () => {
  const appel = "export const r = fetch('/api/x', { credentials: 'same-origin' });";
  it('fetch est permis dans synchroAuto.ts', () => permis(appel, SYNCHRO_AUTO));
  it('fetch reste interdit dans les autres fichiers de src/content', () => {
    return Promise.all(['src/content/index.ts', 'src/content/executant.ts', 'src/content/autre.ts'].map((f) => interdit(appel, f)));
  });
  for (const code of [
    'export const x = new XMLHttpRequest();',
    "export const w = new WebSocket('wss://exemple.test/');",
    "export const e = new EventSource('https://exemple.test/');",
    "export const b = navigator.sendBeacon('/x', 'y');",
    "export const r = globalThis.fetch('/api/x');",
  ]) {
    it(`${code} reste interdit dans synchroAuto.ts (sauf fetch nu)`, () =>
      code.includes('globalThis.fetch') ? permis(code, SYNCHRO_AUTO) : interdit(code, SYNCHRO_AUTO));
  }
  it('les actions sur le site restent interdites dans synchroAuto.ts', () =>
    interdit('export function f(el: HTMLElement) { el.click(); }', SYNCHRO_AUTO));
  it('jeton reste non importable depuis synchroAuto.ts', () =>
    interdit("import { lireJeton } from '../lib/jeton';\nexport const j = lireJeton;", SYNCHRO_AUTO));
  it('les cookies restent interdits dans synchroAuto.ts', () => interdit('export const c = document.cookie;', SYNCHRO_AUTO));
});
