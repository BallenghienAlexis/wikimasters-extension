import { allerA, expect, test } from './extension';

test.describe('onglet Mise en vente', () => {
  test('interrupteur visible, blocs repliés par défaut, suivi lu depuis le stockage', async ({ pageCollection }) => {
    const maintenant = Date.now();
    await pageCollection.evaluate((t) =>
      chrome.storage.local.set({
        suiviVentes: {
          version: 1, releveLe: t, max: 5,
          actives: [{ id: 'a1', idExemplaire: 'e1', titre: 'Carte fictive', rarete: 'rare', prixDepart: 200, prixActuel: 260, avecMise: true, creeLe: t - 600000, finLe: t + 3000000, finInitiale: t + 2940000 }],
          terminees: [{ id: 'h1', titre: 'Autre carte', rarete: 'rare', prixDepart: 50, prixFinal: null, creeLe: t - 7200000, finLe: t - 3600000 }],
        },
      }), maintenant);
    await allerA(pageCollection, 'mise-en-vente');
    await expect(pageCollection.getByRole('switch', { name: /Relance automatique/ })).toBeVisible();
    const enCours = pageCollection.getByTestId('encheres-en-cours');
    await expect(enCours.getByRole('button', { name: /Enchères en cours/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(enCours).toContainText('1 sur 5');
    await enCours.getByRole('button', { name: /Enchères en cours/ }).click();
    await expect(enCours).toContainText('Carte fictive');
    await expect(enCours).toContainText('1 × 60 s');
    await expect(pageCollection.getByTestId('historique-ventes')).toContainText('1 terminées, 0 vendues');
  });

  test('activer la relance enregistre le réglage', async ({ pageCollection }) => {
    await allerA(pageCollection, 'mise-en-vente');
    await pageCollection.getByRole('switch', { name: /Relance automatique/ }).click();
    await expect.poll(() => pageCollection.evaluate(() => chrome.storage.local.get('relanceVentes').then((r) => r.relanceVentes))).toBe(true);
  });
});
