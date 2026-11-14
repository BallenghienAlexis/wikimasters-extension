import type { BrowserContext, Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { NOM_COOKIE_SESSION, ORIGINE_REST } from '../../src/config/synchro';
import { allerA, chargerCartes, expect, test } from './extension';

// T-307 : panneau d'erreur, ignorées, historique filtrable (SC-004 à SC-008, SC-016 à SC-018). Données ENTIÈREMENT fictives ;
// le vrai site et son hôte REST ne sont jamais contactés (routes simulées, requêtes externes abandonnées et comptées).
//
// Contrat de sélecteurs pour dev-ui :
//  - `data-testid="panneau-erreur"` : `role="alert"`, dans l'onglet Synchro ; titre `h3` (`tabindex="-1"`) « Erreur d’exécution »
//    ou « Arrêt de la synchronisation » ; liste de description (dt/dd) : Action, Carte, Lot, Rang, Réponse du site, Cause probable,
//    Heure, Déjà fait, Autres échecs en vol, Reprise possible. Lot « Lot 2 / 4 · Étiquettes », rang « 37 / 120 », réponse « 403 · … ».
//  - boutons (nom accessible commençant par) : « Réessayer cette action », « Sauter cette action », « Sauter ce lot (N actions) »,
//    « Ignorer jusqu’à la prochaine synchro », « Arrêter tout », « Préparer un nouveau lot », « Fermer ». Désactivé =
//    `aria-disabled="true"` + `aria-describedby` vers un élément portant la raison ; un bouton désactivé reste focusable.
//  - `data-testid="etat-execution-illisible"` (`role="alert"`) : « L’état de l’exécution est illisible ».
//  - pastille sur l'onglet Synchro (`getByRole('tab', { name: /^Synchro/ })`) : texte « ✕ » (aria-hidden) + « erreur » (`sr-only`).
//  - Ignorées : `data-testid="ignorees"` ; bouton repliable `Ignorées (N)` avec `aria-expanded` ; tableau (`role="table"`) aux en-têtes
//    Action / Carte / Jusqu’à / Reprendre, en-têtes triables = boutons dans `columnheader` (`aria-sort`) ; bouton
//    `Reprendre « <action> » pour « <carte> »` ; vide : « Aucune action ignorée » ; échec d'écriture : `role="alert"` dans le panneau.
//  - Historique : `data-testid="historique"` (ancre #historique), filtres `getByLabel('Type' | 'Résultat' | 'Carte' | 'Exécution')`,
//    lignes `data-testid="ligne-historique"`, aucun résultat : « Aucune action ne correspond ».

const SITE = fs.readFileSync(path.resolve('tests/e2e/fixtures/site-vide.html'), 'utf8');
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['light', 'dark'] as const;

const erreur = (s: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'pose-etiquette',
  parametre: 'Statut · Garder',
  idCarte: 'UR|Loutre fictive',
  titre: 'Loutre fictive',
  famille: 'etiquettes',
  indexLot: 2,
  nbLots: 4,
  rang: 37,
  totalLot: 120,
  codeHttp: 403,
  cause: 'code-http',
  le: new Date(2026, 10, 13, 14, 5, 9).getTime(),
  reussies: 36,
  autresEchecsEnVol: 1,
  ...s,
});

const execution = (s: Record<string, unknown> = {}, e: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 2,
  idLot: 'lot-fictif',
  etat: 'arretee',
  traitees: 36,
  total: 120,
  lots: [{ famille: 'etiquettes', total: 120, traitees: 36, sautees: 0 }],
  pauseJusqua: null,
  erreur: erreur(e),
  ...s,
});

const entreeJournal = (n: number, s: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `j-${n}`,
  horodatage: new Date(Date.UTC(2026, 10, 13, 10, 0, n)).toISOString(),
  idCarte: 'UR|Loutre fictive',
  titre: 'Loutre fictive',
  type: 'pose-etiquette',
  parametre: 'Statut · Garder',
  resultat: 'reussie',
  codeHttp: null,
  idLot: 'lot-a',
  rang: n,
  total: 10,
  lot: 'etiquettes',
  cause: null,
  ...s,
});

const CARTE = (n: number): Record<string, unknown> => ({
  id: `UR|Loutre fictive ${n}`,
  titre: `Loutre fictive ${n}`,
  rarete: 'UR',
  quantite: 1,
  idsSite: [`bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`],
  statut: 'garder',
  decidePar: 'moi',
});

