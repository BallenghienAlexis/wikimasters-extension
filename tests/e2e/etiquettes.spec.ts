import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './extension';

// Tout est fictif et le site n’est jamais contacté : toute requête http(s) est bloquée et comptée.
const FIXTURE = JSON.parse(fs.readFileSync(path.resolve('tests/e2e/fixtures/collection-etiquettes.json'), 'utf8')) as {
  preferences: { version: 2; mesThemes: string[]; amis: { nom: string; themes: string[] }[] };
  cartes: Record<string, unknown>[];
};

const NB = ' ';
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const carteComplete = (c: Record<string, unknown>): object => ({
  url: null,
  favori: false,
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: 'assistant',
  ...c,
});

async function amorcer(page: Page, cartes: object[], preferences: object): Promise<void> {
  await page.evaluate(
    async ([c, p]) => {
      // Le drapeau des amis initiaux évite la fusion de ceux de src/config/amis.ts (G2).
      await chrome.storage.local.set({ collection: { version: 2, cartes: c }, preferences: p, amisInitiaux: 999 });
    },
    [cartes, preferences] as const,
  );
  await page.reload();
}

const amorcerFixture = (page: Page, amis = FIXTURE.preferences.amis): Promise<void> =>
  amorcer(page, FIXTURE.cartes.map(carteComplete), { ...FIXTURE.preferences, amis });

const ouvrirApercu = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(page.getByTestId('etiquettes-prevues')).toBeVisible();
};

const ligne = (page: Page, nom: string) => page.getByTestId('etiquettes-prevues').locator('table tbody tr').filter({ has: page.getByRole('cell', { name: nom, exact: true }) });

test.beforeEach(async ({ context }) => {
  // Aucune requête vers l’extérieur : le test échoue si l’une d’elles est tentée.
  await context.route(
    (url) => url.protocol.startsWith('http'),
    (route) => route.abort(),
  );
});

test('liste les étiquettes prévues avec leurs nombres, sans requête ni lecture du jeton', async ({ context, pageCollection: page }) => {
  const externes: string[] = [];
  context.on('request', (r) => {
    if (!r.url().startsWith('chrome-extension:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externes.push(r.url());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cookies: number };
    w.__cookies = 0;
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (desc?.get && desc.set) {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get() {
          w.__cookies += 1;
          return desc.get!.call(document);
        },
        set(v: string) {
          desc.set!.call(document, v);
        },
      });
    }
  });
  await amorcerFixture(page);
  await ouvrirApercu(page);

  const section = page.getByTestId('etiquettes-prevues');
  await expect(section).toContainText('Étiquettes prévues (envoi pas encore possible)');
  // Les nombres sont lus par cellule : Étiquette, Cartes, Exemplaires, État.
  const cellules = async (nom: string): Promise<string[]> => (await ligne(page, nom).getByRole('cell').allInnerTexts()).map((t) => t.trim());
  expect(await cellules('Statut · Échanger')).toEqual(['Statut · Échanger', '5', '6', 'nouvelle · non disponible']);
  expect(await cellules('#Chien')).toEqual(['#Chien', '1', '2', 'nouvelle · non disponible']);
  expect(await cellules('#Animaux')).toEqual(['#Animaux', '1', '2', 'nouvelle · non disponible']);
  expect(await cellules('#À échanger Léa')).toEqual(['#À échanger Léa', '1', '2', 'nouvelle · non disponible']);
  expect(await cellules('#À échanger Hugo')).toEqual(['#À échanger Hugo', '2', '2', 'nouvelle · non disponible']);
  for (const nom of ['#Tibet', '#Ukraine', '#Barrage', '#Pont']) await expect(ligne(page, nom)).toHaveCount(1);

  // Consultation : on déplie, on referme, on ferme l’aperçu ; toujours rien vers le site.
  await expect(page.getByTestId('total-etiquettes')).toContainText(`Total prévu${NB}:`);
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(section).toBeVisible();

  expect(externes).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __cookies: number }).__cookies)).toBe(0);
});

