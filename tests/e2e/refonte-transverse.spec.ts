import type { BrowserContext, Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { NOM_COOKIE_SESSION, ORIGINE_REST } from '../../src/config/synchro';
import {
  allerA,
  cartesFictivesRepartie,
  chargerCartes,
  contraste,
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
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', quantite: 1, statut: 'garder', valeurMarchande: 10 },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', quantite: 3, statut: 'a-trier' },
  { id: 'c', titre: 'Abeille fictive', rarete: 'Rare', quantite: 2, statut: 'a-trier', valeurMarchande: 4 },
  { id: 'd', titre: 'Mouette fictive', rarete: 'Commune', quantite: 2, statut: 'vendre', valeurMarchande: 25 },
  { id: 'e', titre: 'Loutre fictive', rarete: 'Rare', quantite: 1, statut: 'en-vente', valeurMarchande: 60 },
  { id: 'f', titre: 'Renard fictif', rarete: 'Commune', quantite: 1, statut: 'defausser', valeurMarchande: 2 },
];

const colonne = (page: Page, statut: string): Locator => page.getByTestId(`colonne-tri-${statut}`);
const carteTri = (page: Page, titre: string): Locator => page.getByTestId('carte-tri').filter({ hasText: titre });
const stockage = (p: Page, cle: string): Promise<unknown> => p.evaluate(async (c) => (await chrome.storage.local.get(c))[c], cle);

async function ouvrirTableauDeTri(page: Page): Promise<void> {
  await allerA(page, 'collection');
  await page.getByRole('button', { name: 'Tableau de tri' }).click();
  await expect(page.getByTestId('tableau-tri')).toBeVisible();
}

async function glisser(page: Page, source: Locator, cible: Locator): Promise<void> {
  const s = (await source.boundingBox())!;
  const c = (await cible.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + 8);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + 20, { steps: 3 });
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
  await page.mouse.up();
}

// ───────────────────────────── SC-011 : aucune requête ─────────────────────────────

test.describe('SC-011 : aucune requête hors extension', () => {
  test.setTimeout(120_000);

  test('SC-011 : six onglets, bandeau déplié, tri, glisser, ignorées : seule la vue liste interroge Wikipédia/Wikidata', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    const banc = await pieger(context);
    await ecrireJeuRiche(page);
    await chargerCartes(page, CARTES);
    // Ignorées stockées (cartes existantes) pour « Reprendre » ; puis, sans recharger, un traitement de synchro en cours pour le bandeau.
    await page.evaluate(
      (n) =>
        chrome.storage.local.set({
          ignorees: { version: 1, entrees: [{ type: 'pose-etiquette', idCarte: 'a', parametre: 'Statut · Garder', portee: 'synchro', date: n - 600_000 }] },
        }),
      MAINTENANT,
    );
    await page.reload();

    // Phase 1 : tous les onglets sauf la Collection (aucune requête, même Wikipédia).
    banc.phase.nom = 'hors-collection';
    for (const o of ONGLETS.filter((x) => x.id !== 'collection')) {
      await allerA(page, o.id);
      await page.waitForTimeout(700);
    }
    // Bandeau déplié (synchro et lots en cours, ici un traitement simulé par le stockage).
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
    await page.waitForTimeout(700);

    // Phase 2 : vue liste de la Collection (Wikipédia et Wikidata autorisés, titre seul), puis tri de la liste.
    banc.phase.nom = 'liste';
    await allerA(page, 'collection');
    await expect(page.getByText(/titres des cartes affichées sont vérifiés/)).toBeVisible();
    await page.getByTestId('tableau-cartes').getByRole('columnheader', { name: 'Titre' }).getByRole('button').click();
    await expect.poll(() => banc.vues.filter((v) => v.phase === 'liste').length, { timeout: 15_000 }).toBeGreaterThan(0);

    // Phase 3 : tableau de tri (flèche, glisser, recherche). On laisse finir une requête éventuellement en vol.
    await page.getByRole('button', { name: 'Tableau de tri' }).click();
    await expect(page.getByTestId('tableau-tri')).toBeVisible();
    await page.waitForTimeout(2000);
    banc.phase.nom = 'tri';
    await page.getByRole('button', { name: 'Déplacer « Zèbre fictif » vers Échanger' }).click();
    await expect(colonne(page, 'echanger').getByTestId('carte-tri')).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 800 });
    await glisser(page, carteTri(page, 'Mouette fictive'), colonne(page, 'garder'));
    await expect(colonne(page, 'garder').getByTestId('carte-tri').filter({ hasText: 'Mouette fictive' })).toHaveCount(1);
    await page.getByLabel('Rechercher une carte').fill('élan');
    await expect(page.getByTestId('carte-tri')).toHaveCount(1);
    await page.waitForTimeout(1500);

    // Retour aux autres onglets : toujours rien.
    banc.phase.nom = 'apres';
    for (const o of ONGLETS.filter((x) => x.id !== 'collection')) {
      await allerA(page, o.id);
      await page.waitForTimeout(500);
    }

    const autres = banc.vues.filter((v) => !/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\/w\/api\.php\?/.test(v.url));
    expect(autres, 'aucune requête vers WikiMasters, Supabase ou un autre hôte').toEqual([]);
    for (const phase of ['hors-collection', 'tri', 'apres']) {
      expect(banc.vues.filter((v) => v.phase === phase), `requêtes en phase « ${phase} »`).toEqual([]);
    }
    expect(banc.vues.filter((v) => v.phase === 'depart')).toEqual([]);
  });

  test('SC-011 : 5 000 cartes, le tableau de tri et le tableau de bord ne déclenchent aucune vérification', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    const banc = await pieger(context);
    await chargerCartes(page, cartesFictivesRepartie(5000));
    banc.phase.nom = 'sans-liste';
    await allerA(page, 'tableau-de-bord');
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.location.hash = 'collection';
    });
    await page.getByRole('button', { name: 'Tableau de tri' }).click();
    await expect(page.getByTestId('tableau-tri')).toBeVisible();
    await page.waitForTimeout(2500);
    // La première bascule a pu laisser partir une requête en vol depuis la vue liste : on regarde la suite.
    const avant = banc.vues.length;
    await colonne(page, 'a-trier').getByRole('button', { name: 'Afficher plus' }).click();
    await page.waitForTimeout(2500);
    expect(banc.vues.length).toBe(avant);
    expect(banc.vues.filter((v) => !/wikipedia|wikidata/.test(v.url))).toEqual([]);
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
    idsSite: [`bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`], statut: 'garder', decidePar: 'moi',
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
    await preparerLot(page); // d’abord le stockage (synchro automatique coupée), puis l’onglet du site
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
    await preparerLot(page); // d’abord le stockage (synchro automatique coupée), puis l’onglet du site
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
    await ignorees.getByRole('button', { name: /^Reprendre « .+ » pour « Loutre fictive \d »$/ }).first().click();
    await page.waitForTimeout(1000);
    expect(banc.rest.length).toBe(avant);
    expect(banc.externes).toEqual([]);
  });
});

