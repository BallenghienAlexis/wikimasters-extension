import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');

export const COLLECTION_FICTIVE = path.resolve('tests/e2e/fixtures/collection-fictive.json');

/** Complète une carte de fixture avec les valeurs par défaut du schéma de stockage (v3). */
export const carteComplete = (c: Record<string, unknown>): object => ({
  rarete: null,
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  etiquettesSite: [],
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...c,
});

/** Écrit directement des cartes dans le stockage de l'extension (la page ne propose plus d'import), puis recharge la page. */
export async function chargerCartes(page: Page, cartes: Record<string, unknown>[]): Promise<void> {
  const complete = cartes.map(carteComplete);
  await page.evaluate((c) => chrome.storage.local.set({ collection: { version: 3, cartes: c } }), complete);
  await page.reload();
}

/** Charge les quatre cartes fictives de `collection-fictive.json`. */
export async function chargerCollectionFictive(page: Page): Promise<void> {
  const { cartes } = JSON.parse(fs.readFileSync(COLLECTION_FICTIVE, 'utf8')) as { cartes: Record<string, unknown>[] };
  await chargerCartes(page, cartes);
}

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  pageCollection: Page;
}

export const test = base.extend<Fixtures>({
  // Une extension ne se charge que dans un contexte persistant, sur le Chromium de Playwright.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  pageCollection: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/collection.html`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
