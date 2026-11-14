import type { BrowserContext, Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { NOM_COOKIE_SESSION, ORIGINE_REST } from '../../src/config/synchro';
import {
  allerA,
  cartesFictivesRepartie,
  chargerCartes,
  ecrireJeuRiche,
  expect,
  fixerHorloge,
  MAINTENANT,
  ONGLETS,
  ouvrirIgnorees,
  ouvrirSectionsReglages,
  pieger,
  POINTS_DE_RUPTURE,
  test,
  THEMES,
} from './extension';

// T-310 : vérifications transverses de la refonte (SC-007 affichage, SC-008, SC-009, SC-011, SC-026). Données ENTIÈREMENT fictives :
// toutes les requêtes http(s) sont interceptées, aucun test ne contacte le vrai site. Horloge fixée avec `fixerHorloge`
// (sauf les parcours qui exécutent un lot sur un site simulé : la cadence réelle du moteur y est nécessaire).

const SITE = fs.readFileSync(path.resolve('tests/e2e/fixtures/site-vide.html'), 'utf8');

const CARTES = [
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', quantite: 1, valeurMarchande: 10 },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', quantite: 3, },
  { id: 'c', titre: 'Abeille fictive', rarete: 'Rare', quantite: 2, valeurMarchande: 4 },
  { id: 'd', titre: 'Mouette fictive', rarete: 'Commune', quantite: 2, valeurMarchande: 25 },
  { id: 'e', titre: 'Loutre fictive', rarete: 'Rare', quantite: 1, valeurMarchande: 60 },
  { id: 'f', titre: 'Renard fictif', rarete: 'Commune', quantite: 1, valeurMarchande: 2 },
];

const stockage = (p: Page, cle: string): Promise<unknown> => p.evaluate(async (c) => (await chrome.storage.local.get(c))[c], cle);

// ───────────────────────────── SC-011 : aucune requête ─────────────────────────────

test.describe('SC-011 : aucune requête hors extension', () => {
  test.setTimeout(60_000);

  const preparer = async (context: BrowserContext, page: Page): Promise<Awaited<ReturnType<typeof pieger>>> => {
    await fixerHorloge(context);
    const banc = await pieger(context);
    await ecrireJeuRiche(page);
    await chargerCartes(page, CARTES);
    // Ignorées stockées (cartes existantes, postérieures au début de synchro) pour « Reprendre ».
    await page.evaluate(
      (n) =>
        chrome.storage.local.set({
          ignorees: { version: 1, entrees: [{ type: 'pose-etiquette', idCarte: 'a', parametre: 'Statut · Garder', portee: 'synchro', date: n - 600_000 }] },
        }),
      MAINTENANT,
    );
    await page.reload();
    return banc;
  };

  test('SC-011 : cinq onglets hors Collection, bandeau déplié, ignorées puis reprendre : aucune requête', async ({ context, pageCollection: page }) => {
    const banc = await preparer(context, page);
    banc.phase.nom = 'hors-collection';
    for (const o of ONGLETS.filter((x) => x.id !== 'collection')) {
      await allerA(page, o.id);
      await page.waitForTimeout(250);
    }
    // Bandeau déplié (synchro en cours simulée par le stockage).
    await page.evaluate(
      (n) =>
        chrome.storage.local.set({
          statutSynchro: {
            version: 2, etat: 'en-cours', page: 3, pages: 10, raison: null, codeHttp: null, le: n, ajoutees: 0, etiquettes: 0, prix: 0,
            etape: 'pages', prixFaits: null, prixPrevus: null, debut: n - 10_000,
          },
          bailSynchro: n + 120_000,
        }),
      MAINTENANT,
    );
    await allerA(page, 'lots');
    const bandeau = page.getByRole('region', { name: 'Activité en cours' });
    await expect(bandeau).toBeVisible();
    const entete = bandeau.getByTestId('ligne-activite-synchro').getByRole('button').first();
    await entete.click();
    await expect(entete).toHaveAttribute('aria-expanded', 'true');
    // Ignorées : reprendre une action ignorée (local).
    await allerA(page, 'synchro');
    const ignorees = page.getByTestId('ignorees');
    await ouvrirIgnorees(page);
    await ignorees.getByRole('button', { name: /^Reprendre « .+ » pour « Zèbre fictif »$/ }).click();
    await expect(ignorees).toContainText('Aucune action ignorée');
    expect(((await stockage(page, 'ignorees')) as { entrees: unknown[] }).entrees).toHaveLength(0);
    // Retour aux autres onglets : toujours rien.
    for (const o of ONGLETS.filter((x) => x.id !== 'collection')) {
      await allerA(page, o.id);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
    expect(banc.vues, 'aucune requête hors de la Collection').toEqual([]);
  });

  test('SC-011 : vue liste seule : Wikipédia/Wikidata, titre seul, aucun autre hôte', async ({ context, pageCollection: page }) => {
    const banc = await preparer(context, page);
    banc.phase.nom = 'liste';
    await allerA(page, 'collection');
    await expect(page.getByText(/titres des cartes affichées sont vérifiés/)).toBeVisible();
    await page.getByTestId('tableau-cartes').getByRole('columnheader', { name: 'Titre' }).getByRole('button').click();
    await expect.poll(() => banc.vues.length, { timeout: 15_000 }).toBeGreaterThan(0);
    for (const v of banc.vues) expect(v.url).toMatch(/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\/w\/api\.php\?/);
  });

});

// ───────────── SC-011 : sauter, ignorer, reprendre sur un site simulé (exécution réelle) ─────────────

interface BancSite { rest: string[]; externes: string[] }

async function ouvrirSiteSimule(context: BrowserContext, status: number): Promise<BancSite> {
  const banc: BancSite = { rest: [], externes: [] };
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => {
      const u = route.request().url();
      if (!u.startsWith('https://fr.wikipedia.org/w/api.php?') && !u.startsWith('https://www.wikidata.org/w/api.php?')) banc.externes.push(u);
      return route.abort();
    },
  );
  await context.route(`${ORIGINE_REST}/**`, (route) => {
    const r = route.request();
    banc.rest.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' },
      body: '',
    });
  });
  await context.route('https://www.wiki-masters.com/**', (route) => route.fulfill({ contentType: 'text/html', body: SITE }));
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jeton = `${b64({ alg: 'none' })}.${b64({ sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })}.signature-fictive`;
  await context.addCookies([
    {
      name: NOM_COOKIE_SESSION,
      value: `base64-${b64({ access_token: jeton, refresh_token: 'refresh-fictif', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'x' } })}`,
      domain: 'www.wiki-masters.com',
      path: '/',
      secure: true,
    },
  ]);
  const site = await context.newPage();
  await site.goto('https://www.wiki-masters.com/collection');
  return banc;
}

