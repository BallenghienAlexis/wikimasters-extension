import { expect, test } from './extension';

const COLLECTION = {
  version: 1,
  cartes: [
    { id: 'a', titre: 'Agrume fictif', rarete: 'C', description: 'agrume', valeurMarchande: 10 },
    { id: 'b', titre: 'Athlète fictif', rarete: 'SR', description: 'athlète belge', valeurMarchande: 100 },
    { id: 'c', titre: 'Planète fictive', rarete: 'C', description: 'planète lointaine', valeurMarchande: 5 },
    { id: 'd', titre: 'Peintre fictif', rarete: 'C', description: 'artiste peintre', favori: true, valeurMarchande: 5 },
    { id: 'e', titre: 'Film fictif', rarete: 'C', description: 'film de 1986', valeurMarchande: 5 },
    { id: 'f', titre: 'Volcan fictif', rarete: 'C', description: 'volcan du Japon' },
  ],
};

const OUVRIR = 'Gérer mes thèmes et mes amis';

test.beforeEach(async ({ pageCollection }) => {
  await pageCollection.setInputFiles('input[type="file"]', {
    name: 'collection.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(COLLECTION)),
  });
  await expect(pageCollection.getByRole('status')).toHaveText('6 cartes importées.');
});

test('trie selon mes thèmes, ceux des amis, le seuil de 15 et la valeur', async ({ pageCollection: page }) => {
  await page.getByRole('button', { name: OUVRIR }).click();

  // Seuls les thèmes présents dans la collection sont demandés.
  await expect(page.getByRole('checkbox', { name: 'Mon thème : #Musique' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mon thème : #Espace' }).check();
  await page.getByRole('button', { name: 'Suivant' }).click();

  await page.getByLabel('Nom de l’ami').fill('Ami fictif');
  await page.getByRole('button', { name: 'Ajouter cet ami' }).click();
  await page.getByRole('group', { name: 'Ce qu’aime Ami fictif' }).getByLabel('#Cinéma').check();
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Aperçu : rien n'est encore appliqué.
  const apercu = page.getByTestId('apercu');
  await expect(apercu).toContainText('Garder : 2');
  await expect(apercu).toContainText('Échanger : 1');
  await expect(apercu).toContainText('Vendre : 1');
  await expect(apercu).toContainText('Défausser : 1');
  await expect(apercu).toContainText('À trier : 1');
  await page.getByRole('button', { name: 'Appliquer ce tri' }).click();

  await expect(page.getByLabel('Statut de Planète fictive')).toHaveValue('garder');
  await expect(page.getByLabel('Statut de Peintre fictif')).toHaveValue('garder');
  await expect(page.getByLabel('Statut de Film fictif')).toHaveValue('echanger');
  await expect(page.getByLabel('Statut de Athlète fictif')).toHaveValue('vendre');
  await expect(page.getByLabel('Statut de Agrume fictif')).toHaveValue('defausser');
  await expect(page.getByLabel('Statut de Volcan fictif')).toHaveValue('a-trier');
  await expect(page.getByText('À échanger avec Ami fictif')).toBeVisible();
});

test('la file de vente suit les places libres', async ({ pageCollection: page }) => {
  await page.getByRole('button', { name: OUVRIR }).click();
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Appliquer ce tri' }).click();

  const file = page.getByTestId('file-vente');
  await expect(file).toContainText('0 en cours sur 5, 5 places libres');
  await expect(file).toContainText('Athlète fictif · valeur 100');
  await expect(file).toContainText(/heure forte|temps libre|attendre une heure forte/);
  await expect(file).toContainText('Heures fortes par défaut (0 observation)');

  await file.getByRole('button', { name: 'Je l’ai mise aux enchères' }).click();
  await expect(file).toContainText('1 en cours sur 5, 4 places libres');
  await expect
    .poll(() => page.evaluate(async () => ((await chrome.storage.local.get('ventes')).ventes as { evenements: { type: string }[] }).evenements.map((e) => e.type)))
    .toEqual(['debut']);

  await file.getByRole('button', { name: 'Enchère terminée' }).click();
  await expect(page.getByLabel('Statut de Athlète fictif')).toHaveCount(0);
});

test('une décision manuelle survit, et les thèmes sont retenus pour plus tard', async ({ pageCollection: page }) => {
  await page.getByLabel('Statut de Agrume fictif').selectOption('vendre');
  await page.getByRole('button', { name: OUVRIR }).click();
  await page.getByRole('checkbox', { name: 'Mon thème : #Espace' }).check();
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Appliquer ce tri' }).click();
  await expect(page.getByLabel('Statut de Agrume fictif')).toHaveValue('vendre');

  await page.reload();
  await page.getByRole('button', { name: OUVRIR }).click();
  await expect(page.getByRole('checkbox', { name: 'Mon thème : #Espace' })).toBeChecked();
});

test('filtre la liste par thème déduit', async ({ pageCollection: page }) => {
  await page.getByLabel('Filtrer par thème').selectOption('sport');
  await expect(page.locator('main li')).toHaveCount(1);
  await expect(page.getByText('Athlète fictif')).toBeVisible();
});

test.describe('captures de la file de vente (affluence)', () => {
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
        await page.getByRole('button', { name: OUVRIR }).click();
        for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
        await page.getByRole('button', { name: 'Appliquer ce tri' }).click();
        const file = page.getByTestId('file-vente');
        await expect(file).toContainText(/heure forte|temps libre|attendre une heure forte/);
        const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        await file.screenshot({ path: `test-results/captures/affluence-${colorScheme}-${name}.png` });
      });
    }
  }
});
