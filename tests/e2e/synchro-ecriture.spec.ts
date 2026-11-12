import type { BrowserContext, Page, Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CLE_PUBLIQUE, COULEUR_ETIQUETTE, NOM_COOKIE_SESSION, ORIGINE_REST } from '../../src/config/synchro';
import { expect, test } from './extension';

// T-018, T-020, T-026 : écriture des étiquettes sur un site ENTIÈREMENT fictif.
// Le vrai site et son hôte REST ne sont jamais contactés : toute requête http(s) est interceptée,
// l'hôte REST est simulé (page.route) et toute autre requête est abandonnée puis comptée.
// Session, jeton, identifiants : tous fictifs.
const SITE = fs.readFileSync(path.resolve('tests/e2e/fixtures/site-vide.html'), 'utf8');

const ID_JOUEUR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_EXEMPLAIRE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID_ETIQUETTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JETON_TEMOIN = `${b64({ alg: 'none' })}.${b64({ sub: ID_JOUEUR })}.signature-fictive`;
const REFRESH_TEMOIN = 'refresh-temoin-fictif';

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}

const COOKIE_SESSION = `base64-${b64({ access_token: JETON_TEMOIN, refresh_token: REFRESH_TEMOIN, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: ID_JOUEUR } })}`;

const CARTE = {
  id: 'UR|Loutre fictive',
  titre: 'Loutre fictive',
  rarete: 'UR',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [ID_EXEMPLAIRE],
  etiquettesSite: [],
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: 'moi',
};

interface Vue {
  methode: string;
  url: string;
  entetes: Record<string, string>;
  corps: unknown;
}

interface Banc {
  rest: Vue[];
  externes: string[];
  page: Page;
}

const vue = (r: Request): Vue => ({ methode: r.method(), url: r.url(), entetes: r.headers(), corps: r.postData() ? JSON.parse(r.postData()!) : null });

/** Ouvre le site fictif (un seul onglet), simule l'hôte REST avec `repondre` et abandonne tout le reste. */
async function ouvrirSite(
  context: BrowserContext,
  repondre: (v: Vue) => { status: number; corps?: unknown },
  avecSession = true,
): Promise<Banc> {
  const rest: Vue[] = [];
  const externes: string[] = [];
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => {
      // La vérification Wikipédia (titre de carte seul, voir AGENTS.md) est la seule requête externe permise.
      if (!route.request().url().startsWith('https://fr.wikipedia.org/w/api.php?')) externes.push(route.request().url());
      return route.abort();
    },
  );
  await context.route(`${ORIGINE_REST}/**`, (route) => {
    const v = vue(route.request());
    rest.push(v);
    const { status, corps } = repondre(v);
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' },
      body: corps === undefined ? '' : JSON.stringify(corps),
    });
  });
  await context.route('https://www.wiki-masters.com/**', (route) => route.fulfill({ contentType: 'text/html', body: SITE }));
  if (avecSession) {
    await context.addCookies([{ name: NOM_COOKIE_SESSION, value: COOKIE_SESSION, domain: 'www.wiki-masters.com', path: '/', secure: true }]);
  }
  const page = await context.newPage();
  await page.goto('https://www.wiki-masters.com/collection');
  return { rest, externes, page };
}

/**
 * Amorce le stockage AVANT l'ouverture du site : la synchro automatique est activée par défaut et lirait `/api/`
 * dès le chargement du content script (réponses simulées invalides, bail tenu quelques secondes, donc « Lancer »
 * refusé sous charge). Coupée dans le stockage avant que le site ne s'ouvre, elle ne démarre jamais.
 */
async function amorcer(page: Page): Promise<void> {
  await page.evaluate(async (carte) => {
    await chrome.storage.local.set({
      collection: { version: 2, cartes: [carte] },
      preferences: { version: 2, mesThemes: [], amis: [] },
      amisInitiaux: 999,
      // Le lot refuse de démarrer tant que la synchro automatique tient le bail : elle est coupée ici.
      syncAuto: false,
    });
  }, CARTE);
  await page.reload();
}

const ouvrirApercu = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(page.getByTestId('zone-execution').or(page.getByTestId('titre-apercu'))).toBeVisible();
};

const toutLeStockage = (page: Page): Promise<string> =>
  page.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));

