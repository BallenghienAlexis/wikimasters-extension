import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CLE_PUBLIQUE, COULEUR_ETIQUETTE, NOM_COOKIE_SESSION, ORIGINE_REST } from '../../src/config/synchro';
import { allerA, ONGLETS, expect, test } from './extension';

/*
 * T-317 : bandeau d’activité (SC-013, SC-014 commandes, SC-002 barres du bandeau ; D-03, D-21, D-10, D-11).
 * Données uniquement fictives ; le vrai site n’est jamais contacté.
 *
 * CONTRAT DE SÉLECTEURS (à respecter par l’implémentation, dev-ui) :
 *  - Bandeau : `getByRole('region', { name: 'Activité en cours' })`, aussi `data-testid="bandeau-activite"` ;
 *    absent du DOM (ni région, ni testid) sans activité. Il ne contient AUCUNE zone `[aria-live]` (D-21).
 *  - Lignes : `data-testid="ligne-activite-synchro" | "ligne-activite-lots" | "ligne-activite-erreur"`,
 *    chacune contenue dans le bandeau.
 *  - En-tête de ligne (synchro, lots) : un `button` portant `aria-expanded` ("false" par défaut) et `aria-controls`
 *    (id du détail, présent dans le DOM), hauteur >= 44 px, nom accessible commençant par « Synchro » / « Lots ».
 *  - Ligne repliée : exactement un `role="progressbar"` dans la ligne (aria-valuemin/max/now), de 8 px de haut,
 *    `data-testid="pourcentage-ligne"` (texte /\d+ %/) et `data-testid="resume-ligne"` (texte non vide).
 *  - Ligne dépliée : une barre `data-testid="barre-detail"` (role progressbar) par étape de synchro (4)
 *    ou par lot de l’exécution ; boutons de nom exact « Pause » / « Reprendre » (lots seulement) et « Arrêter »,
 *    dans la ligne. Pas de bouton Pause/Reprendre sur la ligne Synchro.
 *  - Lecture seule (traitement d’un autre onglet) : texte « en cours dans un autre onglet » dans la ligne,
 *    aucun bouton « Pause », « Reprendre » ni « Arrêter » même déplié.
 *  - Ligne d’erreur : texte /Erreur/, lien `getByRole('link', { name: 'Voir le détail' })` dont le href se termine par `#synchro`.
 *  - État déplié : jamais stocké (aucune clé de chrome.storage.local ne change au dépliage).
 */

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['light', 'dark'] as const;

const bandeau = (page: Page) => page.getByRole('region', { name: 'Activité en cours' });
const ligne = (page: Page, genre: 'synchro' | 'lots' | 'erreur') => page.getByTestId(`ligne-activite-${genre}`);

const STATUT_EN_COURS = (n: number) => ({
  version: 2, etat: 'en-cours', page: 3, pages: 10, raison: null, codeHttp: null,
  le: n, ajoutees: 0, etiquettes: 0, prix: 0, etape: 'pages', prixFaits: null, prixPrevus: null, debut: n - 10_000,
});

const EXECUTION_EN_COURS = {
  version: 2, idLot: 'lot-fictif-1', etat: 'en-cours', traitees: 3, total: 10, pauseJusqua: null, erreur: null,
  lots: [
    { famille: 'etiquettes', total: 6, traitees: 3, sautees: 0 },
    { famille: 'defausses', total: 4, traitees: 0, sautees: 0 },
  ],
};

const ERREUR = {
  type: 'pose-etiquette', parametre: 'Statut · Garder', idCarte: 'fictive-1', titre: 'Loutre fictive', famille: 'etiquettes',
  indexLot: 0, nbLots: 1, rang: 2, totalLot: 6, codeHttp: 500, cause: 'code-http', le: 1_700_000_000_000, reussies: 2, autresEchecsEnVol: 0,
};

/** Écrit dans le stockage sans recharger (le rechargement clôt une exécution « en cours » orpheline). */
const ecrire = (page: Page, valeurs: Record<string, unknown>) => page.evaluate((v) => chrome.storage.local.set(v), valeurs);
const vider = (page: Page, cles: string[]) => page.evaluate((c) => chrome.storage.local.remove(c), cles);