test('l’avertissement de visibilité précède « Lancer » quand une étiquette est attendue, et manque sinon', async ({ pageCollection: page }) => {
  await amorcerFixture(page);
  await ouvrirApercu(page);

  const avertissement = page.getByTestId('avertissement-visibilite');
  await expect(avertissement).toContainText(
    `Visibilité non vérifiée${NB}: les étiquettes de thème, de statut et d’échange, dont les prénoms de vos amis, sont peut-être visibles par les autres joueurs.`,
  );
  const lancer = page.getByRole('button', { name: /^Lancer/ });
  await expect(lancer).toBeVisible();
  const avant = await avertissement.evaluate(
    (el, bouton) => Boolean(el.compareDocumentPosition(bouton as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await lancer.elementHandle(),
  );
  expect(avant).toBe(true);
  // Rien n’est envoyé : le bouton est inactif sans onglet WikiMasters.
  await expect(lancer).toHaveAttribute('aria-disabled', 'true');

  // Aucune étiquette attendue (cartes à trier) : ni section ni avertissement.
  await amorcer(
    page,
    FIXTURE.cartes.map((c) => carteComplete({ ...c, statut: 'a-trier' })),
    { ...FIXTURE.preferences },
  );
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(page.getByTestId('titre-apercu')).toBeVisible();
  await expect(page.getByTestId('avertissement-visibilite')).toHaveCount(0);
  await expect(page.getByTestId('etiquettes-prevues')).toHaveCount(0);
});

test('« Étiquettes non posées » se déplie au clavier ; un nom de 300 caractères ne déborde pas à 375 px', async ({ pageCollection: page }) => {
  const nomLong = `Ami${'x'.repeat(297)}`;
  expect(nomLong).toHaveLength(300);
  await page.setViewportSize({ width: 375, height: 812 });
  await amorcerFixture(page, [...FIXTURE.preferences.amis, { nom: nomLong, themes: ['chien'] }]);
  await ouvrirApercu(page);

  const details = page.locator('[data-testid="etiquettes-prevues"] details');
  await expect(details).toHaveCount(1);
  const resume = details.locator('summary');
  await expect(resume).toContainText('Étiquettes non posées (1)');
  expect((await resume.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await resume.focus();
  await expect(resume).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(details).toHaveJSProperty('open', true);
  await expect(details).toContainText(`#À échanger ${nomLong}`);
  await expect(details).toContainText('nom trop long');
  await page.keyboard.press('Enter');
  await expect(details).toHaveJSProperty('open', false);
  await page.keyboard.press('Space');
  await expect(details).toHaveJSProperty('open', true);

  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(debordement).toBeLessThanOrEqual(0);
  // La section ne dépasse pas son conteneur : aucun défilement horizontal interne.
  const interne = await page.getByTestId('etiquettes-prevues').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(interne).toBeLessThanOrEqual(0);
});

test.describe('captures et mouvement réduit', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`${colorScheme} ${name} : aperçu des étiquettes sans défilement horizontal`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await amorcerFixture(page, [...FIXTURE.preferences.amis, { nom: `Zoé${'z'.repeat(297)}`, themes: ['chien'] }]);
        await ouvrirApercu(page);
        await page.locator('[data-testid="etiquettes-prevues"] details summary').click();
        const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        // Tableau en colonnes dès 768 px, liste empilée en dessous (DT-05, DT-06).
        await expect(page.locator('[data-testid="etiquettes-prevues"] table')).toBeVisible({ visible: width >= 768 });
        await page.screenshot({ path: `test-results/captures/etiquettes-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }

  test('prefers-reduced-motion : aucune animation ni transition dans la section', async ({ pageCollection: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await amorcerFixture(page);
    await ouvrirApercu(page);
    const anime = await page.getByTestId('etiquettes-prevues').evaluate((section) =>
      [section, ...section.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        return s.animationName !== 'none' || s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
      }).length,
    );
    expect(anime).toBe(0);
  });
});

test('5 000 cartes : l’aperçu s’affiche en moins de 500 ms ; l’export CSV porte les nouveaux libellés', async ({ pageCollection: page }) => {
  const modeles = FIXTURE.cartes;
  const cartes = Array.from({ length: 5000 }, (_, i) => {
    const m = modeles[i % modeles.length]!;
    return carteComplete({ ...m, id: `${String(m.id)}#${i}`, titre: `${String(m.titre)} ${i}`, quantite: 1, idsSite: [`fic-${i}`] });
  });
  const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami fictif ${i}`, themes: ['chien', 'pont', 'barrage', 'tibet', 'ukraine', 'animaux', 'architecture', 'pays', 'geographie', 'nature'] }));
  await amorcer(page, cartes, { version: 2, mesThemes: [], amis });
  await expect(page.getByTestId('resume')).toContainText('5000 exemplaires');

  const duree = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const bouton = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Voir l’aperçu du lot')!;
        const t0 = performance.now();
        const observateur = new MutationObserver(() => {
          if (document.querySelector('[data-testid="etiquettes-prevues"]')) {
            observateur.disconnect();
            resolve(performance.now() - t0);
          }
        });
        observateur.observe(document.body, { childList: true, subtree: true });
        bouton.click();
      }),
  );
  expect(duree).toBeLessThan(500);

  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en CSV' }).click();
  const contenu = fs.readFileSync(await (await telechargement).path(), 'utf8');
  expect(contenu.split('\r\n')[0]).toContain('themes');
  for (const libelle of ['#Chien', '#Pont', '#Tibet', '#Ukraine', '#Barrage']) expect(contenu).toContain(libelle);
});
