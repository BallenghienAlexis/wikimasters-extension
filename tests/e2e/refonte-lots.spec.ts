import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ORIGINE_REST, NOM_COOKIE_SESSION } from '../../src/config/synchro';
import { allerA, carteComplete, expect, test } from './extension';

// T-311 : onglet Lots (SC-015, SC-016 Lancer, SC-006 aperçu, SC-024 Lots). Données uniquement fictives ; le vrai site
// n'est jamais contacté (toute requête http(s) est interceptée).
//
// Contrat de sélecteurs attendu du dev-ui (onglet « Lots », après un clic sur « Voir l’aperçu du lot », libellé conservé) :
//  - `data-testid="tableau-lots"` : section du tableau ; un `table` (role=table) au-dessus de 600 px, masqué sous 600 px ;
//  - en-têtes (role=columnheader) « Famille », « Actions » (chacun avec un `button` de 44 px, `aria-sort`) et « Ordre »
//    (SANS bouton, non triable) ; première colonne = case à cocher ;
//  - `data-testid="ligne-lot"` : une ligne (ou carte empilée sous 600 px) par lot, avec l’attribut `data-famille`
//    (`etiquettes` | `encheres` | `defausses` | `suppressions` | `lectures`) ; contient :
//      · `input[type=checkbox]` (role checkbox, nom accessible « Inclure le lot <Famille> », coché par défaut, 44 px),
//      · `data-testid="famille-lot"` (libellés « Étiquettes », « Enchères », « Défausses »),
//      · `data-testid="nb-actions-lot"` (nombre d’actions du lot, entier seul),
//      · `data-testid="ordre-lot"` (rang d’application dans `lot.ts`, entier seul, 1 = premier) ;
//  - sous 600 px : `select` « Trier par » (options « Famille », « Actions ») et bouton « Sens » (`aria-pressed`), 44 px ;
//  - `data-testid="duree-lots"` : « Durée estimée : environ N min » pour les seuls lots cochés ;
//  - `data-testid="resume-lots"` : résumé du lot, contient « N actions écartées » (« 1 action écartée » au singulier) ;
//  - `data-testid="actions-ecartees"` : liste des actions écartées par une ignorée, chaque `li` avec sa raison
//    (« action ignorée » ou « création ignorée ») ;
//  - `data-testid="avertissement"` : un encadré par avertissement, classe `border-vendre`, commençant par « ⚠ » ;
//    visibilité des étiquettes (« visibles des autres joueurs ») et défausse (« définitive ») ;
//  - `data-testid="ecarts-lots"` : écarts avec le site (`li` par carte, textes « Attendue, absente du site : … ») ;
//  - `data-testid="barre-lancer"` : conteneur du bouton « Lancer… » (position `sticky` ou `fixed` sous 600 px) ;
//  - bouton `Lancer…` (nom /^Lancer/) : toujours présent dès qu’un aperçu existe ; désactivé = `aria-disabled="true"`,
//    `aria-describedby` → élément portant la raison écrite (dont « Reprise possible à HH:MM » pendant la pause,
//    « Aucun lot n’est coché. » quand rien n’est coché).

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const SITE = fs.readFileSync(path.resolve('tests/e2e/fixtures/site-vide.html'), 'utf8');
const EX_GARDE = 'aaaaaaaa-0000-4000-8000-000000000001';
const EX_DEFAUSSE = 'aaaaaaaa-0000-4000-8000-000000000002';
const EX_VENTE = 'aaaaaaaa-0000-4000-8000-000000000003';

const GARDE = { id: 'SR|Zorglub fictif', titre: 'Zorglub fictif', rarete: 'SR', statut: 'garder', decidePar: 'moi', idsSite: [EX_GARDE], valeurMarchande: 40 };
const DEFAUSSE = { id: 'C|Brimborion fictif', titre: 'Brimborion fictif', rarete: 'C', statut: 'defausser', decidePar: 'moi', idsSite: [EX_DEFAUSSE], valeurMarchande: 3 };
const VENTE = { id: 'R|Tromblon fictif', titre: 'Tromblon fictif', rarete: 'R', statut: 'vendre', decidePar: 'moi', idsSite: [EX_VENTE], valeurMarchande: 100, prixCible: 50 };
const TOUTES = [GARDE, DEFAUSSE, VENTE];

