import { allerA, chargerCollectionFictive, ecrireJeuRiche, expect, test } from './extension';

// Épuration (2026-11-16) : les blocs secondaires sont repliés avec un résumé, se déplient au clavier, et leur contenu replié est hors tabulation.
test('tableau de bord : santé toujours visible avec la pastille et l’âge', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await page.evaluate(() => chrome.storage.local.set({ syncAuto: true }));
  await page.reload();
  await allerA(page, 'tableau-de-bord');
  const sante = page.getByTestId('sante-synchro');
  await expect(sante).toBeVisible();
  await expect(sante).toContainText('À jour');
  await expect(sante.getByRole('button')).toHaveCount(0);
});

test('tableau de bord : aucun bloc repliable, graphiques directement visibles', async ({ pageCollection: page }) => {
  await chargerCollectionFictive(page);
  await allerA(page, 'tableau-de-bord');
  await expect(page.getByTestId('calendrier-activite')).toBeVisible();
  await expect(page.getByTestId('repartition-themes')).toBeVisible();
  await expect(page.getByTestId('repartition-destinations')).toBeVisible();
  await expect(page.getByTestId('profil-affluence')).toBeVisible();
  await expect(page.getByRole('tabpanel').locator('button[aria-expanded]')).toHaveCount(0);
});

test('tableau de bord : une synchro arrêtée montre la pastille d’erreur', async ({ pageCollection: page }) => {
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
  await expect(page.getByTestId('sante-synchro')).toContainText('Erreur');
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

test('lots : écarts avec le site en carte propre, cadence repliée dans l’aperçu', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await allerA(page, 'lots');
  await expect(page.getByTestId('etapes-lots').locator('[aria-current="step"]')).toContainText('1. Choisir');
  await expect(page.getByRole('button', { name: /^Écarts avec le site/ })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await expect(page.getByTestId('etapes-lots').locator('[aria-current="step"]')).toContainText('2. Aperçu');
  for (const nom of [/^Écarts avec le site/, /^Cadence d’envoi/]) {
    await expect(page.getByRole('button', { name: nom })).toHaveAttribute('aria-expanded', 'false');
  }
});

test('tableau de bord : santé en quatre lignes Lecture, Étiquettes, Prix, Ignorées', async ({ pageCollection: page }) => {
  await ecrireJeuRiche(page);
  await page.evaluate(() => chrome.storage.local.set({ syncAuto: true }));
  await page.reload();
  await allerA(page, 'tableau-de-bord');
  const lignes = page.getByTestId('lignes-sante').getByRole('listitem');
  await expect(lignes).toHaveCount(4);
  await expect(lignes.nth(0)).toContainText('Lecture');
  await expect(lignes.nth(1)).toContainText('5 étiquettes lues');
  await expect(lignes.nth(2)).toContainText('Prix');
  await expect(lignes.nth(3)).toContainText('2 actions ignorées');
  await expect(lignes.nth(3).getByRole('link', { name: 'Gérer les actions ignorées' })).toBeVisible();
});

// Tout est replié par défaut (2026-11-17) : le bloc global « Cartes » et les chiffres clés se replient avec un résumé.
test('collection : le bloc « Cartes » est replié avec le nombre de cartes, se déplie au clavier', async ({ pageCollection: page }) => {
  await chargerCollectionFictive(page);
  await allerA(page, 'collection');
  const bloc = page.getByTestId('liste-cartes');
  const bouton = bloc.getByRole('button').first();
  await expect(bouton).toHaveAttribute('aria-expanded', 'false');
  await expect(bouton).toContainText(/\d+ cartes?/);
  await expect(page.getByTestId('tableau-cartes')).toBeHidden();
  await bouton.focus();
  await page.keyboard.press('Enter');
  await expect(bouton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('tableau-cartes')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(bouton).toHaveAttribute('aria-expanded', 'false');
});
