import type { Locator, Page } from '@playwright/test';
import { allerA, chargerCartes, expect, ONGLETS, test } from './extension';

// T-902 : volet e2e de SC-025 (durées calculées par type d’élément, tokens D-08). Données uniquement fictives.

const CARTES = [
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', quantite: 1, statut: 'garder' },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', quantite: 3, statut: 'a-trier' },
];

const duree = (l: Locator, propriete = 'transition-duration') =>
  l.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), propriete);

/** Durées (en secondes) de toutes les transitions d’un élément, `0` si aucune. */
const durees = async (l: Locator, propriete = 'transition-duration') =>
  (await duree(l, propriete)).split(',').map((d) => parseFloat(d));

/** Tous les boutons visibles de la page : durées calculées de leur transition. */
async function dureesDesBoutons(page: Page): Promise<number[]> {
  return page.getByRole('button').evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .flatMap((el) => getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d))),
  );
}

test.beforeEach(async ({ pageCollection }) => {
  await chargerCartes(pageCollection, CARTES);
});

test.describe('SC-025 : durées calculées', () => {
  test('SC-025 : les tokens de mouvement résolus valent 0,2 / 0,4 / 0,65 / 0,9 s', async ({ pageCollection: page }) => {
    const v = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return ['--d-fast', '--d-base', '--d-move', '--d-bar'].map((n) => s.getPropertyValue(n).trim());
    });
    expect(v.map(parseFloat)).toEqual([0.2, 0.4, 0.65, 0.9]);
  });

  test('SC-025 : au moins un bouton de la page de gestion a une transition de 0,2 s', async ({ pageCollection: page }) => {
    // On parcourt les six onglets : le critère porte sur « au moins un bouton » de l’interface.
    const toutes: number[] = [];
    for (const { id } of ONGLETS) {
      await allerA(page, id);
      toutes.push(...(await dureesDesBoutons(page)));
    }
    expect(toutes).toContain(0.2);
  });

  test('SC-025 : colonne et carte du tableau de tri → 0,2 s (--d-fast)', async ({ pageCollection: page }) => {
    await allerA(page, 'collection');
    await page.getByRole('button', { name: 'Tableau de tri' }).click();
    expect(await durees(page.getByTestId('colonne-tri-garder'))).toEqual([0.2]);
    expect(await durees(page.getByTestId('carte-tri'), 'transition-duration')).toEqual([0.2]);
  });

  test('SC-025 : chevron et panneau dépliable → 0,4 s (--d-base)', async ({ pageCollection: page }) => {
    await allerA(page, 'reglages');
    const chevron = page.locator('.wm-chevron');
    expect(await durees(chevron)).toEqual([0.4]);
    const repli = page.locator('.wm-repli');
    expect(await durees(repli)).toEqual([0.4]);
    expect(await duree(repli, 'transition-property')).toBe('grid-template-rows');
  });

  test('SC-025 : remplissage de barre → 0,9 s (--d-bar), transform', async ({ pageCollection: page }) => {
    // Synchro en cours (bail valide) pour que la barre soit rendue.
    await page.evaluate((v) => chrome.storage.local.set(v), {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: {
        version: 2, etat: 'en-cours', page: 11, pages: 40, raison: null, codeHttp: null, le: Date.now(),
        ajoutees: 0, etiquettes: 0, prix: 0, etape: 'pages', prixFaits: null, prixPrevus: null, debut: Date.now() - 60_000,
      },
    });
    await page.reload();
    await allerA(page, 'synchro');
    const barre = page.locator('.wm-barre-remplissage');
    await expect(barre.first()).toBeAttached();
    expect(await durees(barre)).toEqual([0.9]);
    expect(await duree(barre, 'transition-property')).toBe('transform');
  });
});