async function amorcer(page: Page, cartes: Record<string, unknown>[], extra: Record<string, unknown> = {}): Promise<void> {
  await page.evaluate(
    async ([c, e]) => {
      await chrome.storage.local.set({
        collection: { version: 3, cartes: c },
        preferences: { version: 2, mesThemes: [], amis: [] },
        amisInitiaux: 999,
        syncAuto: false,
        ...(e as object),
      });
    },
    [cartes.map(carteComplete), extra] as const,
  );
  await page.reload();
}

async function ouvrirApercu(page: Page): Promise<void> {
  await allerA(page, 'lots');
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(page.getByTestId('tableau-lots')).toBeVisible();
}

const lignes = (page: Page) => page.getByTestId('tableau-lots').getByTestId('ligne-lot').locator('visible=true');
const ligneDe = (page: Page, famille: string) => lignes(page).and(page.locator(`[data-famille="${famille}"]`));
const enTete = (page: Page, nom: RegExp) => page.getByTestId('tableau-lots').getByRole('columnheader', { name: nom });
const lancer = (page: Page) => page.getByRole('button', { name: /^Lancer/ });

test.setTimeout(60_000);

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  );
});

test.describe('SC-015 : tableau des lots cochables (AC1)', () => {
  test.beforeEach(async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
  });

  test('SC-015 : un lot par famille, tous cochés par défaut, cases de 44 px', async ({ pageCollection: page }) => {
    await expect(page.getByTestId('tableau-lots').getByRole('table')).toBeVisible();
    for (const nom of [/^Famille/, /^Actions/, /^Ordre/]) await expect(enTete(page, nom)).toBeVisible();
    for (const famille of ['etiquettes', 'encheres', 'defausses']) await expect(ligneDe(page, famille)).toHaveCount(1);
    await expect(ligneDe(page, 'defausses').getByTestId('famille-lot')).toHaveText('Défausses');
    await expect(ligneDe(page, 'encheres').getByTestId('famille-lot')).toHaveText('Enchères');
    await expect(ligneDe(page, 'etiquettes').getByTestId('famille-lot')).toHaveText('Étiquettes');
    const cases = lignes(page).getByRole('checkbox');
    await expect(cases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(cases.nth(i)).toBeChecked();
      const boite = await cases.nth(i).boundingBox();
      expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(boite?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expect(ligneDe(page, 'defausses').getByRole('checkbox')).toHaveAccessibleName(/^Inclure le lot Défausses/);
  });

  test('SC-015 : « Famille » et « Actions » sont triables (aria-sort), « Ordre » ne l’est pas', async ({ pageCollection: page }) => {
    await expect(enTete(page, /^Ordre/).getByRole('button')).toHaveCount(0);
    const famille = enTete(page, /^Famille/);
    const bouton = famille.getByRole('button');
    await expect(famille).toHaveAttribute('aria-sort', 'none');
    const boite = await bouton.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
    await bouton.click();
    await expect(famille).toHaveAttribute('aria-sort', 'ascending');
    await expect(lignes(page).getByTestId('famille-lot')).toHaveText(['Défausses', 'Enchères', 'Étiquettes']);
    await bouton.click();
    await expect(famille).toHaveAttribute('aria-sort', 'descending');
    await expect(lignes(page).getByTestId('famille-lot')).toHaveText(['Étiquettes', 'Enchères', 'Défausses']);
    await bouton.click();
    await expect(famille).toHaveAttribute('aria-sort', 'none');
    await expect(enTete(page, /^Actions/).getByRole('button')).toBeVisible();
  });

  test('SC-015 : le tri n’affecte que l’affichage (rangs « Ordre » et stockage inchangés)', async ({ pageCollection: page }) => {
    const rangs = async (): Promise<Record<string, string>> => {
      const r: Record<string, string> = {};
      for (const famille of ['etiquettes', 'encheres', 'defausses']) r[famille] = (await ligneDe(page, famille).getByTestId('ordre-lot').textContent())?.trim() ?? '';
      return r;
    };
    const avant = await rangs();
    expect(Object.values(avant).sort()).toEqual(['1', '2', '3']);
    const stockage = (): Promise<string> => page.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
    const stockageAvant = await stockage();
    await enTete(page, /^Famille/).getByRole('button').click();
    expect(await rangs()).toEqual(avant);
    expect(await stockage()).toBe(stockageAvant);
  });

  test('SC-015 : sous 600 px, cartes empilées, tri par « Trier par » et « Sens », « Lancer » collant', async ({ pageCollection: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const tableau = page.getByTestId('tableau-lots');
    await expect(tableau.getByRole('table')).toBeHidden();
    await expect(lignes(page)).toHaveCount(3);
    const choix = tableau.getByLabel('Trier par');
    const sens = tableau.getByRole('button', { name: 'Sens' });
    for (const el of [choix, sens]) expect((await el.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await choix.selectOption({ label: 'Famille' });
    await expect(lignes(page).getByTestId('famille-lot')).toHaveText(['Défausses', 'Enchères', 'Étiquettes']);
    await expect(sens).toHaveAttribute('aria-pressed', 'true');
    await sens.click();
    await expect(sens).toHaveAttribute('aria-pressed', 'false');
    const position = await page.getByTestId('barre-lancer').evaluate((el) => getComputedStyle(el).position);
    expect(['sticky', 'fixed']).toContain(position);
    await expect(lancer(page)).toBeInViewport();
  });

  test('SC-015 : à 768 px le tableau complet est rétabli', async ({ pageCollection: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('tableau-lots').getByRole('table')).toBeVisible();
    await expect(page.getByTestId('tableau-lots').getByLabel('Trier par')).toBeHidden();
  });
});

test.describe('SC-015 : durée, avertissements et écarts (AC2)', () => {
  test('SC-015 : durée « environ N min » des seuls lots cochés', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
    const duree = page.getByTestId('duree-lots');
    await expect(duree).toContainText(/Durée estimée\s*:\s*environ 1 min/);
    for (const c of await lignes(page).getByRole('checkbox').all()) await c.uncheck();
    await expect(duree).toContainText(/environ 0 min/);
    await ligneDe(page, 'defausses').getByRole('checkbox').check();
    await expect(duree).toContainText(/environ 1 min/);
  });

  test('SC-015 : avertissements en encadrés border-vendre avec ⚠ (visibilité des étiquettes, défausse définitive)', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
    const avertissements = page.getByTestId('avertissement');
    const visibilite = avertissements.filter({ hasText: /visibles des autres joueurs/ });
    const definitive = avertissements.filter({ hasText: /définitive/ });
    for (const a of [visibilite, definitive]) {
      await expect(a).toHaveCount(1);
      await expect(a).toHaveClass(/border-vendre/);
      await expect(a).toContainText('⚠');
    }
  });

  test('SC-015 : écarts avec le site listés', async ({ pageCollection: page }) => {
    await amorcer(page, [GARDE]);
    await ouvrirApercu(page);
    const ecarts = page.getByTestId('ecarts-lots');
    await expect(ecarts).toContainText('Zorglub fictif');
    await expect(ecarts).toContainText(/Attendue, absente du site\s*:/);
    await expect(ecarts).toContainText('Statut · Garder');
  });
});

test.describe('SC-006 : ignorées filtrées de l’aperçu (AC4)', () => {
  test('SC-006 : une action ignorée est écartée, comptée « 1 action écartée »', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES, {
      ignorees: { version: 1, entrees: [{ type: 'defausse', idCarte: DEFAUSSE.id, parametre: null, portee: 'synchro', date: Date.now() }] },
    });
    await ouvrirApercu(page);
    await expect(page.getByTestId('resume-lots')).toContainText('1 action écartée');
    await expect(page.getByTestId('actions-ecartees')).toContainText('action ignorée');
    await expect(ligneDe(page, 'defausses')).toHaveCount(0);
    await expect(ligneDe(page, 'encheres')).toHaveCount(1);
  });

  test('SC-006 : une création ignorée écarte les poses, raison « création ignorée »', async ({ pageCollection: page }) => {
    await amorcer(page, [GARDE], {
      ignorees: { version: 1, entrees: [{ type: 'creation-etiquette', idCarte: GARDE.id, parametre: 'Statut · Garder', portee: 'synchro', date: Date.now() }] },
    });
    await ouvrirApercu(page);
    await expect(page.getByTestId('resume-lots')).toContainText(/[2-9] actions écartées/);
    await expect(page.getByTestId('actions-ecartees')).toContainText('création ignorée');
    await expect(page.getByTestId('actions-ecartees')).toContainText('Statut · Garder');
  });

  test('SC-006 : sans ignorée, aucun compteur d’actions écartées', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
    await expect(page.getByTestId('resume-lots')).not.toContainText(/action(s)? écartée/);
  });
});

