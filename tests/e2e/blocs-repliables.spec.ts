import { allerA, chargerCollectionFictive, ecrireJeuRiche, expect, test } from './extension';

// Épuration (2026-11-16) : les blocs secondaires sont repliés avec un résumé, se déplient au clavier, et leur contenu replié est hors tabulation.
test('tableau de bord : santé repliée avec la pastille et l’âge en résumé', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await page.evaluate(() => chrome.storage.local.set({ syncAuto: true }));
  await page.reload();
  await allerA(page, 'tableau-de-bord');
  const bouton = page.getByTestId('sante-synchro').getByRole('button', { name: /^Santé de la synchro/ });
  await expect(bouton).toHaveAttribute('aria-expanded', 'false');
  await expect(bouton).toContainText('À jour');
  await bouton.focus();
  await page.keyboard.press('Enter');
  await expect(bouton).toHaveAttribute('aria-expanded', 'true');
});

test('tableau de bord : une synchro arrêtée ouvre la santé et montre la pastille', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await page.evaluate(() =>
    chrome.storage.local.set({
      syncAuto: true,
      statutSynchro: {
        version: 2, etat: 'arret', page: 2, pages: 10, raison: 'code-http', codeHttp: 403, le: Date.now(), ajoutees: 0, etiquettes: 0, prix: 0,
        etape: 'pages', prixFaits: null, prixPrevus: null, debut: Date.now() - 10_000,
      },
    }),
  );
  await allerA(page, 'tableau-de-bord');
  const bouton = page.getByTestId('sante-synchro').getByRole('button', { name: /^Santé de la synchro/ });
  await expect(bouton).toContainText('Erreur');
  await expect(bouton).toHaveAttribute('aria-expanded', 'true');
});

test('collection : analyses et évolution repliées, contenu hors tabulation', async ({ pageCollection: page }) => {
  await chargerCollectionFictive(page);
  await allerA(page, 'collection');
  for (const id of ['analyse-doublons', 'evolution']) {
    const section = page.getByTestId(id);
    const bouton = section.getByRole('button').first();
    await expect(bouton).toHaveAttribute('aria-expanded', 'false');
    await expect(section.locator('[id$="-contenu"], .wm-repli-contenu').first()).toHaveClass(/invisible/);
  }
});

test('synchro : tâches, prix, historique repliés avec résumé, dépliés au clavier', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await allerA(page, 'synchro');
  for (const id of ['taches', 'fraicheur-prix', 'historique']) {
    const bouton = page.getByTestId(id).getByRole('button').first();
    await expect(bouton).toHaveAttribute('aria-expanded', 'false');
  }
  const prix = page.getByTestId('fraicheur-prix').getByRole('button').first();
  await prix.focus();
  await page.keyboard.press('Space');
  await expect(prix).toHaveAttribute('aria-expanded', 'true');
});

test('lots : écarts avec le site et cadence repliés dans l’aperçu', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await allerA(page, 'lots');
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  for (const nom of [/^Écarts avec le site/, /^Cadence d’envoi/]) {
    await expect(page.getByRole('button', { name: nom })).toHaveAttribute('aria-expanded', 'false');
  }
});

test('tableau de bord : santé en quatre lignes Lecture, Étiquettes, Prix, Ignorées', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await page.evaluate(() => chrome.storage.local.set({ syncAuto: true }));
  await page.reload();
  await allerA(page, 'tableau-de-bord');
  await page.getByTestId('sante-synchro').getByRole('button', { name: /^Santé de la synchro/ }).click();
  const lignes = page.getByTestId('lignes-sante').getByRole('listitem');
  await expect(lignes).toHaveCount(4);
  await expect(lignes.nth(0)).toContainText('Lecture');
  await expect(lignes.nth(1)).toContainText('5 étiquettes lues');
  await expect(lignes.nth(2)).toContainText('Prix');
  await expect(lignes.nth(3)).toContainText('2 actions ignorées');
  await expect(lignes.nth(3).getByRole('link', { name: 'Gérer les actions ignorées' })).toBeVisible();
});