test.describe('SC-013 : présence du bandeau', () => {
  test('SC-013 : sans activité, le bandeau n’est pas rendu sur les six onglets', async ({ pageCollection }) => {
    for (const o of ONGLETS) {
      await allerA(pageCollection, o.id);
      await expect(bandeau(pageCollection)).toHaveCount(0);
      await expect(pageCollection.getByTestId('bandeau-activite')).toHaveCount(0);
    }
  });

  test('SC-013 : synchro en cours avec bail non expiré : ligne Synchro sur les six onglets', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000 });
    for (const o of ONGLETS) {
      await allerA(pageCollection, o.id);
      await expect(bandeau(pageCollection)).toBeVisible();
      await expect(ligne(pageCollection, 'synchro')).toBeVisible();
      await expect(ligne(pageCollection, 'lots')).toHaveCount(0);
    }
  });

  test('SC-013 : synchro « en-cours » avec bail expiré : pas de ligne, pas de bandeau', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n - 60_000 });
    await expect(bandeau(pageCollection)).toHaveCount(0);
    await expect(ligne(pageCollection, 'synchro')).toHaveCount(0);
  });

  test('SC-013 : le bandeau disparaît quand la synchro se termine', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000 });
    await expect(bandeau(pageCollection)).toBeVisible();
    await ecrire(pageCollection, { statutSynchro: { ...STATUT_EN_COURS(n), etat: 'termine', etape: null }, bailSynchro: null });
    await expect(bandeau(pageCollection)).toHaveCount(0, { timeout: 5_000 });
  });

  test('SC-013 : exécution en cours : ligne Lots ; terminée : plus de bandeau', async ({ pageCollection }) => {
    await ecrire(pageCollection, { execution: EXECUTION_EN_COURS });
    await expect(ligne(pageCollection, 'lots')).toBeVisible();
    await ecrire(pageCollection, { execution: { ...EXECUTION_EN_COURS, etat: 'terminee', traitees: 10 } });
    await expect(bandeau(pageCollection)).toHaveCount(0, { timeout: 5_000 });
  });

  test('SC-013 : exécution arrêtée sur erreur : ligne d’erreur avec ✕ et lien vers #synchro', async ({ pageCollection }) => {
    await allerA(pageCollection, 'collection');
    await ecrire(pageCollection, { execution: { ...EXECUTION_EN_COURS, etat: 'arretee', erreur: ERREUR } });
    const l = ligne(pageCollection, 'erreur');
    await expect(l).toBeVisible();
    await expect(l).toContainText('✕');
    await expect(l).toContainText(/Erreur/);
    const lien = l.getByRole('link', { name: 'Voir le détail' });
    await expect(lien).toHaveAttribute('href', /#synchro$/);
    await lien.click();
    await expect(pageCollection).toHaveURL(/#synchro$/);
    // Arrêtée sans erreur en attente : rien à afficher.
    await ecrire(pageCollection, { execution: { ...EXECUTION_EN_COURS, etat: 'arretee', erreur: null } });
    await expect(bandeau(pageCollection)).toHaveCount(0, { timeout: 5_000 });
  });

  test('SC-013 : plusieurs traitements : une ligne chacun dans un seul bandeau', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000, execution: EXECUTION_EN_COURS });
    await expect(bandeau(pageCollection)).toHaveCount(1);
    await expect(ligne(pageCollection, 'synchro')).toBeVisible();
    await expect(ligne(pageCollection, 'lots')).toBeVisible();
  });
});

