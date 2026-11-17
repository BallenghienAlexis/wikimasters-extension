import { allerA, chargerCartes, expect, ouvrirBloc, test } from './extension';

// Étoile de favori, tri par favori et thèmes choisis (Alexis, 2026-11-17). Données uniquement fictives.
const CARTES = [
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', favori: false },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', favori: true },
  { id: 'c', titre: 'Abeille fictive', rarete: 'Rare', favori: false },
];

test.describe('étoile de favori', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
    await ouvrirBloc(pageCollection, 'liste-cartes');
  });

  test('cocher puis décocher au clavier, choix gardé en stockage, aucun envoi au clic', async ({ pageCollection: page }) => {
    const etoile = page.getByRole('button', { name: 'Mettre Zèbre fictif en favori' });
    await etoile.focus();
    await page.keyboard.press('Enter');
    const coche = page.getByRole('button', { name: 'Retirer Zèbre fictif des favoris' });
    await expect(coche).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('À envoyer au site (lot Favoris)').first()).toBeVisible();
    const choix = await page.evaluate(async () => {
      const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: { id: string; choixFavori?: boolean | null }[] } };
      return collection.cartes.find((c) => c.id === 'a')?.choixFavori;
    });
    expect(choix).toBe(true);
    await coche.click();
    await expect(page.getByRole('button', { name: 'Mettre Zèbre fictif en favori' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('tri par favori : favoris d’abord en croissant', async ({ pageCollection: page }) => {
    const entete = page.getByTestId('tableau-cartes').getByRole('columnheader', { name: 'Favori' });
    await entete.getByRole('button').click();
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    const premier = await page.getByTestId('tableau-cartes').locator('tbody tr').first().locator('td').first().textContent();
    expect(premier).toContain('Élan');
  });
});

test.describe('thèmes choisis', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
    await ouvrirBloc(pageCollection, 'liste-cartes');
  });

  test('4 thèmes au plus, Échap ne change rien, Enregistrer garde le choix', async ({ pageCollection: page }) => {
    await page.getByRole('button', { name: 'Modifier les thèmes de Zèbre fictif' }).click();
    const dialogue = page.getByRole('dialog', { name: 'Thèmes de Zèbre fictif' });
    await expect(dialogue).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogue).toBeHidden();
    await expect(page.getByText('Thèmes choisis par vous')).toHaveCount(0);

    await page.getByRole('button', { name: 'Modifier les thèmes de Zèbre fictif' }).click();
    const cases = dialogue.getByRole('checkbox');
    for (let i = 0; i < 4; i++) await cases.nth(i).check();
    await expect(cases.nth(4)).toBeDisabled();
    await expect(dialogue.getByText('4 sur 4 thèmes choisis')).toBeVisible();
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialogue).toBeHidden();
    await expect(page.getByText('Thèmes choisis par vous')).toHaveCount(1);
  });
});
