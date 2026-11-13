import { allerA, expect, test } from './extension';

// Interface seule (T-206) : l'état est posé dans le stockage, aucune requête vers le site. Données fictives.
// Le parcours complet sur site fictif (requêtes, arrêt sur 403) est celui de T-207.
const carte = (n: number, surcharge: Record<string, unknown> = {}) => ({
  id: `R|Carte fictive ${n}`,
  titre: `Carte fictive ${n}`,
  rarete: 'R',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${n}`],
  etiquettesSite: [],
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...surcharge,
});

const COLLECTION = {
  version: 3,
  cartes: [carte(1), carte(2, { etiquettesSite: ['Statut · Garder', 'Ancienne étiquette'] }), carte(3, { etiquettesSite: ['Statut · Garder'] })],
};

const poser = async (page: import('@playwright/test').Page, valeurs: Record<string, unknown>): Promise<void> => {
  await page.evaluate(async (v) => chrome.storage.local.set(v), valeurs);
  await page.reload();
  await allerA(page, 'synchro');
};

test('l’interrupteur est activé par défaut et se coupe au clavier', async ({ pageCollection: page }) => {
  await poser(page, { collection: COLLECTION });
  const interrupteur = page.getByRole('switch', { name: 'Synchronisation automatique' });
  await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('etat-synchro-auto')).toHaveText('En attente d’un onglet WikiMasters');

  await interrupteur.focus();
  await page.keyboard.press('Space');
  await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('etat-synchro-auto')).toHaveText('Désactivée');
  await expect.poll(() => page.evaluate(async () => (await chrome.storage.local.get('syncAuto')).syncAuto)).toBe(false);
});

test('« Arrêter » écrit la demande d’arrêt, et les écarts sont en lecture seule', async ({ pageCollection: page }) => {
  const maintenant = Date.now();
  await poser(page, {
    collection: COLLECTION,
    syncAuto: true,
    bailSynchro: maintenant + 120_000,
    statutSynchro: { version: 1, etat: 'en-cours', page: 12, pages: 134, raison: null, codeHttp: null, le: maintenant, ajoutees: 0, etiquettes: 0, prix: 0 },
  });
  await expect(page.getByTestId('etat-synchro-auto')).toHaveText(/En cours\s: page 12 sur 134/);
  const ecarts = page.getByTestId('ecarts');
  await expect(ecarts).toContainText('Carte fictive 1');
  await expect(ecarts).toContainText('Ancienne étiquette');

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect.poll(() => page.evaluate(async () => typeof (await chrome.storage.local.get('arretSynchro')).arretSynchro)).toBe('number');
});

test('arrêt du site : le texte donne le code', async ({ pageCollection: page }) => {
  await poser(page, {
    collection: COLLECTION,
    syncAuto: true,
    derniereSynchro: Date.now() - 3_600_000,
    statutSynchro: { version: 1, etat: 'arret', page: null, pages: null, raison: 'code-http', codeHttp: 403, le: Date.now(), ajoutees: 0, etiquettes: 0, prix: 0 },
  });
  await expect(page.getByTestId('etat-synchro-auto')).toHaveText(/Arrêtée\s: le site a refusé \(403\)/);
  await expect(page.getByRole('button', { name: 'Arrêter' })).toHaveCount(0);
});

test.describe('captures de la synchronisation automatique', () => {
  const BREAKPOINTS = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`${colorScheme} ${name}`, async ({ pageCollection: page }) => {
        const maintenant = Date.now();
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await poser(page, {
          collection: COLLECTION,
          syncAuto: true,
          bailSynchro: maintenant + 120_000,
          derniereSynchro: maintenant - 3_600_000,
          statutSynchro: { version: 1, etat: 'en-cours', page: 12, pages: 134, raison: null, codeHttp: null, le: maintenant, ajoutees: 3, etiquettes: 12, prix: 40 },
        });
        const section = page.getByTestId('synchro-auto');
        await expect(section).toContainText('page 12 sur 134');
        const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        await section.screenshot({ path: `test-results/captures/synchro-auto-${colorScheme}-${name}.png` });
      });
    }
  }
});
