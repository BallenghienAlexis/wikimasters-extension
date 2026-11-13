import { allerA, carteComplete, chargerCollectionFictive, expect, ONGLETS, test } from './extension';

// T-304 : coquille à onglets (SC-012, SC-011, SC-008, SC-009, SC-010, SC-020, SC-006).
// Données uniquement fictives.

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['light', 'dark'] as const;

const nomOnglet = (i: number): RegExp => new RegExp(`^${ONGLETS[i]?.nom ?? ''}`);

test.describe('SC-012 : onglets', () => {
  test('SC-012 : six onglets dans l’ordre, motif tablist/tab/tabpanel', async ({ pageCollection }) => {
    const liste = pageCollection.getByRole('tablist', { name: 'Sections' });
    await expect(liste).toBeVisible();
    const onglets = liste.getByRole('tab');
    await expect(onglets).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await expect(onglets.nth(i)).toHaveText(nomOnglet(i));
    }
    // Défaut : Tableau de bord, un seul onglet dans l’ordre de tabulation (tabindex itinérant).
    await expect(onglets.nth(0)).toHaveAttribute('aria-selected', 'true');
    for (let i = 0; i < 6; i++) {
      await expect(onglets.nth(i)).toHaveAttribute('tabindex', i === 0 ? '0' : '-1');
      if (i > 0) await expect(onglets.nth(i)).toHaveAttribute('aria-selected', 'false');
    }
    // aria-controls pointe vers le panneau, qui référence son onglet.
    const idPanneau = await onglets.nth(0).getAttribute('aria-controls');
    expect(idPanneau).toBeTruthy();
    const idOnglet = await onglets.nth(0).getAttribute('id');
    expect(idOnglet).toBeTruthy();
    const panneau = pageCollection.locator(`[id="${idPanneau}"]`);
    await expect(panneau).toHaveAttribute('role', 'tabpanel');
    await expect(panneau).toHaveAttribute('aria-labelledby', idOnglet as string);
    // Seul le panneau actif est monté.
    await expect(pageCollection.getByRole('tabpanel')).toHaveCount(1);
  });

  test('SC-008 : flèches, Origine et Fin déplacent le focus et activent', async ({ pageCollection }) => {
    const onglets = pageCollection.getByRole('tablist', { name: 'Sections' }).getByRole('tab');
    await onglets.nth(0).focus();
    await pageCollection.keyboard.press('ArrowRight');
    await expect(onglets.nth(1)).toBeFocused();
    await expect(onglets.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(onglets.nth(1)).toHaveAttribute('tabindex', '0');
    await expect(onglets.nth(0)).toHaveAttribute('tabindex', '-1');
    await expect(pageCollection).toHaveURL(/#synchro$/);
    await pageCollection.keyboard.press('ArrowRight');
    await expect(onglets.nth(2)).toBeFocused();
    await expect(pageCollection).toHaveURL(/#lots$/);
    await pageCollection.keyboard.press('ArrowLeft');
    await expect(onglets.nth(1)).toBeFocused();
    await expect(onglets.nth(1)).toHaveAttribute('aria-selected', 'true');
    await pageCollection.keyboard.press('End');
    await expect(onglets.nth(5)).toBeFocused();
    await expect(onglets.nth(5)).toHaveAttribute('aria-selected', 'true');
    await expect(pageCollection).toHaveURL(/#reglages$/);
    await pageCollection.keyboard.press('Home');
    await expect(onglets.nth(0)).toBeFocused();
    await expect(onglets.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(pageCollection).toHaveURL(/#tableau-de-bord$/);
  });

  test('SC-012 : l’onglet actif vient du fragment d’URL, Tableau de bord par défaut', async ({ pageCollection, extensionId }) => {
    const base = `chrome-extension://${extensionId}/collection.html`;
    for (let i = 0; i < ONGLETS.length; i++) {
      await pageCollection.goto(`${base}#${ONGLETS[i]?.id ?? ''}`);
      await pageCollection.reload();
      await expect(pageCollection.getByRole('tab', { name: nomOnglet(i) })).toHaveAttribute('aria-selected', 'true');
    }
    await pageCollection.goto(`${base}#inconnu`);
    await pageCollection.reload();
    await expect(pageCollection.getByRole('tab', { name: nomOnglet(0) })).toHaveAttribute('aria-selected', 'true');
  });

  test('SC-012 : clic sur un onglet, Précédent et Suivant du navigateur, rien en stockage', async ({ pageCollection }) => {
    const clesAvant = await pageCollection.evaluate(async () => Object.keys(await chrome.storage.local.get(null)).sort());
    await pageCollection.getByRole('tab', { name: nomOnglet(1) }).click();
    await expect(pageCollection).toHaveURL(/#synchro$/);
    await pageCollection.getByRole('tab', { name: nomOnglet(2) }).click();
    await expect(pageCollection).toHaveURL(/#lots$/);
    await pageCollection.goBack();
    await expect(pageCollection).toHaveURL(/#synchro$/);
    await expect(pageCollection.getByRole('tab', { name: nomOnglet(1) })).toHaveAttribute('aria-selected', 'true');
    await pageCollection.goForward();
    await expect(pageCollection).toHaveURL(/#lots$/);
    await expect(pageCollection.getByRole('tab', { name: nomOnglet(2) })).toHaveAttribute('aria-selected', 'true');
    const clesApres = await pageCollection.evaluate(async () => Object.keys(await chrome.storage.local.get(null)).sort());
    expect(clesApres.filter((c) => /onglet/i.test(c))).toEqual([]);
    expect(clesApres.filter((c) => !clesAvant.includes(c) && /onglet|hash|fragment/i.test(c))).toEqual([]);
  });

  test('SC-012 : le contenu actuel est rangé dans l’onglet prévu (AC7)', async ({ pageCollection }) => {
    await chargerCollectionFictive(pageCollection);
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('resume')).toBeVisible();
    await allerA(pageCollection, 'ventes');
    await expect(pageCollection.getByTestId('file-vente')).toBeVisible();
    await allerA(pageCollection, 'lots');
    await expect(pageCollection.getByTestId('apercu')).toBeVisible();
    await allerA(pageCollection, 'synchro');
    await expect(pageCollection.getByTestId('synchro-auto')).toBeVisible();
    await allerA(pageCollection, 'reglages');
    // T-309 : sections repliées par défaut, on ouvre celles qu’on vérifie.
    await pageCollection.getByRole('button', { name: /^Plafond de défausse/ }).click();
    await pageCollection.getByRole('button', { name: /^Sauvegarde/ }).click();
    await expect(pageCollection.getByTestId('plafond-defausse')).toBeVisible();
    await expect(pageCollection.getByRole('button', { name: 'Exporter une sauvegarde' })).toBeVisible();
  });
});

test.describe('SC-012 : collection illisible', () => {
  test('SC-012 : le message et le téléchargement restent au-dessus des onglets, sur les six', async ({ pageCollection }) => {
    await pageCollection.evaluate(() => chrome.storage.local.set({ collection: { version: 9999, cartes: 'illisible' } }));
    await pageCollection.reload();
    for (const o of ONGLETS) {
      await allerA(pageCollection, o.id);
      const alerte = pageCollection.getByRole('alert').first();
      await expect(alerte).toBeVisible();
      await expect(pageCollection.getByRole('button', { name: 'Télécharger les données brutes' })).toBeVisible();
      const liste = pageCollection.getByRole('tablist', { name: 'Sections' });
      await expect(liste).toBeVisible();
      const [a, l] = await Promise.all([alerte.boundingBox(), liste.boundingBox()]);
      expect(a).not.toBeNull();
      expect(l).not.toBeNull();
      expect((a?.y ?? 0) + (a?.height ?? 0)).toBeLessThanOrEqual((l?.y ?? 0) + 1);
    }
    // Les données illisibles ne sont pas effacées.
    const brut = await pageCollection.evaluate(async () => (await chrome.storage.local.get('collection')).collection);
    expect(brut).toEqual({ version: 9999, cartes: 'illisible' });
  });
});

test.describe('SC-009 : largeurs et captures', () => {
  test('SC-009 : aucun défilement horizontal de la page sur les six onglets, 3 largeurs, 2 thèmes', async ({ pageCollection }) => {
    test.setTimeout(180_000);
    await chargerCollectionFictive(pageCollection);
    for (const theme of THEMES) {
      await pageCollection.emulateMedia({ colorScheme: theme });
      for (const bp of BREAKPOINTS) {
        await pageCollection.setViewportSize({ width: bp.width, height: bp.height });
        for (const o of ONGLETS) {
          await allerA(pageCollection, o.id);
          const { sw, cw } = await pageCollection.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
          }));
          expect(sw, `${o.id} ${theme} ${bp.width}`).toBeLessThanOrEqual(cw);
          // La barre d’onglets défile dans son propre conteneur : jamais plus large que l’écran.
          const boite = await pageCollection.getByRole('tablist', { name: 'Sections' }).boundingBox();
          expect(boite?.width ?? 0).toBeLessThanOrEqual(bp.width);
          await pageCollection.screenshot({ path: `test-results/captures/coquille-${o.id}-${theme}-${bp.name}.png`, fullPage: true });
        }
      }
    }
  });

  test('SC-009 : à 375 px, la barre d’onglets défile dans son conteneur', async ({ pageCollection }) => {
    await pageCollection.setViewportSize({ width: 375, height: 812 });
    await allerA(pageCollection, 'reglages');
    const dernier = pageCollection.getByRole('tab', { name: nomOnglet(5) });
    await dernier.focus();
    await expect(dernier).toBeInViewport();
    const sw = await pageCollection.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(sw).toBe(true);
  });
});

test.describe('SC-011 : vérification Wikipédia', () => {
  test('SC-011 : aucune requête Wikipédia ni Wikidata hors de la vue liste de la Collection', async ({ pageCollection }) => {
    test.setTimeout(60_000);
    const requetes: string[] = [];
    await pageCollection.route(/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\//, async (route) => {
      requetes.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await chargerCollectionFictive(pageCollection);
    for (const o of ONGLETS.filter((x) => x.id !== 'collection')) {
      await allerA(pageCollection, o.id);
      await pageCollection.waitForTimeout(1500);
    }
    expect(requetes).toEqual([]);
    // Dans la vue liste de la Collection, les cartes affichées sont vérifiées (titre seul).
    await allerA(pageCollection, 'collection');
    await expect.poll(() => requetes.length, { timeout: 15_000 }).toBeGreaterThan(0);
    for (const u of requetes) expect(u).toMatch(/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\/w\/api\.php\?/);
    await expect(pageCollection.getByText(/titres des cartes affichées sont vérifiés/i)).toBeVisible();
  });

  test('SC-011 : quitter la Collection arrête de planifier de nouvelles vérifications', async ({ pageCollection }) => {
    test.setTimeout(60_000);
    const requetes: string[] = [];
    await pageCollection.route(/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\//, async (route) => {
      requetes.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await chargerCollectionFictive(pageCollection);
    await allerA(pageCollection, 'collection');
    await expect.poll(() => requetes.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await allerA(pageCollection, 'ventes');
    await allerA(pageCollection, 'reglages');
    // Laisse finir une éventuelle requête en vol, puis le compte ne bouge plus.
    await pageCollection.waitForTimeout(1500);
    const fige = requetes.length;
    await pageCollection.waitForTimeout(3000);
    expect(requetes.length).toBe(fige);
  });
});

test.describe('SC-006 : purge des ignorées à l’ouverture', () => {
  test('SC-006 : seules les ignorées encore valables restent', async ({ pageCollection }) => {
    await chargerCollectionFictive(pageCollection);
    const maintenant = Date.now();
    await pageCollection.evaluate(
      ({ n }) =>
        chrome.storage.local.set({
          ignorees: {
            version: 1,
            entrees: [
              { type: 'pose-etiquette', idCarte: 'fictive-1', parametre: 'Statut · Garder', portee: 'synchro', date: n - 3_600_000 },
              { type: 'pose-etiquette', idCarte: 'fictive-2', parametre: 'Statut · Garder', portee: 'synchro', date: n - 40 * 86_400_000 },
              { type: 'pose-etiquette', idCarte: 'carte-disparue', parametre: 'Statut · Garder', portee: 'synchro', date: n - 3_600_000 },
              { type: 'pose-etiquette', idCarte: 'fictive-3', parametre: 'Statut · Garder', portee: 'synchro', date: n - 7_200_000 },
            ],
          },
          // Synchro terminée, commencée après l’ignorance de fictive-3 mais pas de fictive-1.
          statutSynchro: {
            version: 2, etat: 'termine', page: null, pages: null, raison: null, codeHttp: null,
            le: n - 600_000, ajoutees: 0, etiquettes: 0, prix: 0,
            etape: null, prixFaits: null, prixPrevus: null, debut: n - 5_400_000,
          },
        }),
      { n: maintenant },
    );
    await pageCollection.reload();
    await expect
      .poll(
        () =>
          pageCollection.evaluate(async () => {
            const { ignorees } = await chrome.storage.local.get('ignorees');
            return (ignorees as { entrees: { idCarte: string }[] }).entrees.map((e) => e.idCarte);
          }),
        { timeout: 10_000 },
      )
      .toEqual(['fictive-1']);
  });
});

test.describe('SC-020 et D-17 : écritures de la coquille', () => {
  test('SC-020 : un point d’historique du jour est écrit à l’ouverture et remplacé à chaque changement', async ({ pageCollection }) => {
    await chargerCollectionFictive(pageCollection);
    const lire = (): Promise<{ jour: string; exemplaires: number }[]> =>
      pageCollection.evaluate(async () => {
        const { historique } = await chrome.storage.local.get('historique');
        return (historique as { points: { jour: string; exemplaires: number }[] } | undefined)?.points ?? [];
      });
    const aujourdhui = await pageCollection.evaluate(() => {
      const d = new Date();
      const deux = (n: number): string => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
    });
    await expect.poll(async () => (await lire()).filter((p) => p.jour === aujourdhui)).toEqual([{ jour: aujourdhui, exemplaires: 7 }]);
    // Changement de collection : le point du jour est remplacé, jamais dupliqué.
    await pageCollection.evaluate(
      (cartes) => chrome.storage.local.set({ collection: { version: 3, cartes } }),
      [carteComplete({ id: 'fictive-9', titre: 'Hérisson de démonstration', quantite: 2 })],
    );
    await pageCollection.reload();
    await expect.poll(async () => (await lire()).filter((p) => p.jour === aujourdhui)).toEqual([{ jour: aujourdhui, exemplaires: 2 }]);
  });

  test('D-17 : le réglage « animations » désactivé pose data-animations="off" sur <html>', async ({ pageCollection }) => {
    await expect(pageCollection.locator('html')).not.toHaveAttribute('data-animations', 'off');
    await pageCollection.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: false } }));
    await pageCollection.reload();
    await expect(pageCollection.locator('html')).toHaveAttribute('data-animations', 'off');
  });
});
