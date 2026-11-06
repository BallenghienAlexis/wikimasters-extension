import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'node:path';

const DIST = path.resolve('dist');

export const COLLECTION_FICTIVE = path.resolve('tests/e2e/fixtures/collection-fictive.json');

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
