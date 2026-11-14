import { allerA, ecrireJeuRiche, expect, fixerHorloge, pieger, POINTS_DE_RUPTURE, test, THEMES } from './extension';

// Non-régression visuelle de la conformité à la maquette (« Refonte IHM · variante 1, v15 », `ecarts-maquette.md`) :
// des mesures de mise en page et de style calculé, indépendantes des polices et des captures, qui échouent si
// l’extension s’éloigne de nouveau de la maquette. Données fictives, horloge fixée, aucune requête réelle.

test.describe('Conformité à la maquette', () => {
  test.setTimeout(240_000);

  for (const theme of THEMES) {
    test(`maquette v15 : en-tête, onglets, encadrés et cartes (${theme})`, async ({ context, pageCollection: page }) => {
      await fixerHorloge(context);
      await pieger(context);
      await ecrireJeuRiche(page);
      await page.emulateMedia({ colorScheme: theme });
      for (const bp of POINTS_DE_RUPTURE) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await allerA(page, 'tableau-de-bord');

        // En-tête sur une ligne : titre, « Dernière synchro », pastille ; contenu centré, 1280 px au plus.
        const entete = page.locator('header').first();
        const titre = entete.getByRole('heading', { level: 1 });
        await expect(titre).toHaveText('WM Collection');
        if (bp.width >= 768) {
          const [bEntete, bTitre] = [await entete.boundingBox(), await titre.boundingBox()];
          expect(bEntete?.height ?? 999, `${bp.name} en-tête`).toBeLessThan(64);
          expect(bTitre?.y ?? 0).toBeGreaterThanOrEqual(bEntete?.y ?? 0);
        }
        const largeurMain = await page.locator('main').evaluate((el) => el.getBoundingClientRect().width);
        expect(largeurMain).toBeLessThanOrEqual(1280);

        // Onglets : onglet inactif en texte `paper` non gras (D-12), onglet actif souligné et en gras.
        const onglets = page.getByRole('tablist', { name: 'Sections' }).getByRole('tab');
        const style = (i: number) => onglets.nth(i).evaluate((el) => ({ poids: Number(getComputedStyle(el).fontWeight), couleur: getComputedStyle(el).color }));
        const actif = await style(0);
        expect(actif.poids).toBeGreaterThanOrEqual(600);
        expect((await style(1)).poids).toBeLessThan(600);
        const paper = await page.evaluate(() => {
          const t = document.createElement('span');
          t.style.color = 'var(--color-paper)';
          document.body.append(t);
          const c = getComputedStyle(t).color;
          t.remove();
          return c;
        });
        // Les couleurs sont animées au changement de thème : on attend la valeur finale.
        await expect.poll(async () => (await style(1)).couleur, { message: `${bp.name} onglet inactif` }).toBe(paper);

        // Chaque onglet tient dans la largeur, sans défilement horizontal (SC-009).
        for (const id of ['tableau-de-bord', 'synchro', 'lots', 'collection', 'reglages'] as const) {
          await allerA(page, id);
          const defile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          expect(defile, `${id} ${theme} ${bp.width}`).toBe(false);
        }

        // Lots : encadré de risque compact (une ligne visible + détail replié), jamais un pavé.
        await allerA(page, 'lots');
        const risque = page.getByTestId('bandeau-risque');
        await expect(risque).toBeVisible();
        expect((await risque.boundingBox())?.height ?? 999, `${bp.name} encadré de risque`).toBeLessThan(bp.width < 768 ? 200 : 120);

        // Collection : la liste et les analyses sont dans des cartes (bordure + fond `ink-2`).
        await allerA(page, 'collection');
        for (const id of ['liste-cartes', 'evolution', 'analyse-themes']) {
          const carte = page.getByTestId(id);
          await expect(carte, id).toBeVisible();
          const bordure = await carte.evaluate((el) => getComputedStyle(el).borderTopWidth);
          expect(bordure, `${id} bordure`).not.toBe('0px');
        }

        // Réglages : le résumé de la valeur courante est calé à droite, du côté du chevron.
        await allerA(page, 'reglages');
        const bouton = page.getByRole('button', { name: /^Animations/ });
        const resume = bouton.locator('span.text-muted');
        const [bB, bR] = [await bouton.boundingBox(), await resume.boundingBox()];
        expect((bR?.x ?? 0) + (bR?.width ?? 0), `${bp.name} résumé à droite`).toBeGreaterThan((bB?.x ?? 0) + (bB?.width ?? 0) - 64);
      }
    });
  }
});