test.describe('SC-016 : « Lancer » (AC3)', () => {
  test('SC-016 : aucun lot coché, Lancer désactivé avec sa raison liée par aria-describedby', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
    for (const c of await lignes(page).getByRole('checkbox').all()) await c.uncheck();
    const bouton = lancer(page);
    await expect(bouton).toHaveAttribute('aria-disabled', 'true');
    const id = await bouton.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    await expect(page.locator(`#${id}`)).toHaveText('Aucun lot n’est coché.');
  });

  test('SC-016 : pendant la pause de 30 min, Lancer est désactivé : « Reprise possible à HH:MM »', async ({ pageCollection: page }) => {
    const fin = Date.now() + 20 * 60_000;
    await amorcer(page, TOUTES, {
      execution: { version: 2, idLot: 'lot-fictif', etat: 'arretee', traitees: 1, total: 3, lots: [], pauseJusqua: fin, erreur: null },
    });
    await ouvrirApercu(page);
    const bouton = lancer(page);
    await expect(bouton).toHaveAttribute('aria-disabled', 'true');
    const id = await bouton.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    await expect(page.locator(`#${id}`)).toHaveText(/^Reprise possible à \d{2}:\d{2}$/);
    const hh = String(new Date(fin).getHours()).padStart(2, '0');
    // L’heure est locale au navigateur de test : même fuseau que ce processus.
    await expect(page.locator(`#${id}`)).toContainText(`${hh}:`);
    await bouton.click();
    await expect(page.getByTestId('zone-execution')).toBeHidden();
  });

  test('SC-016 : conditions existantes inchangées (aucun onglet WikiMasters ouvert)', async ({ pageCollection: page }) => {
    await amorcer(page, TOUTES);
    await ouvrirApercu(page);
    const id = await lancer(page).getAttribute('aria-describedby');
    await expect(lancer(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator(`#${id}`)).toHaveText('Aucun onglet WikiMasters ouvert.');
  });

  test('SC-016 : Lancer n’envoie que les lots cochés', async ({ context, pageCollection: page }) => {
    test.setTimeout(90_000);
    await amorcer(page, TOUTES);
    const rest: string[] = [];
    const defausses: string[] = [];
    const encheres: string[] = [];
    await context.route(`${ORIGINE_REST}/**`, (route) => {
      rest.push(route.request().url());
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' }, body: '{}' });
    });
    await context.route('https://www.wiki-masters.com/**', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/api/')) {
        if (u.pathname.includes('/discard')) defausses.push(u.pathname);
        else if (u.pathname === '/api/marketplace' && route.request().method() === 'POST') encheres.push(u.pathname);
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' }, body: '{}' });
      }
      return route.fulfill({ contentType: 'text/html', body: SITE });
    });
    await context.addCookies([{ name: NOM_COOKIE_SESSION, value: 'base64-e30', domain: 'www.wiki-masters.com', path: '/', secure: true }]);
    const site = await context.newPage();
    await site.goto('https://www.wiki-masters.com/collection');

    await ouvrirApercu(page);
    await ligneDe(page, 'etiquettes').getByRole('checkbox').uncheck();
    await ligneDe(page, 'encheres').getByRole('checkbox').uncheck();
    await expect(lancer(page)).not.toHaveAttribute('aria-disabled', 'true');
    await lancer(page).click();

    await expect.poll(() => defausses.length, { timeout: 45_000 }).toBe(1);
    expect(defausses[0]).toContain(EX_DEFAUSSE);
    await page.waitForTimeout(1500);
    expect(rest, 'aucune étiquette envoyée : lot décoché').toHaveLength(0);
    expect(encheres, 'aucune enchère envoyée : lot décoché').toHaveLength(0);
  });
});

test.describe('SC-024 : largeurs, thèmes et captures de l’onglet Lots', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`SC-024 : ${colorScheme} ${name}, aucun défilement horizontal`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await amorcer(page, TOUTES, {
          ignorees: { version: 1, entrees: [{ type: 'defausse', idCarte: DEFAUSSE.id, parametre: null, portee: 'synchro', date: Date.now() }] },
        });
        await ouvrirApercu(page);
        await expect(page.getByTestId('duree-lots')).toBeVisible();
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(sw).toBeLessThanOrEqual(cw);
        await page.screenshot({ path: `test-results/captures/lots-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