// ───────────────────────────── SC-008 : clavier sur les six onglets ─────────────────────────────

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

test.describe('SC-008 : clavier réel (Tab) sur les six onglets', () => {
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

  test('SC-008 : Tab réel dans le tableau de tri, Entrée sur une flèche déplace la carte, le focus la suit', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    await chargerCartes(page, CARTES);
    await ouvrirTableauDeTri(page);
    await page.getByRole('button', { name: 'Tableau de tri' }).focus();
    const cible = page.getByRole('button', { name: 'Déplacer « Zèbre fictif » vers Échanger' });
    let trouve = false;
    for (let i = 0; i < 60 && !trouve; i++) {
      await page.keyboard.press('Tab');
      trouve = await cible.evaluate((el) => el === document.activeElement);
    }
    expect(trouve, 'la flèche de « Zèbre fictif » est atteinte par Tab').toBe(true);
    const contour = await cible.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
    });
    expect(contour).toBe(true);
    await page.keyboard.press('Enter');
    await expect(colonne(page, 'echanger').getByTestId('carte-tri').filter({ hasText: 'Zèbre fictif' })).toHaveCount(1);
    await expect(page.getByTestId('tri-annonce')).toHaveText('« Zèbre fictif » déplacée vers Échanger');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[data-testid="colonne-tri-echanger"]') !== null))
      .toBe(true);
    // La tabulation continue dans la carte déplacée puis vers les suivantes, sans piège.
    const avant = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    await page.keyboard.press('Tab');
    const apres = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    expect(apres).not.toBe(avant);
  });
});

// ───────────────────────────── SC-009 : pas de défilement horizontal ─────────────────────────────

test.describe('SC-009 : scrollWidth ≤ clientWidth', () => {
  test.setTimeout(240_000);

  test('SC-009 : six onglets × 3 largeurs × 2 thèmes, jeu de données complet', async ({ context, pageCollection: page }) => {
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

  test('SC-009 : 5 000 cartes, liste et tableau de tri, 3 largeurs × 2 thèmes', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await chargerCartes(page, cartesFictivesRepartie(5000, 20));
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const bp of POINTS_DE_RUPTURE) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await allerA(page, 'collection');
        await page.getByRole('button', { name: 'Liste', exact: true }).click();
        await expect(page.getByTestId('tableau-cartes').locator('tbody tr')).toHaveCount(200);
        for (const vue of ['Liste', 'Tableau de tri']) {
          await page.getByRole('button', { name: vue, exact: true }).click();
          const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          expect(sw, `${vue} ${theme} ${bp.width}`).toBeLessThanOrEqual(cw);
        }
      }
    }
  });
});

// ───────────────────────────── 5 000 cartes : bornes d'affichage ─────────────────────────────

