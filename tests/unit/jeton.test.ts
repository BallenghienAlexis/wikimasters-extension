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

describe('SC-017 (AC5) : retrait des commentaires', () => {
  it('ne coupe pas une chaîne contenant //', () => {
    const retirer = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
    expect(retirer("const u = 'https://exemple.test'; // fin")).toContain('https://exemple.test');
    expect(retirer('a(); // setItem')).not.toContain('setItem');
  });
});

describe('SC-017 (AC5) : le source ne contient ni écriture ni sortie', () => {
  const source = readFileSync(resolve(__dirname, '..', '..', 'src', 'lib', 'jeton.ts'), 'utf8');
  // Commentaires retirés : seul le code compte.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
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

describe('lecture de la session dans le cookie du site', async () => {
  const { lireSession } = await import('../../src/lib/jeton')
  const { NOM_COOKIE_SESSION } = await import('../../src/config/synchro')
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jeton = (sub: string) => `${b64({ alg: 'x' })}.${b64({ sub })}.signature-fictive`
  const cookie = (session: unknown) => `base64-${b64(session)}`
  const MAINTENANT = 1_800_000_000_000

  it('lit un cookie en un morceau et ne renvoie que le jeton d’accès et l’identifiant', () => {
    const c = `${NOM_COOKIE_SESSION}=${cookie({ access_token: jeton('joueur-1'), refresh_token: 'r', expires_at: MAINTENANT / 1000 + 100 })}`
    expect(lireSession(c, MAINTENANT)).toEqual({ jeton: jeton('joueur-1'), idJoueur: 'joueur-1' })
  })

  it('recolle un cookie découpé en .0 et .1', () => {
    const entier = cookie({ access_token: jeton('joueur-2'), expires_at: MAINTENANT / 1000 + 100 })
    const c = `a=b; ${NOM_COOKIE_SESSION}.0=${entier.slice(0, 40)}; ${NOM_COOKIE_SESSION}.1=${entier.slice(40)}`
    expect(lireSession(c, MAINTENANT)?.idJoueur).toBe('joueur-2')
  })

  it('refuse un jeton expiré, un cookie absent ou mal formé', () => {
    const vieux = `${NOM_COOKIE_SESSION}=${cookie({ access_token: jeton('j'), expires_at: MAINTENANT / 1000 - 1 })}`
    expect(lireSession(vieux, MAINTENANT)).toBeNull()
    expect(lireSession('a=b', MAINTENANT)).toBeNull()
    expect(lireSession(`${NOM_COOKIE_SESSION}=pas-base64`, MAINTENANT)).toBeNull()
    expect(lireSession(`${NOM_COOKIE_SESSION}=${cookie({ access_token: 'sans-points' })}`, MAINTENANT)).toBeNull()
  })

  it('autorise l’hôte REST en plus du site, et rien d’autre', () => {
    const rest = 'https://cyrxjeppjqsxxjayfrur.supabase.co/rest/v1/x'
    expect(enteteAuthentification(rest, ORIGINE, 'A', () => 'v')).toEqual({ nom: 'A', valeur: 'v' })
    expect(enteteAuthentification('https://autre.supabase.co/rest/v1/x', ORIGINE, 'A', () => 'v')).toBeNull()
  })
})