test('0 requête avant « Lancer » ; puis création et pose avec les bons en-têtes, sans fuite du jeton', async ({ context, pageCollection: page }) => {
  test.setTimeout(90_000);
  const consoles: string[] = [];
  context.on('console', (m) => consoles.push(m.text()));
  await amorcer(page);
  const banc = await ouvrirSite(context, (v) =>
    v.url.includes('/rest/v1/tags') ? { status: 201, corps: { id: ID_ETIQUETTE, user_id: ID_JOUEUR, name: 'x', created_at: '2026-01-01T00:00:00Z', color: COULEUR_ETIQUETTE } } : { status: 201 },
  );

  await ouvrirApercu(page);
  await expect(page.getByRole('button', { name: /^Lancer/ })).toBeVisible();
  expect(banc.rest, 'aucune requête avant Lancer').toHaveLength(0);

  await page.getByRole('button', { name: /^Lancer/ }).click();
  await expect.poll(() => banc.rest.length, { timeout: 45_000 }).toBeGreaterThanOrEqual(2);

  const [creation, pose] = banc.rest;
  expect(creation!.methode).toBe('POST');
  expect(new URL(creation!.url).pathname + new URL(creation!.url).search).toBe('/rest/v1/tags?select=*');
  expect(creation!.corps).toEqual({ user_id: ID_JOUEUR, name: 'Statut · Garder', color: COULEUR_ETIQUETTE });
  expect(creation!.entetes.prefer).toBe('return=representation');
  expect(pose!.methode).toBe('POST');
  expect(new URL(pose!.url).pathname).toBe('/rest/v1/user_card_tags');
  expect(pose!.corps).toEqual({ user_card_id: ID_EXEMPLAIRE, tag_id: ID_ETIQUETTE });
  for (const v of banc.rest) {
    expect(v.entetes.authorization).toBe(`Bearer ${JETON_TEMOIN}`);
    expect(v.entetes.apikey).toBe(CLE_PUBLIQUE);
    expect(v.entetes['content-profile']).toBe('public');
    expect(v.entetes['content-type']).toBe('application/json');
    expect(v.entetes.accept).toBe('application/json');
  }
  expect(banc.externes).toEqual([]);

  // Non-fuite (T-020) : ni jeton ni jeton de rafraîchissement dans le stockage, la console, la page.
  await expect.poll(async () => (await toutLeStockage(page)).includes(ID_ETIQUETTE), { timeout: 15_000 }).toBe(true);
  const stockage = await toutLeStockage(page);
  for (const secret of [JETON_TEMOIN, REFRESH_TEMOIN, COOKIE_SESSION]) {
    expect(stockage).not.toContain(secret);
    expect(consoles.join('\n')).not.toContain(secret);
    expect(await page.content()).not.toContain(secret);
    expect(await banc.page.content()).not.toContain(secret);
  }
});

test('401 sur la création : arrêt immédiat, une seule requête, aucune autre tentative', async ({ context, pageCollection: page }) => {
  test.setTimeout(90_000);
  await amorcer(page);
  const banc = await ouvrirSite(context, () => ({ status: 401, corps: { message: 'JWT expired' } }));
  await ouvrirApercu(page);
  await page.getByRole('button', { name: /^Lancer/ }).click();
  await expect.poll(() => banc.rest.length, { timeout: 20_000 }).toBe(1);
  await expect(page.getByTestId('zone-execution')).toContainText(/Lot arrêté.*réponse 401/, { timeout: 20_000 });
  // Plus longtemps que le plus long écart possible (0,2 s + 0,1 s) : aucune seconde tentative.
  await page.waitForTimeout(11_000);
  expect(banc.rest).toHaveLength(1);
  expect(await toutLeStockage(page)).not.toContain(JETON_TEMOIN);
  expect(banc.externes).toEqual([]);
});

test('sans session : aucune requête, arrêt « jeton-absent »', async ({ context, pageCollection: page }) => {
  test.setTimeout(90_000);
  await amorcer(page);
  const banc = await ouvrirSite(context, () => ({ status: 201 }), false);
  await ouvrirApercu(page);
  await page.getByRole('button', { name: /^Lancer/ }).click();
  await expect(page.getByTestId('zone-execution')).toContainText(/Lot arrêté.*résultat hors contrat ou inconnu/, { timeout: 20_000 });
  expect(banc.rest).toHaveLength(0);
  expect(banc.externes).toEqual([]);
});