test.describe('SC-013, SC-002 : ligne repliée et dépliée', () => {
  test('SC-013 : repliée par défaut, nom, barre de 8 px, pourcentage, résumé ; zone aria-live distincte', async ({ pageCollection }) => {
    await ecrire(pageCollection, { execution: EXECUTION_EN_COURS });
    const l = ligne(pageCollection, 'lots');
    await expect(l).toBeVisible();
    const entete = l.getByRole('button', { name: /^Lots/ });
    await expect(entete).toHaveAttribute('aria-expanded', 'false');
    const controle = await entete.getAttribute('aria-controls');
    expect(controle).toBeTruthy();
    expect((await entete.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    const barre = l.getByRole('progressbar');
    await expect(barre).toHaveCount(1);
    await expect(barre).toHaveAttribute('aria-valuemin', '0');
    await expect(barre).toHaveAttribute('aria-valuemax', '10');
    await expect(barre).toHaveAttribute('aria-valuenow', '3');
    await expect(barre).toHaveAttribute('aria-label', /\S/);
    expect((await barre.boundingBox())?.height).toBeCloseTo(8, 0);
    await expect(l.getByTestId('pourcentage-ligne')).toHaveText(/\d+ %/);
    await expect(l.getByTestId('resume-ligne')).not.toHaveText('');
    await expect(l.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await expect(bandeau(pageCollection).locator('[aria-live]')).toHaveCount(0);
  });

  test('SC-013 : déplier une ligne Lots montre une barre par lot, Pause et Arrêter ; état non stocké', async ({ pageCollection }) => {
    await ecrire(pageCollection, { execution: EXECUTION_EN_COURS });
    const l = ligne(pageCollection, 'lots');
    // L'initialisation de la page écrit `historique` : on l'attend pour ne comparer que l'effet du dépliage.
    await pageCollection.waitForFunction(async () => 'historique' in (await chrome.storage.local.get('historique')));
    const avant = await pageCollection.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
    const entete = l.getByRole('button', { name: /^Lots/ });
    await entete.click();
    await expect(entete).toHaveAttribute('aria-expanded', 'true');
    const detail = pageCollection.locator(`[id="${(await entete.getAttribute('aria-controls')) ?? ''}"]`);
    await expect(detail).toBeVisible();
    await expect(l.getByTestId('barre-detail')).toHaveCount(2);
    await expect(l.getByTestId('barre-detail').first()).toHaveAttribute('role', 'progressbar');
    await expect(l.getByRole('button', { name: 'Arrêter' })).toBeVisible();
    // Dans un autre onglet du navigateur (stockage fictif seul) : lecture seule, voir AC3 ; ici pas de traitement local.
    const apres = await pageCollection.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
    expect(apres).toBe(avant);
    // Le dépliage survit au changement d’onglet de la page (le bandeau est au-dessus des panneaux) mais pas à un rechargement.
    await allerA(pageCollection, 'ventes');
    await expect(l.getByRole('button', { name: /^Lots/ })).toHaveAttribute('aria-expanded', 'true');
    await entete.click();
    await expect(entete).toHaveAttribute('aria-expanded', 'false');
    await expect(l.getByTestId('barre-detail')).toHaveCount(0);
  });

  test('SC-013 : déplier la ligne Synchro montre quatre barres d’étape, sans Pause ni Reprendre, avec Arrêter (H9)', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000 });
    const l = ligne(pageCollection, 'synchro');
    await expect(l.getByRole('progressbar')).toHaveCount(1);
    await expect(l.getByTestId('pourcentage-ligne')).toHaveText(/\d+ %/);
    await l.getByRole('button', { name: /^Synchro/ }).click();
    await expect(l.getByTestId('barre-detail')).toHaveCount(4);
    await expect(l.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await expect(l.getByRole('button', { name: 'Reprendre' })).toHaveCount(0);
    await expect(l.getByRole('button', { name: 'Arrêter' })).toBeVisible();
  });

  test('SC-013 : l’en-tête se commande au clavier', async ({ pageCollection }) => {
    await ecrire(pageCollection, { execution: EXECUTION_EN_COURS });
    const entete = ligne(pageCollection, 'lots').getByRole('button', { name: /^Lots/ });
    await entete.focus();
    await pageCollection.keyboard.press('Enter');
    await expect(entete).toHaveAttribute('aria-expanded', 'true');
    await pageCollection.keyboard.press('Space');
    await expect(entete).toHaveAttribute('aria-expanded', 'false');
  });

  test('SC-002 : la barre de la synchro suit le stockage et ne décroît pas', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000 });
    const l = ligne(pageCollection, 'synchro');
    const valeur = async (): Promise<number> => Number(await l.getByRole('progressbar').getAttribute('aria-valuenow'));
    await expect(l.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/);
    const v1 = await valeur();
    await ecrire(pageCollection, { statutSynchro: { ...STATUT_EN_COURS(n), page: 7 } });
    await expect.poll(valeur, { timeout: 3_000 }).toBeGreaterThan(v1);
    // Recul du stockage : l’affichage ne décroît pas dans la même étape.
    const v2 = await valeur();
    await ecrire(pageCollection, { statutSynchro: { ...STATUT_EN_COURS(n), page: 4 } });
    await pageCollection.waitForTimeout(1_500);
    expect(await valeur()).toBeGreaterThanOrEqual(v2);
  });

  test('SC-002 : barre de lots « N / M » : écrit à côté de la barre et valeurs ARIA', async ({ pageCollection }) => {
    await ecrire(pageCollection, { execution: EXECUTION_EN_COURS });
    const l = ligne(pageCollection, 'lots');
    await expect(l.getByTestId('pourcentage-ligne')).toHaveText('30 %');
    await l.getByRole('button', { name: /^Lots/ }).click();
    await expect(l).toContainText('3 / 6 · 50 %');
    const b = l.getByTestId('barre-detail').first();
    await expect(b).toHaveAttribute('aria-valuemax', '6');
    await expect(b).toHaveAttribute('aria-valuenow', '3');
    await expect(b).toHaveAttribute('aria-label', /\S/);
  });
});

