import { allerA, chargerCartes, expect, test } from './extension';

const COLLECTION = {
  cartes: [
    { id: 'a', titre: 'Agrume fictif', rarete: 'C', description: 'agrume', valeurMarchande: 3 },
    { id: 'b', titre: 'Planète fictive', rarete: 'C', description: 'planète lointaine', valeurMarchande: 8 },
  ],
};

test.beforeEach(async ({ pageCollection }) => {
  await chargerCartes(pageCollection, COLLECTION.cartes);
  await allerA(pageCollection, 'reglages');
  // T-309 : section repliée par défaut.
  await pageCollection.getByRole('button', { name: /^Plafond de défausse/ }).click();
});

const champ = (page: import('@playwright/test').Page) => page.getByRole('spinbutton', { name: /Plafond \(1 à 20\)/ });

test('plafond de défausse : 5 par défaut, saisie invalide refusée, avertissement au-dessus de 5, valeur conservée', async ({ pageCollection: page }) => {
  await expect(champ(page)).toHaveValue('5');
  await expect(page.locator('#aide-plafond')).toHaveText('');

  await champ(page).fill('12');
  await expect(page.locator('#aide-plafond')).toContainText('Attention');

  await champ(page).fill('25');
  await expect(page.locator('#aide-plafond')).toContainText('le plafond enregistré reste 12');

  await champ(page).fill('3');
  await expect(page.locator('#aide-plafond')).toHaveText('');

  await champ(page).fill('12');
  await page.reload();
  await page.getByRole('button', { name: /^Plafond de défausse/ }).click();
  await expect(champ(page)).toHaveValue('12');
  await expect(page.locator('#aide-plafond')).toContainText('Attention');
});

test('plafond de défausse : saisie touche par touche, le champ garde le focus', async ({ pageCollection: page }) => {
  await champ(page).fill('');
  await champ(page).pressSequentially('12');
  await expect(champ(page)).toHaveValue('12');
  await expect(champ(page)).toBeFocused();
  await champ(page).press('ArrowUp');
  await champ(page).press('ArrowUp');
  await expect(champ(page)).toHaveValue('14');
  await expect(champ(page)).toBeFocused();
});

test.describe('captures du plafond de défausse', () => {
  const BREAKPOINTS = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`${colorScheme} ${name}`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await champ(page).fill('12');
        await expect(page.locator('#aide-plafond')).toContainText('Attention');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.getByTestId('plafond-defausse').screenshot({ path: `test-results/captures/plafond-${colorScheme}-${name}.png` });
      });
    }
  }
});