async function preparerLot(page: Page): Promise<void> {
  const cartes = [1, 2].map((n) => ({
    id: `UR|Loutre fictive ${n}`, titre: `Loutre fictive ${n}`, rarete: 'UR', quantite: 1,
    idsSite: [`bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`],
  }));
  await page.evaluate(async (c) => {
    await chrome.storage.local.set({
      collection: { version: 3, cartes: c.map((x) => ({ description: '', url: null, favori: false, etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...x })) },
      preferences: { version: 2, mesThemes: [], amis: [] },
      amisInitiaux: 999,
      syncAuto: false,
    });
  }, cartes);
  await page.reload();
}

async function lancerLot(page: Page): Promise<void> {
  await allerA(page, 'lots');
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await page.getByRole('button', { name: /^Lancer/ }).click();
}

test.describe('SC-011 : sauter, ignorer, reprendre sont locaux (exécution simulée, refus 401)', () => {
  test.setTimeout(90_000);
  const panneau = (p: Page): Locator => p.getByTestId('panneau-erreur');

  test('SC-011 : « Sauter cette action » n’envoie rien au site', async ({ context, pageCollection: page }) => {
    await pieger(context); // routes d’abord (aucun hôte réel ne peut être atteint), puis le stockage
    await preparerLot(page); // ensuite le stockage (synchro automatique coupée), puis l’onglet du site
    const banc = await ouvrirSiteSimule(context, 401);
    await lancerLot(page);
    await allerA(page, 'synchro');
    await expect(panneau(page)).toContainText(/401/, { timeout: 40_000 });
    const avant = banc.rest.length;
    await panneau(page).getByRole('button', { name: /^Sauter cette action/ }).click();
    await expect.poll(async () => ((await stockage(page, 'journal')) as { entrees: { cause: string | null }[] }).entrees.some((e) => e.cause === 'sautee')).toBe(true);
    await page.waitForTimeout(1000);
    expect(banc.rest.length).toBe(avant);
    expect(banc.externes).toEqual([]);
  });

  test('SC-011 : « Ignorer jusqu’à la prochaine synchro » puis « Reprendre » n’envoient rien au site', async ({ context, pageCollection: page }) => {
    await pieger(context); // routes d’abord (aucun hôte réel ne peut être atteint), puis le stockage
    await preparerLot(page); // ensuite le stockage (synchro automatique coupée), puis l’onglet du site
    const banc = await ouvrirSiteSimule(context, 401);
    await lancerLot(page);
    await allerA(page, 'synchro');
    await expect(panneau(page)).toContainText(/401/, { timeout: 40_000 });
    const avant = banc.rest.length;
    await panneau(page).getByRole('button', { name: /^Ignorer jusqu’à/ }).click();
    const ignorees = page.getByTestId('ignorees');
    await expect(ignorees.getByRole('button', { name: /^Ignorées \([1-9]/ })).toBeVisible();
    const titreIgnorees = ignorees.getByRole('button', { name: /^Ignorées/ });
    if ((await titreIgnorees.getAttribute('aria-expanded')) === 'false') await titreIgnorees.click();
    const nbIgnorees = ((await stockage(page, 'ignorees')) as { entrees: unknown[] }).entrees.length;
    expect(nbIgnorees).toBeGreaterThan(0);
    await ignorees.getByRole('button', { name: /^Reprendre « .+ » pour « Loutre fictive \d »$/ }).first().click();
    await expect.poll(async () => ((await stockage(page, 'ignorees')) as { entrees: unknown[] }).entrees.length).toBe(nbIgnorees - 1);
    await page.waitForTimeout(1000);
    expect(banc.rest.length).toBe(avant);
    expect(banc.externes).toEqual([]);
  });
});

// ───────────────────────────── SC-008 : clavier sur les cinq onglets ─────────────────────────────

interface BilanClavier { atteints: number; total: number; nonAtteints: string[]; sansHalo: string[] }

/** Marque les contrôles tabulables visibles, tabule réellement (Tab) jusqu'au bouclage, relève le halo de chaque focus. */
async function tabuler(page: Page): Promise<BilanClavier> {
  const total = await page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=radio]), select, textarea, summary, [tabindex]';
    const els = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => {
      if (el.matches(':disabled') || el.getAttribute('tabindex') === '-1' || el.closest('[hidden], [inert], .sr-only')) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    els.forEach((el, i) => {
      el.dataset.t310 = String(i);
    });
    // Point de départ de la navigation séquentielle : un repère tout en haut du document.
    const depart = document.createElement('span');
    depart.tabIndex = -1;
    document.body.prepend(depart);
    depart.focus();
    return els.length;
  });
  const vus = new Set<number>();
  const sansHalo: string[] = [];
  for (let i = 0; i < total + 12; i++) {
    await page.keyboard.press('Tab');
    const etat = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const contour = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
      const halo = cs.boxShadow !== 'none';
      return {
        idx: el.dataset.t310 === undefined ? -1 : Number(el.dataset.t310),
        visible: contour || halo,
        nom: `${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.getAttribute('name') ?? (el.textContent ?? '').trim().slice(0, 30)}]`,
      };
    });
    if (etat === null) continue;
    if (etat.idx >= 0 && vus.has(etat.idx)) break;
    if (etat.idx >= 0) vus.add(etat.idx);
    if (!etat.visible) sansHalo.push(etat.nom);
  }
  const nonAtteints = await page.evaluate(
    (ok) =>
      [...document.querySelectorAll<HTMLElement>('[data-t310]')]
        .filter((el) => !ok.includes(Number(el.dataset.t310)))
        .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30)}]`),
    [...vus],
  );
  return { atteints: vus.size, total, nonAtteints, sansHalo };
}

test.describe('SC-008 : clavier réel (Tab) sur les cinq onglets', () => {
  test.setTimeout(180_000);

  for (const o of ONGLETS) {
    test(`SC-008 : onglet ${o.nom} : tous les contrôles visibles atteints par Tab, halo de focus visible`, async ({ context, pageCollection: page }) => {
      await fixerHorloge(context);
      await pieger(context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await ecrireJeuRiche(page);
      await allerA(page, o.id);
      if (o.id === 'reglages') {
        await ouvrirSectionsReglages(page);
      }
      if (o.id === 'synchro') await ouvrirIgnorees(page);
      const bilan = await tabuler(page);
      expect(bilan.atteints, `contrôles atteints sur ${bilan.total}`).toBeGreaterThanOrEqual(3);
      expect(bilan.nonAtteints, 'contrôles visibles non atteints à la tabulation').toEqual([]);
      expect(bilan.sansHalo, 'contrôles focalisés sans contour ni halo visible').toEqual([]);
    });
  }

});

// ───────────────────────────── SC-009 : pas de défilement horizontal ─────────────────────────────

test.describe('SC-009 : scrollWidth ≤ clientWidth', () => {
  test.setTimeout(240_000);

  test('SC-009 : cinq onglets × 3 largeurs × 2 thèmes, jeu de données complet', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await ecrireJeuRiche(page);
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const bp of POINTS_DE_RUPTURE) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        for (const o of ONGLETS) {
          await allerA(page, o.id);
          if (o.id === 'reglages') {
            await ouvrirSectionsReglages(page);
          }
          const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          expect(sw, `${o.id} ${theme} ${bp.width}`).toBeLessThanOrEqual(cw);
        }
      }
    }
  });

  test('SC-009 : 5 000 cartes, liste, 3 largeurs × 2 thèmes', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await chargerCartes(page, cartesFictivesRepartie(5000));
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const bp of POINTS_DE_RUPTURE) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await allerA(page, 'collection');
        await expect(page.getByTestId('tableau-cartes').locator('tbody tr')).toHaveCount(200);
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(sw, `liste ${theme} ${bp.width}`).toBeLessThanOrEqual(cw);
      }
    }
  });
});

// ───────────────────────────── 5 000 cartes : bornes d'affichage ─────────────────────────────

// ───────────────────────────── SC-026 : mouvement coupé ─────────────────────────────

/** Durées non nulles de transition ou d'animation relevées sur tous les éléments de la page. */
const dureesNonNulles = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const trouvees: string[] = [];
    const nonNul = (v: string): boolean => v.split(',').some((d) => parseFloat(d) > 0);
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        const noms = cs.animationName.split(',').map((n) => n.trim());
        if (nonNul(cs.transitionDuration) || (nonNul(cs.animationDuration) && noms.some((n) => n !== 'none'))) {
          trouvees.push(`${el.tagName.toLowerCase()}${pseudo ?? ''} ${(el.getAttribute('data-testid') ?? el.className).toString().slice(0, 40)}`);
        }
      }
    }
    return trouvees;
  });

test('SC-026 : témoin, sans coupure le mouvement existe (la mesure n’est pas vide de sens)', async ({ context, pageCollection: page }) => {
  await fixerHorloge(context);
  await pieger(context);
  await ecrireJeuRiche(page);
  let total = 0;
  for (const o of ONGLETS) {
    await allerA(page, o.id);
    total += (await dureesNonNulles(page)).length;
  }
  expect(total).toBeGreaterThan(0);
});

for (const mode of ['reduce', 'reglage'] as const) {
  test.describe(`SC-026 : mouvement coupé par ${mode === 'reduce' ? 'prefers-reduced-motion' : 'le réglage « Animations »'}`, () => {
    test.setTimeout(120_000);

    test.beforeEach(async ({ context, pageCollection: page }) => {
      await fixerHorloge(context);
      await pieger(context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await ecrireJeuRiche(page);
      if (mode === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
      else {
        await page.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: false } }));
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-animations', 'off');
      }
    });

    test(`SC-026 : aucune durée de transition ni d'animation sur les cinq onglets`, async ({ pageCollection: page }) => {
      for (const o of ONGLETS) {
        await allerA(page, o.id);
        await page.waitForTimeout(300);
        expect(await dureesNonNulles(page), o.id).toEqual([]);
        expect(await page.evaluate(() => document.getAnimations().length), `animations en cours sur ${o.id}`).toBe(0);
      }
    });

    test('SC-026 : chiffres clés à leur valeur finale dès le premier affichage', async ({ pageCollection: page }) => {
      await page.reload();
      await allerA(page, 'tableau-de-bord');
      const kpis = page.getByTestId('kpi');
      await expect(kpis).toHaveCount(3);
      const lire = (): Promise<string[]> => kpis.evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
      const premier = await lire();
      await page.waitForTimeout(1200);
      expect(await lire()).toEqual(premier);
      expect(premier.find((t) => /Exemplaires/.test(t))).toContain('13');
    });

    test('SC-026 : toutes les fonctions restent utilisables (changement d’onglet, dépliage, bandeau)', async ({ pageCollection: page }) => {
      await allerA(page, 'reglages');
      const b = page.getByRole('button', { name: /^Animations/ });
      await b.click();
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      await allerA(page, 'synchro');
      await expect(page.getByTestId('panneau-erreur')).toBeVisible();
      await ouvrirIgnorees(page);
      await expect(page.getByTestId('ignorees').getByRole('table')).toBeVisible();
    });
  });
}