test.describe('SC-013 : autre onglet du navigateur', () => {
  test('SC-013 : un traitement qui ne tourne pas ici est en lecture seule, même déplié', async ({ pageCollection }) => {
    const n = Date.now();
    await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000, execution: EXECUTION_EN_COURS });
    const lots = ligne(pageCollection, 'lots');
    await expect(lots).toContainText('en cours dans un autre onglet');
    for (const genre of ['lots', 'synchro'] as const) {
      const l = ligne(pageCollection, genre);
      await l.getByRole('button', { name: genre === 'lots' ? /^Lots/ : /^Synchro/ }).click();
      for (const nom of ['Pause', 'Reprendre', 'Arrêter']) {
        await expect(l.getByRole('button', { name: nom })).toHaveCount(0);
      }
    }
  });
});

// ───────────── AC4 : commandes réelles sur un lot qui tourne dans cet onglet (site et REST fictifs) ─────────────

const SITE = fs.readFileSync(path.resolve('tests/e2e/fixtures/site-vide.html'), 'utf8');
const ID_JOUEUR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_ETIQUETTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = `${b64({ alg: 'none' })}.${b64({ sub: ID_JOUEUR })}.signature-fictive`;
const COOKIE = `base64-${b64({ access_token: JETON, refresh_token: 'refresh-fictif', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: ID_JOUEUR } })}`;
const NB_CARTES = 20;

const carte = (i: number): object => ({
  id: `UR|Loutre fictive ${i}`, titre: `Loutre fictive ${i}`, rarete: 'UR', description: '', quantite: 1, url: null, favori: false,
  idsSite: [`bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`], etiquettesSite: [], statut: 'garder', prixCible: null,
  note: '', ami: null, valeurMarchande: null, decidePar: 'moi',
});

