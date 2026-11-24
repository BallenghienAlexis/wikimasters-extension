import type { Page } from '@playwright/test';
import { allerA, chargerCartes, expect, POINTS_DE_RUPTURE, test } from './extension';

// Synchro entre PC (SC-006, SC-007). Données fictives ; le sélecteur de dossier est remplacé par un dossier du
// système de fichiers privé de la page (OPFS), un vrai `FileSystemDirectoryHandle` qui passe par IndexedDB.

const CARTES = [{ id: 'a', titre: 'Agrume fictif', rarete: 'C', description: 'agrume', valeurMarchande: 3, note: 'ma note' }];

const section = (page: Page) => page.getByRole('button', { name: /^Synchro entre PC/ });

async function preparer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker = async () => {
      const racine = await navigator.storage.getDirectory();
      return racine.getDirectoryHandle('wm-sync-test', { create: true });
    };
  });
  await chargerCartes(page, CARTES);
  await allerA(page, 'reglages');
  await section(page).click();
}

test('SC-007 : la section est repliable, au clavier, et propose le choix du dossier', async ({ pageCollection: page }) => {
  await preparer(page);
  await expect(section(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Choisir le dossier' })).toBeVisible();
  await expect(page.getByLabel('Nom de ce PC')).toHaveValue(/^pc-[a-z0-9]{4}$/);
});

test('choisir un dossier écrit le fichier de ce PC, sans secret', async ({ pageCollection: page }) => {
  await preparer(page);
  await page.getByRole('button', { name: 'Choisir le dossier' }).click();
  await expect(page.getByTestId('etat-synchro-pc')).toContainText('Dossier : wm-sync-test');
  const contenu = await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const dossier = await racine.getDirectoryHandle('wm-sync-test');
    const textes: string[] = [];
    for await (const e of (dossier as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      if (e.kind === 'file' && /^wm-sync-pc-[a-z0-9]{4}\.json$/.test(e.name)) textes.push(await (await (e as FileSystemFileHandle).getFile()).text());
    }
    return textes;
  });
  expect(contenu).toHaveLength(1);
  expect(contenu[0]).toContain('ma note');
  expect(contenu[0]).not.toMatch(/token|cookie|jwt|apikey|authorization/i);
});

test('SC-006 : autorisation retirée, « Autoriser à nouveau » rétablit la synchro', async ({ pageCollection: page }) => {
  await preparer(page);
  await page.getByRole('button', { name: 'Choisir le dossier' }).click();
  await expect(page.getByTestId('etat-synchro-pc')).toContainText('Dossier : wm-sync-test');
  await page.evaluate(() => {
    (window as unknown as { __accorde: boolean }).__accorde = false;
    const proto = FileSystemHandle.prototype as unknown as Record<string, unknown>;
    proto.queryPermission = async () => ((window as unknown as { __accorde: boolean }).__accorde ? 'granted' : 'prompt');
    proto.requestPermission = async () => {
      (window as unknown as { __accorde: boolean }).__accorde = true;
      return 'granted';
    };
  });
  await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await expect(page.getByRole('button', { name: 'Autoriser à nouveau' })).toBeVisible();
  await page.getByRole('button', { name: 'Autoriser à nouveau' }).click();
  await expect(page.getByRole('button', { name: 'Autoriser à nouveau' })).toHaveCount(0);
});

for (const point of POINTS_DE_RUPTURE) {
  test(`capture ${point.name}`, async ({ pageCollection: page }, info) => {
    await page.setViewportSize({ width: point.width, height: point.height });
    await preparer(page);
    await page.screenshot({ path: info.outputPath(`synchro-pc-${point.name}.png`), fullPage: true });
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(debordement).toBe(false);
  });
}
