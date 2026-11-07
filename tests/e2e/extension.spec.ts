import fs from 'node:fs';
import { COLLECTION_FICTIVE, expect, test } from './extension';

const champFichier = 'input[type="file"]';

test.describe('extension chargée', () => {
  test('le manifeste reste minimal : stockage seulement, script limité à WikiMasters', async ({ serviceWorker }) => {
    const manifeste = await serviceWorker.evaluate(() => chrome.runtime.getManifest());
    expect(manifeste.permissions).toEqual(['storage']);
    expect(manifeste.host_permissions).toBeUndefined();
    expect(manifeste.content_scripts?.flatMap((c) => c.matches)).toEqual(['https://www.wiki-masters.com/*', 'https://wiki-masters.com/*']);
  });

  test('le clic sur l’icône ouvre la page de collection', async ({ context, serviceWorker, extensionId }) => {
    const nouvellePage = context.waitForEvent('page');
    await serviceWorker.evaluate(() => {
      (chrome.action.onClicked as unknown as { dispatch: (tab: object) => void }).dispatch({});
    });
    expect((await nouvellePage).url()).toBe(`chrome-extension://${extensionId}/collection.html`);
  });
});

test.describe('page de collection', () => {
  test('affiche l’état vide', async ({ pageCollection }) => {
    await expect(pageCollection.getByText('Votre collection est vide')).toBeVisible();
  });

  test('importe un fichier fictif et affiche le résumé', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    await expect(pageCollection.getByRole('status')).toHaveText('4 cartes importées.');
    await expect(pageCollection.getByTestId('resume')).toContainText('7 exemplaires · 3 doublons');
  });

  test('refuse un fichier invalide sans toucher à la collection', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, {
      name: 'mauvais.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version": 99, "cartes": []}'),
    });
    await expect(pageCollection.getByRole('status')).toContainText('Import refusé');
    await expect(pageCollection.getByText('Votre collection est vide')).toBeVisible();
  });

  test('affiche un titre hostile en texte, sans l’interpréter', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    await expect(pageCollection.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    await expect(pageCollection.locator('main img')).toHaveCount(0);
  });

  test('l’édition survit au rechargement', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    await pageCollection.getByLabel('Statut de Loutre de démonstration').selectOption('vendre');
    const prix = pageCollection.getByLabel('Prix cible de Loutre de démonstration, en wikibidous');
    await prix.fill('120');
    await prix.blur();
    const note = pageCollection.getByLabel('Note sur Loutre de démonstration');
    await note.fill('Attendre une bonne offre');
    await note.blur();
    // Laisse aboutir l'écriture asynchrone avant de recharger.
    await expect
      .poll(() =>
        pageCollection.evaluate(async () => {
          const { collection } = await chrome.storage.local.get('collection');
          return (collection as { cartes: { note: string }[] }).cartes[1]?.note;
        }),
      )
      .toBe('Attendre une bonne offre');

    await pageCollection.reload();

    await expect(pageCollection.getByLabel('Statut de Loutre de démonstration')).toHaveValue('vendre');
    await expect(pageCollection.getByLabel('Prix cible de Loutre de démonstration, en wikibidous')).toHaveValue('120');
    await expect(pageCollection.getByLabel('Note sur Loutre de démonstration')).toHaveValue('Attendre une bonne offre');
  });

  test('un prix invalide est rétabli sans être enregistré', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    const prix = pageCollection.getByLabel('Prix cible de Loutre de démonstration, en wikibidous');
    await prix.fill('-5');
    await prix.blur();
    await expect(prix).toHaveValue('');
  });

  test('filtre par recherche et par doublons', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    await pageCollection.getByLabel('Rechercher une carte').fill('ecureuil');
    await expect(pageCollection.locator('main li')).toHaveCount(1);
    await pageCollection.getByLabel('Rechercher une carte').fill('');
    await pageCollection.getByLabel('Doublons seulement').check();
    await expect(pageCollection.locator('main li')).toHaveCount(2);
  });

  test('exporte un CSV dont les formules sont neutralisées', async ({ pageCollection }) => {
    await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
    await expect(pageCollection.getByRole('status')).toHaveText('4 cartes importées.');
    const telechargement = pageCollection.waitForEvent('download');
    await pageCollection.getByRole('button', { name: 'Exporter en CSV' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toBe('collection.csv');
    const contenu = fs.readFileSync(await fichier.path(), 'utf8');
    expect(contenu).toContain("fictive-3;'=Carte au titre piégé");
  });
});

test.describe('captures responsive', () => {
  const BREAKPOINTS = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`${colorScheme} ${name} : pas de défilement horizontal`, async ({ pageCollection }) => {
        await pageCollection.emulateMedia({ colorScheme });
        await pageCollection.setViewportSize({ width, height });
        await pageCollection.setInputFiles(champFichier, COLLECTION_FICTIVE);
        await expect(pageCollection.getByRole('status')).toHaveText('4 cartes importées.');
        const debordement = await pageCollection.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        await pageCollection.screenshot({ path: `test-results/captures/collection-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
