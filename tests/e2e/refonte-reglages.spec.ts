import type { Page } from '@playwright/test';
import { allerA, chargerCartes, expect, test } from './extension';

// T-309 : onglet Réglages repliable (SC-028, SC-026 réglage). Données uniquement fictives.

const CARTES = [
  { id: 'a', titre: 'Agrume fictif', rarete: 'C', description: 'agrume', valeurMarchande: 3 },
  { id: 'b', titre: 'Planète fictive', rarete: 'C', description: 'planète lointaine', valeurMarchande: 8 },
];

const SECTIONS = ['Synchronisation automatique', 'Sauvegarde', 'Plafond de défausse', 'Étiquettes préexistantes', 'Wikipédia', 'Thèmes', 'Animations'] as const;

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const bouton = (page: Page, titre: string) => page.getByRole('button', { name: new RegExp(`^${titre}`) });

test.beforeEach(async ({ pageCollection }) => {
  await chargerCartes(pageCollection, CARTES);
  await allerA(pageCollection, 'reglages');
});

test.describe('SC-028 : sections repliables', () => {
  test('SC-028 : sept sections fermées par défaut, avec résumé', async ({ pageCollection: page }) => {
    for (const titre of SECTIONS) {
      await expect(bouton(page, titre)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(bouton(page, 'Plafond de défausse')).toContainText('Plafond : 5');
    await expect(bouton(page, 'Animations')).toContainText('Animations : activées');
  });

  test('l’interrupteur de synchro des Réglages suit celui de l’onglet Synchro', async ({ pageCollection: page }) => {
    await bouton(page, 'Synchronisation automatique').click();
    const reglage = page.getByRole('switch', { name: 'Synchronisation automatique' });
    await expect(reglage).toBeChecked();
    await reglage.uncheck();
    await allerA(page, 'synchro');
    await expect(page.getByRole('switch', { name: 'Synchronisation automatique' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('switch', { name: 'Synchronisation automatique' }).click();
    await allerA(page, 'reglages');
    await bouton(page, 'Synchronisation automatique').click();
    await expect(page.getByRole('switch', { name: 'Synchronisation automatique' })).toBeChecked();
  });

  test('SC-028 : le contenu replié est hors tabulation, visible une fois ouvert', async ({ pageCollection: page }) => {
    // Replié, le champ est hors de l’arbre d’accessibilité : on le cible par le testid, pas par le rôle.
    const champ = page.getByTestId('plafond-defausse').locator('input');
    await expect(champ).toBeHidden();
    await expect(page.getByTestId('plafond-defausse')).toHaveCSS('visibility', 'hidden');
    // Tabulations depuis le bouton : le champ replié ne reçoit jamais le focus.
    await bouton(page, 'Plafond de défausse').focus();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      await expect(champ).not.toBeFocused();
    }
    await bouton(page, 'Plafond de défausse').click();
    await expect(bouton(page, 'Plafond de défausse')).toHaveAttribute('aria-expanded', 'true');
    await expect(champ).toBeVisible();
  });

  test('SC-028 : ouverture et fermeture au clavier (Entrée, Espace)', async ({ pageCollection: page }) => {
    const b = bouton(page, 'Sauvegarde');
    await b.focus();
    await page.keyboard.press('Enter');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Exporter une sauvegarde' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(b).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Exporter une sauvegarde' })).toBeHidden();
  });

  test('SC-028 : data-testid plafond-defausse conservé', async ({ pageCollection: page }) => {
    await bouton(page, 'Plafond de défausse').click();
    await expect(page.getByTestId('plafond-defausse')).toBeVisible();
  });

  test('SC-028 : Réglages porte l’interrupteur de synchro, pas la relance (décision d’Alexis, 14/11)', async ({ pageCollection: page }) => {
    for (const titre of SECTIONS) await bouton(page, titre).click();
    const panneau = page.getByRole('tabpanel');
    await expect(panneau.getByRole('switch', { name: /synchronisation automatique/i })).toHaveCount(1);
    await expect(panneau.getByRole('button', { name: /Relancer la synchro/ })).toHaveCount(0);
  });
});

test.describe('SC-026 : réglage Animations', () => {
  const interrupteur = (page: Page) => page.getByRole('switch', { name: /Animations/ }).or(page.getByRole('checkbox', { name: /Animations/ }));

  test('SC-026 : l’interrupteur écrit la clé affichage et pose data-animations sur html', async ({ pageCollection: page }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-animations', 'off');
    await bouton(page, 'Animations').click();
    await interrupteur(page).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-animations', 'off');
    await expect(bouton(page, 'Animations')).toContainText('Animations : désactivées');
    const stocke = await page.evaluate(async () => (await chrome.storage.local.get('affichage')).affichage as unknown);
    expect(stocke).toEqual({ version: 1, animations: false });

    // Persistant après rechargement.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-animations', 'off');
    await expect(bouton(page, 'Animations')).toContainText('Animations : désactivées');

    await bouton(page, 'Animations').click();
    await interrupteur(page).first().click();
    await expect(page.locator('html')).not.toHaveAttribute('data-animations', 'off');
    expect(await page.evaluate(async () => (await chrome.storage.local.get('affichage')).affichage as unknown)).toEqual({ version: 1, animations: true });
  });

  test('SC-026 : animations coupées sans perte de fonction (onglets et sections utilisables)', async ({ pageCollection: page }) => {
    await page.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: false } }));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-animations', 'off');
    await bouton(page, 'Plafond de défausse').click();
    await expect(page.getByRole('spinbutton', { name: /Plafond \(1 à 20\)/ })).toBeVisible();
    // Aucune transition active sur le chevron.
    const duree = await page.locator('.wm-chevron').first().evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(duree.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    await allerA(page, 'collection');
    await allerA(page, 'reglages');
  });

  test('SC-026 : prefers-reduced-motion coupe aussi le mouvement', async ({ pageCollection: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const duree = await page.locator('.wm-chevron').first().evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(duree.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
  });
});

test.describe('SC-028 : captures 3 largeurs × 2 thèmes', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`SC-028 : ${colorScheme} ${name}`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await expect(bouton(page, 'Animations')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `test-results/captures/reglages-replie-${colorScheme}-${name}.png`, fullPage: true });
        await bouton(page, 'Plafond de défausse').click();
        await bouton(page, 'Animations').click();
        await page.screenshot({ path: `test-results/captures/reglages-ouvert-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