const poser = async (page: Page, valeurs: Record<string, unknown>, onglet: 'synchro' | 'lots' = 'synchro'): Promise<void> => {
  await chargerCartes(page, [CARTE(1), CARTE(2)]);
  await page.evaluate((v) => chrome.storage.local.set(v), valeurs);
  await page.reload();
  await allerA(page, onglet);
};

const panneau = (p: Page): Locator => p.getByTestId('panneau-erreur');
const bouton = (p: Page, nom: RegExp | string): Locator => panneau(p).getByRole('button', { name: nom });
const stockage = (p: Page, cle: string) => p.evaluate(async (c) => (await chrome.storage.local.get(c))[c], cle);

test.describe('SC-004 : contenu du panneau (champs fermés)', () => {
  test('SC-004 : role alert avec Action, Carte, Lot, Rang, Réponse du site, Cause, Heure, Déjà fait, en vol, Reprise', async ({ pageCollection: page }) => {
    await poser(page, { execution: execution() });
    const p = panneau(page);
    await expect(p).toHaveAttribute('role', 'alert');
    await expect(p).toContainText('Statut · Garder');
    await expect(p).toContainText('Loutre fictive');
    await expect(p).toContainText('Lot 2 / 4 · Étiquettes');
    await expect(p).toContainText('37 / 120');
    await expect(p).toContainText(/403/);
    await expect(p).toContainText(/14:05/);
    await expect(p).toContainText(/36/);
    for (const intitule of ['Action', 'Carte', 'Lot', 'Rang', 'Réponse du site', 'Cause probable', 'Heure', 'Déjà fait', 'Reprise possible']) {
      await expect(p.getByText(intitule, { exact: false }).first()).toBeVisible();
    }
    await expect(p).toContainText(/Sauter n’envoie rien au site\./);
    await expect(p).toContainText(/1\s+(autre )?échec/i);
  });

  test('SC-007 : aucun secret, corps de réponse ni identifiant d’exemplaire affiché', async ({ pageCollection: page }) => {
    const secret = 'jeton-fictif-a-ne-jamais-afficher';
    await poser(page, {
      execution: { ...execution(), access_token: secret, corps: secret, erreur: { ...erreur(), corps: secret, idExemplaire: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001' } },
    });
    // Soit les clés inconnues sont ignorées (panneau affiché), soit l'objet est rejeté : rien d'inconnu n'apparaît dans les deux cas.
    const html = await page.content();
    expect(html).not.toContain(secret);
    expect(html).not.toMatch(/bbbbbbbb-bbbb-4bbb-8bbb/);
    expect(html).not.toMatch(/Bearer|access_token|refresh_token/);
  });

  test('SC-004 : arrêt de la synchro, étape, page, code, heure, sans Sauter ni Ignorer', async ({ pageCollection: page }) => {
    await poser(page, {
      derniereSynchro: Date.now() - 3_600_000,
      statutSynchro: {
        version: 2, etat: 'arret', page: 3, pages: 10, raison: 'code-http', codeHttp: 403, le: new Date(2026, 10, 13, 9, 30).getTime(),
        ajoutees: 0, etiquettes: 0, prix: 0, etape: 'pages', prixFaits: null, prixPrevus: null, debut: Date.now() - 600_000,
      },
    });
    const p = panneau(page);
    await expect(p).toHaveAttribute('role', 'alert');
    await expect(p).toContainText(/Pages/);
    await expect(p).toContainText('3 / 10');
    await expect(p).toContainText(/403/);
    await expect(p).toContainText(/09:30/);
    await expect(p.getByRole('button', { name: /^Sauter/ })).toHaveCount(0);
    await expect(p.getByRole('button', { name: /^Ignorer/ })).toHaveCount(0);
  });
});

test.describe('SC-017 : après rechargement', () => {
  test('SC-017 : détail seul, « Préparer un nouveau lot » (principal) et « Fermer », aucun autre choix', async ({ pageCollection: page }) => {
    await poser(page, { execution: execution() });
    await expect(panneau(page)).toContainText('37 / 120');
    for (const absent of [/^Réessayer/, /^Sauter/, /^Ignorer/, /^Arrêter tout/]) {
      await expect(panneau(page).getByRole('button', { name: absent })).toHaveCount(0);
    }
    await expect(bouton(page, 'Préparer un nouveau lot')).toBeVisible();
    await expect(bouton(page, 'Fermer')).toBeVisible();
    await bouton(page, 'Préparer un nouveau lot').click();
    await expect(page.getByRole('tab', { name: /^Lots/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('SC-017 : « Fermer » retire le panneau', async ({ pageCollection: page }) => {
    await poser(page, { execution: execution() });
    await bouton(page, 'Fermer').click();
    await expect(panneau(page)).toHaveCount(0);
  });

  test('retouche T-307 : pause stockée après rechargement, « non, la page a été rechargée » et non une heure de reprise', async ({ pageCollection: page }) => {
    await poser(page, { execution: execution({ pauseJusqua: Date.now() + 25 * 60_000 }) });
    await expect(panneau(page)).toContainText(/Reprise possible\s*:?\s*non, la page a été rechargée/);
    await expect(panneau(page)).not.toContainText(/Reprise possible\s*:?\s*à \d{2}:\d{2}/);
    await expect(panneau(page)).toContainText('ne peut pas reprendre après un rechargement');
  });

  test('SC-019 : état d’exécution illisible, message, rien de lançable ni de sautable', async ({ pageCollection: page }) => {
    await poser(page, { execution: { version: 99, inconnu: true } });
    const m = page.getByTestId('etat-execution-illisible');
    await expect(m).toHaveAttribute('role', 'alert');
    await expect(m).toContainText('L’état de l’exécution est illisible');
    await expect(page.getByRole('button', { name: /^Sauter/ })).toHaveCount(0);
    expect(await stockage(page, 'execution')).toEqual({ version: 99, inconnu: true });
  });
});

// ───────────────────────── Exécution réelle sur un site fictif ─────────────────────────

interface Banc { rest: string[]; externes: string[] }

async function ouvrirSite(context: BrowserContext, repondre: (url: string, methode: string) => { status: number; corps?: unknown }): Promise<Banc> {
  const banc: Banc = { rest: [], externes: [] };
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => {
      const u = route.request().url();
      if (!u.startsWith('https://fr.wikipedia.org/w/api.php?') && !u.startsWith('https://www.wikidata.org/w/api.php?')) banc.externes.push(u);
      return route.abort();
    },
  );
  await context.route(`${ORIGINE_REST}/**`, (route) => {
    const r = route.request();
    banc.rest.push(`${r.method()} ${new URL(r.url()).pathname}`);
    const { status, corps } = repondre(r.url(), r.method());
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'https://www.wiki-masters.com' },
      body: corps === undefined ? '' : JSON.stringify(corps),
    });
  });
  await context.route('https://www.wiki-masters.com/**', (route) => route.fulfill({ contentType: 'text/html', body: SITE }));
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jeton = `${b64({ alg: 'none' })}.${b64({ sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })}.signature-fictive`;
  await context.addCookies([{
    name: NOM_COOKIE_SESSION,
    value: `base64-${b64({ access_token: jeton, refresh_token: 'refresh-fictif', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'x' } })}`,
    domain: 'www.wiki-masters.com', path: '/', secure: true,
  }]);
  const site = await context.newPage();
  await site.goto('https://www.wiki-masters.com/collection');
  return banc;
}

async function amorcerLot(page: Page, nbCartes: number): Promise<void> {
  const cartes = Array.from({ length: nbCartes }, (_, i) => CARTE(i + 1));
  await page.evaluate(async (c) => {
    await chrome.storage.local.set({
      collection: { version: 3, cartes: c.map((x) => ({ rarete: null, description: '', url: null, favori: false, etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...x })) },
      preferences: { version: 2, mesThemes: [], amis: [] },
      amisInitiaux: 999,
      syncAuto: false,
    });
  }, cartes);
  await page.reload();
}

const lancer = async (page: Page): Promise<void> => {
  await allerA(page, 'lots');
  await page.getByRole('button', { name: 'Voir l’aperçu du lot' }).click();
  await page.getByRole('button', { name: /^Lancer/ }).click();
};

/** Réponses : création 201, pose selon `pose`. */
const reponses = (pose: number) => (url: string): { status: number; corps?: unknown } =>
  url.includes('/rest/v1/tags')
    ? { status: 201, corps: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'x', created_at: '2026-01-01T00:00:00Z', color: '#000000' } }
    : { status: pose };

test.describe('exécution réelle (site fictif)', () => {
  test.setTimeout(90_000);

  test('SC-008 + SC-016 : 401, pastille sur l’onglet Synchro sans voler le focus, Réessayer désactivé avec l’heure', async ({ context, pageCollection: page }) => {
    await amorcerLot(page, 2);
    const banc = await ouvrirSite(context, () => ({ status: 401 }));
    await lancer(page);
    const onglet = page.getByRole('tab', { name: /^Synchro/ });
    await expect(onglet).toContainText('✕');
    await expect(onglet.locator('.sr-only')).toHaveText(/erreur/);
    await expect(page.getByTestId('panneau-erreur')).toHaveCount(0);
    await allerA(page, 'synchro');
    const p = panneau(page);
    await expect(p).toContainText(/401/);
    const r = bouton(page, /^Réessayer cette action/);
    await expect(r).toHaveAttribute('aria-disabled', 'true');
    await expect(r).toHaveAttribute('aria-describedby', /.+/);
    const raison = await r.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${raison}"]`)).toContainText(/Reprise possible à \d{2}:\d{2}/);
    await r.focus();
    await expect(r).toBeFocused();
    const avant = banc.rest.length;
    await r.click({ force: true });
    await page.waitForTimeout(500);
    expect(banc.rest.length).toBe(avant);
    for (const nom of [/^Sauter cette action/, /^Sauter ce lot/, /^Ignorer jusqu’à/, /^Arrêter tout/]) {
      await expect(bouton(page, nom)).not.toHaveAttribute('aria-disabled', 'true');
    }
    expect(banc.externes).toEqual([]);
  });

  test('SC-005 + SC-016 : pendant la pause, Sauter est local (aucune requête), puis les boutons de saut sont désactivés', async ({ context, pageCollection: page }) => {
    await amorcerLot(page, 2);
    const banc = await ouvrirSite(context, () => ({ status: 401 }));
    await lancer(page);
    await allerA(page, 'synchro');
    await expect(panneau(page)).toContainText(/401/);
    const avant = banc.rest.length;
    await bouton(page, /^Sauter cette action/).click();
    await expect.poll(async () => ((await stockage(page, 'journal')) as { entrees: Array<{ cause: string | null }> }).entrees.some((e) => e.cause === 'sautee')).toBe(true);
    await page.waitForTimeout(800);
    expect(banc.rest.length).toBe(avant);
    for (const nom of [/^Sauter cette action/, /^Sauter ce lot/, /^Ignorer jusqu’à/]) {
      await expect(bouton(page, nom)).toHaveAttribute('aria-disabled', 'true');
      await expect(bouton(page, nom)).toHaveAttribute('aria-describedby', /.+/);
    }
    await expect(bouton(page, /^Réessayer cette action/)).toHaveAttribute('aria-disabled', 'true');
    await expect(bouton(page, /^Arrêter tout/)).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('link', { name: /historique/i }).click();
    await expect(page.getByTestId('historique')).toContainText('Passée : sautée');
  });

  test('Décision 3 / SC-016 : seuil de refus par carte atteint, pause de 30 min affichée', async ({ context, pageCollection: page }) => {
    await amorcerLot(page, 4);
    await ouvrirSite(context, reponses(403));
    await lancer(page);
    await allerA(page, 'synchro');
    await expect(panneau(page)).toContainText(/403/, { timeout: 40_000 });
    await expect(bouton(page, /^Réessayer cette action/)).toHaveAttribute('aria-disabled', 'true');
    await expect(panneau(page)).toContainText(/Reprise possible à \d{2}:\d{2}/);
    const exe = (await stockage(page, 'execution')) as { pauseJusqua: number | null };
    expect(exe.pauseJusqua).toBeGreaterThan(Date.now() + 25 * 60_000);
    expect(exe.pauseJusqua).toBeLessThanOrEqual(Date.now() + 30 * 60_000 + 5000);
  });

  test('Décision 2 : « Réessayer » désactivé après un résultat inconnu, avec la raison écrite ; Sauter reste possible', async ({ context, pageCollection: page }) => {
    await amorcerLot(page, 2);
    const banc = await ouvrirSite(context, reponses(200));
    await lancer(page);
    await allerA(page, 'synchro');
    const r = bouton(page, /^Réessayer cette action/);
    await expect(r).toHaveAttribute('aria-disabled', 'true', { timeout: 40_000 });
    const raison = await r.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${raison}"]`)).toContainText('Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action');
    const avant = banc.rest.length;
    await r.click({ force: true });
    await page.waitForTimeout(500);
    expect(banc.rest.length).toBe(avant);
    await expect(bouton(page, /^Sauter cette action/)).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('SC-006 : écriture de « ignorees » refusée, message role alert sous le bouton, rien d’ignoré', async ({ context, pageCollection: page }) => {
    await amorcerLot(page, 4);
    await ouvrirSite(context, reponses(500));
    await lancer(page);
    await allerA(page, 'synchro');
    await expect(bouton(page, /^Ignorer jusqu’à/)).toBeVisible({ timeout: 40_000 });
    await page.evaluate(() => {
      const set = chrome.storage.local.set.bind(chrome.storage.local) as (v: Record<string, unknown>) => Promise<void>;
      (chrome.storage.local as unknown as { set: unknown }).set = (v: Record<string, unknown>) =>
        'ignorees' in v ? Promise.reject(new Error('quota')) : set(v);
    });
    await bouton(page, /^Ignorer jusqu’à/).click();
    await expect(panneau(page).getByRole('alert')).toBeVisible();
    expect(await stockage(page, 'ignorees')).toBeUndefined();
    await expect(bouton(page, /^Réessayer cette action/)).toBeVisible();
  });
});

// ───────────────────────── Ignorées (SC-006, D-31, D-32) ─────────────────────────

const ignoree = (n: number): Record<string, unknown> => ({
  type: 'pose-etiquette', idCarte: `UR|Loutre fictive ${n}`, parametre: 'Statut · Garder', portee: 'synchro', date: Date.now() - n * 3_600_000,
});

test.describe('Ignorées', () => {
  test('SC-006 : section repliée « Ignorées (2) », tableau, Reprendre sans requête, état vide', async ({ context, pageCollection: page }) => {
    await poser(page, { ignorees: { version: 1, entrees: [ignoree(1), ignoree(2)] } });
    const section = page.getByTestId('ignorees');
    const titre = section.getByRole('button', { name: 'Ignorées (2)' });
    await expect(titre).toHaveAttribute('aria-expanded', 'false');
    await titre.click();
    await expect(titre).toHaveAttribute('aria-expanded', 'true');
    for (const en of ['Action', 'Carte', 'Jusqu’à', 'Reprendre']) {
      await expect(section.getByRole('columnheader', { name: new RegExp(en) })).toBeVisible();
    }
    await expect(section).toContainText('prochaine synchro');
    const requetes: string[] = [];
    context.on('request', (r) => { if (r.url().startsWith('http')) requetes.push(r.url()); });
    const r1 = section.getByRole('button', { name: /^Reprendre « .+ » pour « Loutre fictive 1 »$/ });
    await expect(r1).toBeVisible();
    expect((await r1.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await r1.click();
    await expect(section.getByRole('button', { name: 'Ignorées (1)' })).toBeVisible();
    await section.getByRole('button', { name: /^Reprendre « .+ » pour « Loutre fictive 2 »$/ }).click();
    await expect(section).toContainText('Aucune action ignorée');
    expect(((await stockage(page, 'ignorees')) as { entrees: unknown[] }).entrees).toHaveLength(0);
    expect(requetes.filter((u) => u.includes('wiki-masters') || u.includes('supabase'))).toEqual([]);
  });

  test('D-16 : tableau triable par colonne (aria-sort)', async ({ pageCollection: page }) => {
    await poser(page, { ignorees: { version: 1, entrees: [ignoree(2), ignoree(1)] } });
    const section = page.getByTestId('ignorees');
    await section.getByRole('button', { name: /^Ignorées/ }).click();
    const col = section.getByRole('columnheader', { name: /Carte/ });
    await col.getByRole('button').click();
    await expect(col).toHaveAttribute('aria-sort', 'ascending');
    await expect(section.getByRole('row').nth(1)).toContainText('Loutre fictive 1');
    await col.getByRole('button').click();
    await expect(col).toHaveAttribute('aria-sort', 'descending');
    await expect(section.getByRole('row').nth(1)).toContainText('Loutre fictive 2');
  });

  test('D-32 : sans ignorée, la section affiche « Aucune action ignorée »', async ({ pageCollection: page }) => {
    await poser(page, {});
    const section = page.getByTestId('ignorees');
    await section.getByRole('button', { name: 'Ignorées (0)' }).click();
    await expect(section).toContainText('Aucune action ignorée');
  });
});

// ───────────────────────── Historique filtrable (SC-018) ─────────────────────────

test.describe('Historique', () => {
  const journal = [
    entreeJournal(1, { titre: 'Écureuil fictif', idCarte: 'C|Écureuil fictif' }),
    entreeJournal(2, { titre: 'Écureuil fictif', idCarte: 'C|Écureuil fictif', type: 'enchere', parametre: '50', resultat: 'echouee', codeHttp: 403, idLot: 'lot-b' }),
    entreeJournal(3, { titre: 'Renard fictif', idCarte: 'C|Renard fictif', resultat: 'passee', cause: 'sautee', idLot: 'lot-b' }),
    entreeJournal(4, { titre: 'Renard fictif', idCarte: 'C|Renard fictif', type: 'defausse', parametre: null, resultat: 'passee', cause: 'ignoree', idLot: 'lot-b' }),
  ];
  const lignes = (p: Page): Locator => p.getByTestId('historique').getByTestId('ligne-historique');

  test('SC-018 : libellés H5 affichés sans modifier le stockage', async ({ pageCollection: page }) => {
    await poser(page, { journal: { version: 2, entrees: journal } });
    await page.evaluate(() => { window.location.hash = 'synchro'; });
    const h = page.getByTestId('historique');
    await expect(h).toContainText('Passée : exemplaire indisponible');
    await expect(h).toContainText('Passée : sautée');
    await expect(h).toContainText('Passée : ignorée jusqu’à la prochaine synchro');
    expect(((await stockage(page, 'journal')) as { entrees: Array<{ resultat: string }> }).entrees[1]!.resultat).toBe('echouee');
  });

  test('SC-018 : filtres type, résultat, carte, exécution combinés en ET, puis « Aucune action ne correspond »', async ({ pageCollection: page }) => {
    await poser(page, { journal: { version: 2, entrees: journal } });
    const h = page.getByTestId('historique');
    await expect(lignes(page)).toHaveCount(4);
    await h.getByLabel('Type').selectOption({ label: 'Étiquette' });
    await expect(lignes(page)).toHaveCount(2);
    await h.getByLabel('Carte').fill('renard');
    await expect(lignes(page)).toHaveCount(1);
    await expect(lignes(page).first()).toContainText('Passée : sautée');
    await h.getByLabel('Résultat').selectOption({ label: 'Réussie' });
    await expect(h).toContainText('Aucune action ne correspond');
    await h.getByLabel('Résultat').selectOption({ index: 0 });
    await h.getByLabel('Carte').fill('');
    await h.getByLabel('Exécution').selectOption({ label: 'lot-a' });
    await expect(lignes(page)).toHaveCount(1);
  });

  test('SC-008 : filtres au clavier (Tab atteint les quatre filtres)', async ({ pageCollection: page }) => {
    await poser(page, { journal: { version: 2, entrees: journal } });
    const h = page.getByTestId('historique');
    for (const nom of ['Type', 'Résultat', 'Carte', 'Exécution']) {
      await h.getByLabel(nom).focus();
      await expect(h.getByLabel(nom)).toBeFocused();
    }
  });
});

// ───────────────────────── Captures 3 × 2 ─────────────────────────

test.describe('Captures', () => {
  for (const colorScheme of THEMES) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`SC-009 : panneau, ignorées et historique ${colorScheme} ${name}, sans défilement horizontal`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await poser(page, {
          execution: execution({ pauseJusqua: Date.now() + 20 * 60_000 }),
          ignorees: { version: 1, entrees: [ignoree(1)] },
          journal: { version: 2, entrees: [entreeJournal(1), entreeJournal(2, { resultat: 'passee', cause: 'sautee' })] },
        });
        await page.getByTestId('ignorees').getByRole('button', { name: /^Ignorées/ }).click();
        await expect(panneau(page)).toBeVisible();
        const defile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(defile).toBe(false);
        await page.screenshot({ path: `test-results/captures/refonte-erreur-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
