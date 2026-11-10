import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// G2, G3, G5 : contrôle statique du code du site. Seul synchroAuto.ts appelle fetch.
const RACINE = resolve(__dirname, '..', '..');
const DOSSIER = resolve(RACINE, 'src', 'content');
const EXECUTEUR = 'synchroAuto.ts';

const sansCommentaires = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const lire = (nom: string): string => sansCommentaires(readFileSync(resolve(DOSSIER, nom), 'utf8'));
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.ts'));

describe('T-205 AC2 : seul synchroAuto.ts émet des requêtes', () => {
  it('synchroAuto.ts existe et appelle fetch', () => {
    expect(fichiers).toContain(EXECUTEUR);
    expect(lire(EXECUTEUR)).toMatch(/\bfetch\s*\(/);
  });

  it('aucun autre fichier de src/content n’appelle ni ne référence une API réseau', () => {
    for (const f of fichiers.filter((x) => x !== EXECUTEUR)) {
      expect(lire(f), f).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
    }
  });

  it('synchroAuto.ts n’utilise que fetch (ni XMLHttpRequest, ni WebSocket, ni sendBeacon)', () => {
    expect(lire(EXECUTEUR)).not.toMatch(/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
  });
});

describe('T-205 G3 : cookies de même origine, aucun en-tête, jeton non lu', () => {
  const code = (): string => lire(EXECUTEUR);
  it("fetch est appelé avec credentials: 'same-origin'", () => {
    expect(code()).toMatch(/credentials\s*:\s*['"]same-origin['"]/);
  });
  it('aucun en-tête n’est ajouté', () => {
    expect(code()).not.toMatch(/\bheaders\b|\bHeaders\b|Authorization|\.append\(|\.set\(\s*['"]/);
  });
  it('jeton.ts n’est pas importé (statique ni dynamique)', () => {
    for (const f of fichiers) expect(lire(f), f).not.toMatch(/jeton['"`]/);
  });
  it('aucune lecture de cookie ni du stockage du site', () => {
    expect(code()).not.toMatch(/document\.cookie|cookieStore|localStorage|sessionStorage|indexedDB/);
  });
});

describe('T-205 G2 : GET uniquement', () => {
  it('aucune méthode HTTP autre que GET, aucun corps', () => {
    const c = lire(EXECUTEUR);
    expect(c).not.toMatch(/\bmethod\b\s*:\s*['"](?!GET)/i);
    expect(c).not.toMatch(/\b(POST|PUT|PATCH|DELETE)\b/);
    expect(c).not.toMatch(/\bbody\s*:/);
  });
  it('la route /sales n’apparaît pas dans src/content (elle est construite dans l’ordonnanceur avec ?scope=summary)', () => {
    for (const f of fichiers) expect(lire(f), f).not.toMatch(/\/sales/);
  });
});

describe('T-205 G5 : aucune action à la place du joueur', () => {
  it('ni click, submit, requestSubmit, dispatchEvent, focus', () => {
    for (const f of fichiers) {
      expect(lire(f), f).not.toMatch(/\.(click|submit|requestSubmit|dispatchEvent|focus)\s*\(/);
    }
  });
  it('ni innerHTML ni insertAdjacentHTML', () => {
    for (const f of fichiers) expect(lire(f), f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
  it('aucun aléa', () => {
    expect(lire(EXECUTEUR)).not.toMatch(/Math\.random|getRandomValues|randomUUID/);
  });
});
