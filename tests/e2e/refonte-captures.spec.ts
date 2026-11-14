import { allerA, ecrireJeuRiche, expect, fixerHorloge, ONGLETS, ouvrirIgnorees, ouvrirSectionsReglages, pieger, POINTS_DE_RUPTURE, test, THEMES } from './extension';

// T-310 : captures finales de la refonte (SC-009), 6 onglets + tableau de tri × 3 largeurs × 2 thèmes.
// Données fictives, horloge fixée, aucune requête réelle. Écrites dans `test-results/captures/` (jamais `captures-site/`).

test.describe('Captures finales', () => {
  test.setTimeout(240_000);

  for (const theme of THEMES) {
    test(`SC-009 : captures ${theme}, sans défilement horizontal`, async ({ context, pageCollection: page }) => {
      await fixerHorloge(context);
      await pieger(context);
      await ecrireJeuRiche(page);
      await page.emulateMedia({ colorScheme: theme });
      for (const bp of POINTS_DE_RUPTURE) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        for (const o of [...ONGLETS, { id: 'tableau-de-tri', nom: 'Tableau de tri' }]) {
          if (o.id === 'tableau-de-tri') {
            await allerA(page, 'collection');
            await page.getByRole('button', { name: 'Tableau de tri' }).click();
            await expect(page.getByTestId('tableau-tri')).toBeVisible();
          } else {
            await allerA(page, o.id as (typeof ONGLETS)[number]['id']);
            if (o.id === 'collection') await page.getByRole('button', { name: 'Liste', exact: true }).click();
            if (o.id === 'reglages') {
              await ouvrirSectionsReglages(page);
            }
            if (o.id === 'synchro') await ouvrirIgnorees(page);
          }
          await page.waitForTimeout(250);
          const defile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          expect(defile, `${o.id} ${theme} ${bp.width}`).toBe(false);
          await page.screenshot({ path: `test-results/captures/refonte-${o.id}-${theme}-${bp.name}.png`, fullPage: true });
        }
      }
    });
  }
});