test.describe('SC-014, SC-013 : Pause, Reprendre, Arrêter appellent le pilotage', () => {
  test('SC-014 : Pause cesse les départs, Reprendre continue, Arrêter abandonne', async ({ context, pageCollection: page }) => {
    test.setTimeout(120_000);
    await page.evaluate(
      async (cartes) => {
        await chrome.storage.local.set({
          collection: { version: 2, cartes },
          preferences: { version: 2, mesThemes: [], amis: [] },
          amisInitiaux: 999,
          syncAuto: false,
        });
      },
      Array.from({ length: NB_CARTES }, (_, i) => carte(i)),
    );
    await page.reload();

    let requetes = 0;
    await context.route(
      (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
      (route) => route.abort(),
    );
    await context.route(`${ORIGINE_REST}/**`, async (route) => {
      requetes++;
      await new Promise((r) => setTimeout(r, 300));
      const creation = route.request().url().includes('/rest/v1/tags');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' },
        body: creation ? JSON.stringify({ id: ID_ETIQUETTE, user_id: ID_JOUEUR, name: 'x', created_at: '2026-01-01T00:00:00Z', color: COULEUR_ETIQUETTE }) : '',
      });
    });
    await context.route('https://www.wiki-masters.com/**', (route) => route.fulfill({ contentType: 'text/html', body: SITE }));
    await context.addCookies([{ name: NOM_COOKIE_SESSION, value: COOKIE, domain: 'www.wiki-masters.com', path: '/', secure: true }]);
    const site = await context.newPage();
    await site.goto('https://www.wiki-masters.com/collection');
    expect(CLE_PUBLIQUE).toBeTruthy();
    await page.bringToFront();

    await allerA(page, 'lots');
    await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
    await page.getByRole('button', { name: /^Lancer/ }).click();

    // Le bandeau est visible sur un autre onglet de la page, avec les commandes (le lot tourne dans cet onglet).
    await allerA(page, 'collection');
    const l = ligne(page, 'lots');
    await expect(l).toBeVisible({ timeout: 30_000 });
    await expect(l).not.toContainText('en cours dans un autre onglet');
    await l.getByRole('button', { name: /^Lots/ }).click();

    // Pause : plus aucun nouveau départ (les requêtes en vol vont à leur terme), puis le bouton devient Reprendre.
    await l.getByRole('button', { name: 'Pause' }).click();
    await expect(l.getByRole('button', { name: 'Reprendre' })).toBeVisible();
    await expect(l.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await page.waitForTimeout(1_500);
    const fige = requetes;
    await page.waitForTimeout(2_000);
    expect(requetes, 'aucun nouveau départ pendant la pause').toBe(fige);
    await expect(bandeau(page)).toBeVisible();

    // Reprendre : la même exécution repart.
    await l.getByRole('button', { name: 'Reprendre' }).click();
    await expect(l.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect.poll(() => requetes, { timeout: 15_000 }).toBeGreaterThan(fige);

    // Arrêter : l’exécution est abandonnée, le bandeau disparaît, les actions restantes ne partent pas.
    await l.getByRole('button', { name: 'Arrêter' }).click();
    await expect(bandeau(page)).toHaveCount(0, { timeout: 15_000 });
    const stoppe = requetes;
    await page.waitForTimeout(2_500);
    expect(requetes - stoppe, 'au plus les requêtes déjà en vol').toBeLessThanOrEqual(3);
    expect(requetes).toBeLessThan(NB_CARTES + 1);
    const etat = await page.evaluate(async () => ((await chrome.storage.local.get('execution')) as { execution: { etat: string } }).execution.etat);
    expect(etat).toBe('arretee');
  });
});

// ───────────── Captures : 3 breakpoints x 2 thèmes ─────────────

test.describe('SC-013 : captures', () => {
  for (const theme of THEMES) {
    for (const bp of BREAKPOINTS) {
      test(`SC-013 : captures ${theme} ${bp.name}`, async ({ pageCollection }) => {
        await pageCollection.emulateMedia({ colorScheme: theme });
        await pageCollection.setViewportSize({ width: bp.width, height: bp.height });
        const n = Date.now();
        await ecrire(pageCollection, { statutSynchro: STATUT_EN_COURS(n), bailSynchro: n + 120_000, execution: EXECUTION_EN_COURS });
        await expect(bandeau(pageCollection)).toBeVisible();
        // Pas de défilement horizontal, bandeau dans la largeur.
        const debordement = await pageCollection.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        await pageCollection.screenshot({ path: `test-results/captures/bandeau-replie-${theme}-${bp.name}.png`, fullPage: true });
        for (const genre of ['synchro', 'lots'] as const) {
          await ligne(pageCollection, genre).getByRole('button', { name: genre === 'lots' ? /^Lots/ : /^Synchro/ }).click();
        }
        await pageCollection.screenshot({ path: `test-results/captures/bandeau-deplie-${theme}-${bp.name}.png`, fullPage: true });
        await vider(pageCollection, ['execution', 'statutSynchro', 'bailSynchro']);
      });
    }
  }
});