// ───────────────────────────── SC-007 : aucun secret affiché ─────────────────────────────

test.describe('SC-007 : stockage piégé, rien de sensible dans le DOM', () => {
  test.setTimeout(120_000);

  test('SC-007 : ni jeton, ni cookie, ni clé, ni identifiant d’exemplaire, ni corps de réponse sur les cinq onglets', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const SECRET = 'jeton-fictif-a-ne-jamais-afficher';
    const EXEMPLAIRE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await ecrireJeuRiche(page);
    // Les clés inconnues sont ajoutées dans chaque valeur : elles doivent être ignorées ou faire rejeter l'objet, jamais affichées.
    await page.evaluate(
      async ({ secret, ex }) => {
        const tout = await chrome.storage.local.get(null);
        const piege: Record<string, unknown> = {
          access_token: secret, refresh_token: secret, cookie: `sb-fictif-auth-token=${secret}`, corps: `{"detail":"${secret}"}`, idExemplaire: ex,
        };
        const n: Record<string, unknown> = {};
        for (const [cle, v] of Object.entries(tout)) {
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) n[cle] = { ...(v as object), ...piege };
        }
        const col = tout.collection as { cartes: Record<string, unknown>[] };
        n.collection = { ...col, cartes: col.cartes.map((c) => ({ ...c, ...piege, idsSite: [ex] })) };
        const exe = tout.execution as { erreur: Record<string, unknown> };
        n.execution = { ...(tout.execution as object), ...piege, erreur: { ...exe.erreur, ...piege } };
        const jr = tout.journal as { entrees: Record<string, unknown>[] };
        n.journal = { ...jr, entrees: jr.entrees.map((e) => ({ ...e, ...piege })) };
        n.jeton = secret;
        n.session = { access_token: secret };
        await chrome.storage.local.set(n);
      },
      { secret: SECRET, ex: EXEMPLAIRE },
    );
    await page.reload();

    const instantanes: string[] = [];
    for (const o of ONGLETS) {
      await allerA(page, o.id);
      if (o.id === 'reglages') {
        await ouvrirSectionsReglages(page);
      }
      if (o.id === 'synchro') {
        await ouvrirIgnorees(page);
      }
      if (o.id === 'collection') {
        const lignes = page.getByTestId('tableau-cartes').locator('tbody tr');
        await expect(lignes.first()).toBeVisible();
        await lignes.first().click();
      }
      instantanes.push(
        await page.evaluate(() => {
          const attrs: string[] = [];
          for (const el of document.querySelectorAll('*')) for (const a of el.attributes) attrs.push(`${a.name}=${a.value}`);
          return `${document.documentElement.outerHTML}\n${document.body.innerText}\n${attrs.join('\n')}\n${document.title}\n${document.cookie}`;
        }),
      );
    }
    // Bandeau déplié.
    await page.evaluate(
      ({ n, secret }) =>
        chrome.storage.local.set({
          statutSynchro: {
            version: 2, etat: 'en-cours', page: 3, pages: 10, raison: null, codeHttp: null, le: n, ajoutees: 0, etiquettes: 0, prix: 0,
            etape: 'pages', prixFaits: null, prixPrevus: null, debut: n - 10_000, access_token: secret,
          },
          bailSynchro: n + 120_000,
        }),
      { n: MAINTENANT, secret: SECRET },
    );
    const entete = page.getByTestId('ligne-activite-synchro').getByRole('button').first();
    await entete.click();
    await expect(entete).toHaveAttribute('aria-expanded', 'true');
    instantanes.push(await page.content());

    const dom = instantanes.join('\n----\n');
    // Garde-fou : le contenu fictif est bien affiché (le test n'est pas vide de sens).
    expect(dom).toContain('Loutre fictive');
    expect(dom).toContain('Abeille fictive');
    expect(dom).not.toContain(SECRET);
    expect(dom).not.toContain(EXEMPLAIRE);
    expect(dom).not.toMatch(/bbbbbbbb-bbbb-4bbb-8bbb/);
    expect(dom).not.toMatch(/access_token|refresh_token|Bearer |sb-[a-z0-9]+-auth-token|idExemplaire/i);
    // Le piège n'a pas été « nettoyé » par la page : le stockage fictif garde ses valeurs (aucune réécriture destructrice).
    expect(JSON.stringify(await stockage(page, 'jeton'))).toContain(SECRET);
  });
});

// ───────────────────────────── Tableau de tri en thème sombre ─────────────────────────────
