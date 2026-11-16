import { allerA, chargerCollectionFictive, expect, test } from './extension';

// Épuration (2026-11-16) : les blocs secondaires sont repliés, avec un résumé visible, et se déplient au clavier.
test('les blocs de l’onglet Synchro sont repliés avec un résumé et se déplient au clavier', async ({ pageCollection: page }) => {
  await allerA(page, 'synchro', false);
  for (const id of ['taches', 'prix', 'historique-bloc']) {
    const bouton = page.getByTestId(`bloc-${id}-bouton`);
    await expect(bouton).toHaveAttribute('aria-expanded', 'false');
    await expect(bouton).not.toHaveText(/^\s*$/);
  }
  const prix = page.getByTestId('bloc-prix-bouton');
  await prix.focus();
  await page.keyboard.press('Enter');
  await expect(prix).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(prix).toHaveAttribute('aria-expanded', 'false');
});

test('les blocs de l’onglet Collection et du Tableau de bord sont repliés par défaut', async ({ pageCollection: page }) => {
  await chargerCollectionFictive(page);
  await allerA(page, 'collection', false);
  for (const id of ['analyses', 'evolution-bloc']) await expect(page.getByTestId(`bloc-${id}-bouton`)).toHaveAttribute('aria-expanded', 'false');
  await allerA(page, 'tableau-de-bord', false);
  await expect(page.getByTestId('bloc-sante-bouton')).toHaveAttribute('aria-expanded', 'false');
});