test.describe('5 000 cartes fictives : 200 lignes, 50 par colonne', () => {
  test('SC-011 : liste à 200 lignes, tableau de tri à 50 cartes par colonne, puis « Afficher plus »', async ({ context, pageCollection: page }) => {
    await fixerHorloge(context);
    await pieger(context);
    await chargerCartes(page, cartesFictivesRepartie(5000));
    await allerA(page, 'collection');
    await expect(page.getByTestId('tableau-cartes').locator('tbody tr')).toHaveCount(200);
    await page.getByRole('button', { name: 'Tableau de tri' }).click();
    for (const s of ['garder', 'echanger', 'vendre', 'defausser', 'a-trier']) {
      await expect(colonne(page, s).getByTestId('carte-tri'), s).toHaveCount(50);
      const nom = { garder: 'Garder', echanger: 'Échanger', vendre: 'Vendre', defausser: 'Défausser', 'a-trier': 'À trier' }[s];
      await expect(page.getByRole('group', { name: `${nom} 1000` })).toBeVisible();
    }
    await colonne(page, 'vendre').getByRole('button', { name: 'Afficher plus' }).click();
    await expect(colonne(page, 'vendre').getByTestId('carte-tri')).toHaveCount(100);
    await expect(colonne(page, 'garder').getByTestId('carte-tri')).toHaveCount(50);
  });
});

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

    test(`SC-026 : aucune durée de transition ni d'animation sur les six onglets`, async ({ pageCollection: page }) => {
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
      await expect(kpis).toHaveCount(4);
      const lire = (): Promise<string[]> => kpis.evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
      const premier = await lire();
      await page.waitForTimeout(1200);
      expect(await lire()).toEqual(premier);
      expect(premier.find((t) => /Exemplaires/.test(t))).toContain('12');
    });

    test('SC-026 : le tri (flèche et glisser) pose la carte sans trajet, getAnimations() reste vide', async ({ pageCollection: page }) => {
      await ouvrirTableauDeTri(page);
      await page.getByRole('button', { name: 'Déplacer « Renard fictif » vers Vendre' }).click();
      await expect(colonne(page, 'vendre').getByTestId('carte-tri').filter({ hasText: 'Renard fictif' })).toHaveCount(1);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      await glisser(page, carteTri(page, 'Élan fictif'), colonne(page, 'garder'));
      await expect(colonne(page, 'garder').getByTestId('carte-tri').filter({ hasText: 'Élan fictif' })).toHaveCount(1);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      expect(await dureesNonNulles(page)).toEqual([]);
      await expect.poll(async () => ((await stockage(page, 'collection')) as { cartes: { titre: string; statut: string }[] }).cartes.find((c) => c.titre === 'Élan fictif')?.statut).toBe('garder');
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

  test('SC-007 : ni jeton, ni cookie, ni clé, ni identifiant d’exemplaire, ni corps de réponse sur les six onglets', async ({ context, pageCollection: page }) => {
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
    // Vue Tableau de tri (cartes, attributs data-id).
    await allerA(page, 'collection');
    await page.getByRole('button', { name: 'Tableau de tri' }).click();
    instantanes.push(await page.content());
    // Bandeau déplié.
    const entete = page.getByTestId('ligne-activite-lots').getByRole('button').first();
    if (await entete.count()) await entete.click();
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

test.describe('Tableau de tri en thème sombre (trous consignés de T-312)', () => {
  for (const bp of POINTS_DE_RUPTURE) {
    test(`SC-009 + D-18 : tableau de tri sombre à ${bp.width} px : disposition, fond sombre, contraste AA, pas de débordement`, async ({ context, pageCollection: page }) => {
      await fixerHorloge(context);
      await pieger(context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await chargerCartes(page, CARTES);
      await ouvrirTableauDeTri(page);
      // Thème sombre effectivement appliqué : le fond de la page est plus sombre que le texte.
      const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const texte = await page.evaluate(() => getComputedStyle(document.body).color);
      const clair = (c: string): number => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0);
      expect(clair(fond), 'fond sombre').toBeLessThan(clair(texte));
      // Disposition (mêmes règles qu'en thème clair).
      const lefts = new Set<number>();
      const tops = new Set<number>();
      for (const s of ['garder', 'echanger', 'vendre', 'defausser', 'a-trier']) {
        const b = (await colonne(page, s).boundingBox())!;
        lefts.add(Math.round(b.x));
        tops.add(Math.round(b.y));
      }
      if (bp.width === 375) expect([lefts.size, tops.size]).toEqual([1, 5]);
      else if (bp.width === 768) expect([lefts.size, tops.size]).toEqual([2, 3]);
      else expect([lefts.size, tops.size]).toEqual([5, 1]);
      // Contraste AA (≥ 4,5) du texte des cartes, des titres de colonne, des flèches et de la mention « en vente ».
      const cibles: [string, Locator][] = [
        ['titre de carte', carteTri(page, 'Élan fictif')],
        ['flèche', page.getByRole('button', { name: 'Déplacer « Élan fictif » vers Défausser' })],
        ['mention en vente', page.getByTestId('tri-en-vente')],
        ['titre de colonne', page.getByRole('group', { name: 'À trier 2' })],
      ];
      for (const [nom, loc] of cibles) {
        expect(await contraste(loc.first()), `contraste ${nom}`).toBeGreaterThanOrEqual(4.5);
      }
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
      await page.screenshot({ path: `test-results/captures/transverse-tableau-de-tri-dark-${bp.name}.png`, fullPage: true });
    });
  }
});
