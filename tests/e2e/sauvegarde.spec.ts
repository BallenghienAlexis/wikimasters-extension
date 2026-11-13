import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { allerA, chargerCollectionFictive, expect, test } from './extension';

/** T-309 : la section est repliée par défaut, on l’ouvre (sans effet si elle l’est déjà). */
async function ouvrirSauvegarde(page: Page): Promise<void> {
  const bouton = page.getByRole('button', { name: /^Sauvegarde/ });
  if ((await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click();
  await expect(bouton).toHaveAttribute('aria-expanded', 'true');
}

test.describe('sauvegarde complète', () => {
  test('exporte, puis importe sur un stockage vide avec aperçu', async ({ pageCollection }) => {
    await chargerCollectionFictive(pageCollection);
    await allerA(pageCollection, 'reglages');
    await ouvrirSauvegarde(pageCollection);
    await pageCollection.evaluate(async () => {
      const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: Record<string, unknown>[] } };
      collection.cartes[0]!.statut = 'garder';
      collection.cartes[0]!.note = 'note de test';
      collection.cartes[0]!.decidePar = 'moi';
      await chrome.storage.local.set({ collection, preferences: { version: 2, mesThemes: ['barrage'], amis: [{ nom: 'Ami fictif', themes: ['tibet'] }] } });
    });
    await pageCollection.reload();
    await ouvrirSauvegarde(pageCollection);

    const telechargement = pageCollection.waitForEvent('download');
    await pageCollection.getByRole('button', { name: 'Exporter une sauvegarde' }).click();
    const fichier = await (await telechargement).path();
    const texte = fs.readFileSync(fichier, 'utf8');
    expect(texte).toContain('note de test');
    expect(texte).not.toMatch(/token|cookie|idsSite|etiquettesSite/i);

    // Autre PC : stockage vide.
    await pageCollection.evaluate(() => chrome.storage.local.clear());
    await pageCollection.reload();
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByText('Votre collection est vide')).toBeVisible();
    await allerA(pageCollection, 'reglages');
    await ouvrirSauvegarde(pageCollection);

    await pageCollection.locator('input[type="file"]').setInputFiles(fichier);
    const apercu = pageCollection.getByTestId('apercu-sauvegarde');
    await expect(apercu).toContainText('4 cartes nouvelles');
    await expect(apercu).toContainText('1 ami ajouté');
    await pageCollection.getByRole('button', { name: 'Appliquer la sauvegarde' }).click();
    await expect(pageCollection.getByText('Sauvegarde importée.')).toBeVisible();
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('resume')).toContainText('7 exemplaires');
    const stocke = await pageCollection.evaluate(async () => (await chrome.storage.local.get(['collection', 'preferences'])) as Record<string, unknown>);
    expect(JSON.stringify(stocke)).toContain('note de test');
    expect(JSON.stringify(stocke)).toContain('Ami fictif');
  });

  test('refuse un fichier invalide sans rien modifier', async ({ pageCollection }) => {
    await chargerCollectionFictive(pageCollection);
    await allerA(pageCollection, 'reglages');
    await ouvrirSauvegarde(pageCollection);
    await pageCollection.locator('input[type="file"]').setInputFiles({ name: 'faux.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"autre"}') });
    await expect(pageCollection.getByRole('alert')).toContainText('Importation refusée');
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('resume')).toContainText('7 exemplaires');
  });
});
