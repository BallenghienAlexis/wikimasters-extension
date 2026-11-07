import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SOURCE_NON_RELEVEE, enteteAuthentification } from '../../src/lib/jeton';

const ORIGINE = 'https://www.wiki-masters.com';
const URL_OK = `${ORIGINE}/api/exemple`;
const TEMOIN = 'jeton-temoin-fictif';

describe('SC-018 (AC1) : source par défaut', () => {
  it('renvoie null tant que l’endroit du jeton n’est pas relevé', () => {
    expect(enteteAuthentification(URL_OK, ORIGINE, 'Authorization')).toBeNull();
    expect(SOURCE_NON_RELEVEE()).toBeNull();
  });
});

describe('SC-018 (AC2) : origine exacte seulement', () => {
  it('renvoie l’en-tête pour l’origine exacte', () => {
    const source = vi.fn(() => TEMOIN);
    expect(enteteAuthentification(URL_OK, ORIGINE, 'X-Jeton', source)).toEqual({ nom: 'X-Jeton', valeur: TEMOIN });
  });

  const refus: Array<[string, string, string]> = [
    ['url d’une autre origine', 'https://exemple.test/api', ORIGINE],
    ['sous-domaine', 'https://api.wiki-masters.com/x', ORIGINE],
    ['http au lieu de https', 'http://www.wiki-masters.com/x', ORIGINE],
    ['port différent', 'https://www.wiki-masters.com:8443/x', ORIGINE],
    ['origine d’onglet étrangère', 'https://exemple.test/x', 'https://exemple.test'],
    ['origine d’onglet différente de l’url', URL_OK, 'https://exemple.test'],
    ['url invalide', 'pas une url', ORIGINE],
    ['domaine piégé', 'https://www.wiki-masters.com.exemple.test/x', ORIGINE],
  ];
  for (const [nom, url, onglet] of refus) {
    it(`refuse sans appeler la source : ${nom}`, () => {
      const source = vi.fn(() => TEMOIN);
      expect(enteteAuthentification(url, onglet, 'X-Jeton', source)).toBeNull();
      expect(source).not.toHaveBeenCalled();
    });
  }
});

describe('SC-018 (AC3) : aucun cache', () => {
  it('appelle la source à chaque appel et suit sa valeur', () => {
    let n = 0;
    const source = vi.fn(() => `${TEMOIN}-${++n}`);
    expect(enteteAuthentification(URL_OK, ORIGINE, 'A', source)?.valeur).toBe(`${TEMOIN}-1`);
    expect(enteteAuthentification(URL_OK, ORIGINE, 'A', source)?.valeur).toBe(`${TEMOIN}-2`);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('renvoie null si la source ne trouve rien', () => {
    expect(enteteAuthentification(URL_OK, ORIGINE, 'A', () => null)).toBeNull();
    expect(enteteAuthentification(URL_OK, ORIGINE, 'A', () => '')).toBeNull();
  });
});

describe('SC-017 (AC5) : le source ne contient ni écriture ni sortie', () => {
  const source = readFileSync(resolve(__dirname, '..', '..', 'src', 'lib', 'jeton.ts'), 'utf8');
  // Commentaires retirés : seul le code compte.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const interdits: Array<[string, RegExp]> = [
    ['setItem', /\bsetItem\b/],
    ['removeItem', /\bremoveItem\b/],
    ['clear', /\.clear\s*\(/],
    ['document.cookie =', /document\s*(\.\s*cookie|\[\s*['"`]cookie['"`]\s*\])\s*=(?!=)/],
    ['cookieStore.set', /cookieStore\s*\.\s*set\b/],
    ['cookieStore.delete', /cookieStore\s*\.\s*delete\b/],
    ['fetch', /\bfetch\b/],
    ['chrome.', /\bchrome\s*\./],
    ['console', /\bconsole\b/],
  ];
  for (const [nom, re] of interdits) {
    it(`ne contient pas ${nom}`, () => {
      expect(re.test(code)).toBe(false);
    });
  }
});
