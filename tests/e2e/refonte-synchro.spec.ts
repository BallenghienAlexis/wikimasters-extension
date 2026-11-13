import { allerA, chargerCartes, expect, test } from './extension';
import type { Page } from '@playwright/test';

// T-306 : onglet Synchro (SC-002, SC-003, SC-028 interrupteur, SC-009). Données uniquement fictives, aucune requête vers le site.
//
// Contrat de sélecteurs pour l’implémentation (à respecter par dev-ui) :
//  - `data-testid="progression-synchro"` : bloc de la barre globale. Il contient un `role="progressbar"` dont le nom
//    accessible commence par « Progression de la synchronisation » et le texte écrit « Étape i / 4 · P % »
//    (`ProgressionSynchro.tsx`). Statut sans étape connue (v1 migrée) : barre sans `aria-valuenow`, texte
//    « Synchronisation en cours ».
//  - `data-testid="etapes-synchro"` : liste ; chaque étape est un `data-testid="etape-synchro"` portant
//    `data-etape="stats|pages|prix|ventes"` et `data-etat="faite|en-cours|attente|arret"`, avec le texte
//    « ✓ Lecture », « ▶ Pages », « ○ Prix », « ○ Ventes » (symbole + mot ; « ✕ » + mot sur l’étape où la synchro s’est
//    arrêtée). Chaque étape faite ou courante a sa barre d’étape (`role="progressbar"`, nom commençant par
//    « Étape ») avec son texte « N / M · P % » (ou « N lus » + sans `aria-valuenow` si M est inconnu).
//  - `data-testid="annonce-synchro"` : zone `aria-live="polite"` (texte de l’avancement, mise à jour au plus toutes les 2 s).
//  - `data-testid="liste-en-cours"`, `data-testid="liste-a-venir"`, `data-testid="liste-terminees"` : listes (`ListeTaches.tsx`),
//    une `<li>` par tâche. Étape : libellé de l’étape ; lot : « <Famille> : N action(s) » (« Étiquettes », « Enchères »,
//    « Défausses », « Suppressions », « Lectures »).
//  - `data-testid="aucune-activite"` : texte « Aucune activité en cours » (présent seulement sans activité ; les listes
//    En cours et À venir sont alors absentes).
//  - lien `getByRole('link', { name: /historique/i })` dont le `href` contient `historique` (l’historique lui-même est T-307).
//  - `data-testid="fraicheur-prix"` (`FraicheurPrix.tsx`) : « Prix relevés : N », puis « Le plus récent : … » et
//    « Le plus ancien : … » ; durée restante dans `data-testid="duree-restante"` (« moins d’une minute » ou « environ N min »).
//  - inchangés : `data-testid="synchro-auto"`, `data-testid="etat-synchro-auto"`, interrupteur `role="switch"` nommé
//    « Synchronisation automatique », boutons « Arrêter » et « Relancer la synchro ».

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['light', 'dark'] as const;

const CARTES = [
  { id: 'sy-1', titre: 'Cerf de démonstration', rarete: 'Commune', quantite: 2, statut: 'garder' },
  { id: 'sy-2', titre: 'Renard de démonstration', rarete: 'Rare', quantite: 1, statut: 'vendre' },
];

interface Statut {
  version?: 1 | 2;
  etat?: 'en-cours' | 'termine' | 'arret';
  page?: number | null;
  pages?: number | null;
  raison?: string | null;
  codeHttp?: number | null;
  etape?: string | null;
  prixFaits?: number | null;
  prixPrevus?: number | null;
}

const statut = (s: Statut = {}): Record<string, unknown> => ({
  version: 2,
  etat: 'en-cours',
  page: null,
  pages: null,
  raison: null,
  codeHttp: null,
  le: Date.now(),
  ajoutees: 0,
  etiquettes: 0,
  prix: 0,
  etape: 'pages',
  prixFaits: null,
  prixPrevus: null,
  debut: Date.now() - 60_000,
  ...s,
});

const entreeJournal = (n: number): Record<string, unknown> => ({
  id: `j-${n}`,
  horodatage: new Date(Date.UTC(2026, 10, 13, 10, 0, n)).toISOString(),
  idCarte: 'sy-1',
  titre: `Carte journal ${n}`,
  type: 'pose-etiquette',
  parametre: 'Statut · Garder',
  resultat: 'reussie',
  codeHttp: null,
  idLot: 'lot-j',
  rang: n,
  total: 25,
  lot: 'etiquettes',
  cause: null,
});

async function poser(page: Page, valeurs: Record<string, unknown>): Promise<void> {
  await chargerCartes(page, CARTES);
  await page.evaluate((v) => chrome.storage.local.set(v), valeurs);
  await page.reload();
  await allerA(page, 'synchro');
}

const maj = (page: Page, valeurs: Record<string, unknown>) => page.evaluate((v) => chrome.storage.local.set(v), valeurs);

const global = (page: Page) => page.getByTestId('progression-synchro');
const etape = (page: Page, id: string) => page.locator(`[data-testid="etape-synchro"][data-etape="${id}"]`);

test.describe('SC-002 : barre globale et étapes', () => {
  test('SC-002 : « Étape i / 4 · P % » avec role progressbar, valeurs et nom en français', async ({ pageCollection }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
    });
    // Étape 2 sur 4, 10 pages lues sur 40 : (1 + 0,25) / 4 = 31 %.
    await expect(global(pageCollection)).toContainText('Étape 2 / 4 · 31 %');
    const barre = global(pageCollection).getByRole('progressbar', { name: /^Progression de la synchronisation/ });
    await expect(barre).toHaveAttribute('aria-valuemin', '0');
    await expect(barre).toHaveAttribute('aria-valuemax', '100');
    await expect(barre).toHaveAttribute('aria-valuenow', '31');
  });

  test('SC-002 : étapes avec symbole et mot (faite, en cours, en attente) et barre d’étape « N / M · P % »', async ({
    pageCollection,
  }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
    });
    await expect(etape(pageCollection, 'stats')).toHaveAttribute('data-etat', 'faite');
    await expect(etape(pageCollection, 'stats')).toContainText('✓ Lecture');
    await expect(etape(pageCollection, 'pages')).toHaveAttribute('data-etat', 'en-cours');
    await expect(etape(pageCollection, 'pages')).toContainText('▶ Pages');
    await expect(etape(pageCollection, 'prix')).toHaveAttribute('data-etat', 'attente');
    await expect(etape(pageCollection, 'prix')).toContainText('○ Prix');
    await expect(etape(pageCollection, 'ventes')).toHaveAttribute('data-etat', 'attente');
    await expect(etape(pageCollection, 'ventes')).toContainText('○ Ventes');
    const barrePages = etape(pageCollection, 'pages').getByRole('progressbar', { name: /^Étape/ });
    await expect(barrePages).toHaveAttribute('aria-valuenow', '10');
    await expect(barrePages).toHaveAttribute('aria-valuemax', '40');
    await expect(etape(pageCollection, 'pages')).toContainText('10 / 40 · 25 %');
  });

  test('SC-002 : étape arrêtée affichée avec ✕ et le mot', async ({ pageCollection }) => {
    await poser(pageCollection, {
      derniereSynchro: Date.now() - 3_600_000,
      statutSynchro: statut({ etat: 'arret', etape: 'prix', raison: 'code-http', codeHttp: 403, prixFaits: 5, prixPrevus: 20 }),
    });
    await expect(etape(pageCollection, 'prix')).toHaveAttribute('data-etat', 'arret');
    await expect(etape(pageCollection, 'prix')).toContainText(/✕ Prix/);
    await expect(etape(pageCollection, 'prix')).toContainText(/arrêtée/i);
  });

  test('SC-002 : synchro terminée, 100 % et toutes les étapes faites', async ({ pageCollection }) => {
    await poser(pageCollection, {
      derniereSynchro: Date.now() - 60_000,
      statutSynchro: statut({ etat: 'termine', etape: null, page: 40, pages: 40, prixFaits: 20, prixPrevus: 20 }),
    });
    await expect(global(pageCollection)).toContainText('100 %');
    await expect(global(pageCollection).getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '100');
    for (const id of ['stats', 'pages', 'prix', 'ventes']) {
      await expect(etape(pageCollection, id)).toHaveAttribute('data-etat', 'faite');
    }
  });

  test('SC-002 : prixPrevus inconnu, barre d’étape Prix indéterminée (sans aria-valuenow), « N lus »', async ({ pageCollection }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'prix', page: 40, pages: 40, prixFaits: 7, prixPrevus: null }),
    });
    const barrePrix = etape(pageCollection, 'prix').getByRole('progressbar', { name: /^Étape/ });
    await expect(barrePrix).toBeVisible();
    await expect(barrePrix).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(etape(pageCollection, 'prix')).toContainText('7 lus');
    const texte = await pageCollection.getByRole('tabpanel').innerText();
    expect(texte).not.toMatch(/NaN|Infinity|undefined/);
  });

  test('SC-002 : statut v1 migré (étape inconnue), barre globale indéterminée, aucune erreur', async ({ pageCollection }) => {
    const erreurs: string[] = [];
    pageCollection.on('pageerror', (e) => erreurs.push(e.message));
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: {
        version: 1, etat: 'en-cours', page: 12, pages: 134, raison: null, codeHttp: null, le: Date.now(), ajoutees: 0, etiquettes: 0, prix: 0,
      },
    });
    const barre = global(pageCollection).getByRole('progressbar').first();
    await expect(barre).toBeVisible();
    await expect(barre).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(global(pageCollection)).toContainText('Synchronisation en cours');
    expect(erreurs).toEqual([]);
  });

  test('SC-002 : l’affichage suit le stockage en moins d’une seconde et le pourcentage ne décroît pas', async ({ pageCollection }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
    });
    await expect(global(pageCollection)).toContainText('Étape 2 / 4 · 31 %');
    await maj(pageCollection, { statutSynchro: statut({ etape: 'pages', page: 31, pages: 40 }) });
    // (1 + 30/40) / 4 = 43 %, vu dans la seconde.
    await expect(global(pageCollection)).toContainText('Étape 2 / 4 · 43 %', { timeout: 1000 });
    // Une valeur plus basse (pages relues) ne fait pas reculer la barre.
    await maj(pageCollection, { statutSynchro: statut({ etape: 'pages', page: 5, pages: 40 }) });
    await pageCollection.waitForTimeout(1200);
    await expect(global(pageCollection)).not.toContainText(/Étape 2 \/ 4 · (?:[0-3]\d|4[0-2]) %/);
  });

  test('SC-002 : la zone aria-live="polite" existe et n’annonce pas plus d’une fois toutes les 2 s', async ({ pageCollection }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 2, pages: 100 }),
    });
    const zone = pageCollection.getByTestId('annonce-synchro');
    await expect(zone).toHaveAttribute('aria-live', 'polite');
    await expect(zone).not.toBeEmpty();
    await pageCollection.evaluate(() => {
      const el = document.querySelector('[data-testid="annonce-synchro"]');
      const w = window as unknown as { __annonces: number };
      w.__annonces = 0;
      if (el) new MutationObserver(() => (w.__annonces += 1)).observe(el, { childList: true, characterData: true, subtree: true });
    });
    for (const page of [20, 40, 60]) {
      await maj(pageCollection, { statutSynchro: statut({ etape: 'pages', page, pages: 100 }) });
      await pageCollection.waitForTimeout(150);
    }
    await pageCollection.waitForTimeout(900);
    // Trois paliers de 10 % franchis en moins de 2 s après l’annonce initiale : aucune nouvelle annonce.
    expect(await pageCollection.evaluate(() => (window as unknown as { __annonces: number }).__annonces)).toBe(0);
  });
});

test.describe('SC-003 : listes En cours / À venir / Terminées', () => {
  const execution = {
    version: 2,
    idLot: 'lot-t306',
    etat: 'en-cours',
    traitees: 3,
    total: 30,
    lots: [
      { famille: 'etiquettes', total: 20, traitees: 3, sautees: 2 },
      { famille: 'encheres', total: 6, traitees: 0, sautees: 0 },
      { famille: 'defausses', total: 4, traitees: 0, sautees: 0 },
    ],
    pauseJusqua: null,
    erreur: null,
  };

  test('SC-003 : En cours (étape active), À venir (étapes restantes), Terminées (20 dernières, la plus récente en haut)', async ({
    pageCollection,
  }) => {
    const entrees = Array.from({ length: 25 }, (_, i) => entreeJournal(i + 1));
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
      journal: { version: 2, entrees },
    });
    await expect(pageCollection.getByTestId('liste-en-cours').getByRole('listitem')).toHaveCount(1);
    await expect(pageCollection.getByTestId('liste-en-cours')).toContainText(/Pages/);
    const aVenir = pageCollection.getByTestId('liste-a-venir').getByRole('listitem');
    await expect(aVenir).toHaveCount(2);
    await expect(aVenir.nth(0)).toContainText('Prix');
    await expect(aVenir.nth(1)).toContainText('Ventes');
    const terminees = pageCollection.getByTestId('liste-terminees').getByRole('listitem');
    await expect(terminees).toHaveCount(20);
    await expect(terminees.first()).toContainText('Carte journal 25');
    await expect(terminees.last()).toContainText('Carte journal 6');
    await expect(pageCollection.getByTestId('aucune-activite')).toHaveCount(0);
    const lien = pageCollection.getByRole('link', { name: /historique/i });
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute('href', /historique/);
  });

  test('SC-003 : exécution, un lot en cours et un lot par ligne à venir avec famille et nombre restant', async ({ pageCollection }) => {
    await poser(pageCollection, { execution, journal: { version: 2, entrees: [] } });
    // Lot Étiquettes : 20 - 3 - 2 = 15 restantes.
    await expect(pageCollection.getByTestId('liste-en-cours')).toContainText(/Étiquettes\s*:\s*15 actions/);
    const aVenir = pageCollection.getByTestId('liste-a-venir').getByRole('listitem');
    await expect(aVenir).toHaveCount(2);
    await expect(aVenir.nth(0)).toContainText(/Enchères\s*:\s*6 actions/);
    await expect(aVenir.nth(1)).toContainText(/Défausses\s*:\s*4 actions/);
  });

  test('SC-003 : sans activité, « Aucune activité en cours » et les seules Terminées', async ({ pageCollection }) => {
    await poser(pageCollection, {
      derniereSynchro: Date.now() - 600_000,
      statutSynchro: statut({ etat: 'termine', etape: null, page: 40, pages: 40 }),
      journal: { version: 2, entrees: [entreeJournal(1), entreeJournal(2)] },
    });
    await expect(pageCollection.getByTestId('aucune-activite')).toHaveText('Aucune activité en cours');
    await expect(pageCollection.getByTestId('liste-en-cours')).toHaveCount(0);
    await expect(pageCollection.getByTestId('liste-a-venir')).toHaveCount(0);
    await expect(pageCollection.getByTestId('liste-terminees').getByRole('listitem')).toHaveCount(2);
    await expect(pageCollection.getByRole('link', { name: /historique/i })).toBeVisible();
  });

  test('SC-003 : stockage vide, « Aucune activité en cours », pas d’erreur', async ({ pageCollection }) => {
    await poser(pageCollection, {});
    await expect(pageCollection.getByTestId('aucune-activite')).toHaveText('Aucune activité en cours');
    const texte = await pageCollection.getByRole('tabpanel').innerText();
    expect(texte).not.toMatch(/NaN|Infinity|undefined/);
  });
});

test.describe('H4 : fraîcheur des prix et durée restante', () => {
  const prix = (n: number, releveLe: number) => ({ valeur: n, releveLe });
  const etat = (releves: Record<string, unknown>) => ({
    version: 1, total: null, totalUnique: null, signatureEtiquettes: null, derniereComplete: null, arretJusqua: null,
    requetes: [], cardIds: {}, prix: releves,
  });

  test('H4 : prix relevés, plus récent et plus ancien', async ({ pageCollection }) => {
    const maintenant = Date.now();
    await poser(pageCollection, {
      derniereSynchro: maintenant - 60_000,
      etatSynchro: etat({ 'sy-1': prix(10, maintenant - 3 * 86_400_000), 'sy-2': prix(5, maintenant - 3_600_000) }),
    });
    const bloc = pageCollection.getByTestId('fraicheur-prix');
    await expect(bloc).toContainText('Prix relevés : 2');
    await expect(bloc).toContainText(/Le plus récent/);
    await expect(bloc).toContainText(/Le plus ancien/);
  });

  test('H4 : aucun prix relevé, « — » sans NaN', async ({ pageCollection }) => {
    await poser(pageCollection, {});
    const bloc = pageCollection.getByTestId('fraicheur-prix');
    await expect(bloc).toContainText('Prix relevés : 0');
    expect(await bloc.innerText()).not.toMatch(/NaN|Infinity|undefined/);
  });

  test('H4 : durée restante (pages restantes + prix restants + 1) × 0,25 s', async ({ pageCollection }) => {
    // Étape pages, page 11 sur 40 : 30 pages restantes, prix inconnus : (30 + 0 + 1) × 0,25 s = 8 s.
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
    });
    await expect(pageCollection.getByTestId('duree-restante')).toContainText('moins d’une minute');
    // Étape prix : 400 restants + 1 = 100,25 s, soit environ 2 min.
    await maj(pageCollection, { statutSynchro: statut({ etape: 'prix', page: 40, pages: 40, prixFaits: 0, prixPrevus: 400 }) });
    await expect(pageCollection.getByTestId('duree-restante')).toContainText('environ 2 min');
  });
});

test.describe('SC-028 : interrupteur et relance dans l’onglet Synchro, règles inchangées', () => {
  test('SC-028 : interrupteur de synchro auto, état et zone sont dans l’onglet Synchro', async ({ pageCollection }) => {
    await poser(pageCollection, {});
    const interrupteur = pageCollection.getByRole('switch', { name: 'Synchronisation automatique' });
    await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
    await expect(pageCollection.getByTestId('synchro-auto')).toBeVisible();
    await expect(pageCollection.getByTestId('etat-synchro-auto')).toHaveText('En attente d’un onglet WikiMasters');
    await interrupteur.focus();
    await pageCollection.keyboard.press('Space');
    await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
    await expect(pageCollection.getByTestId('etat-synchro-auto')).toHaveText('Désactivée');
  });

  test('SC-028 : « Relancer la synchro » proposé après un 403 avec son avertissement, absent après un 429', async ({
    pageCollection,
  }) => {
    await poser(pageCollection, {
      derniereSynchro: Date.now() - 3_600_000,
      statutSynchro: statut({ etat: 'arret', etape: 'pages', raison: 'code-http', codeHttp: 403, page: 5, pages: 40 }),
    });
    await expect(pageCollection.getByRole('button', { name: 'Relancer la synchro' })).toBeVisible();
    await expect(pageCollection.getByTestId('synchro-auto')).toContainText(/Relancer ignore la pause de 30\s?min/);
    await maj(pageCollection, { statutSynchro: statut({ etat: 'arret', etape: 'pages', raison: 'code-http', codeHttp: 429, page: 5, pages: 40 }) });
    await expect(pageCollection.getByRole('button', { name: 'Relancer la synchro' })).toHaveCount(0);
    await expect(pageCollection.getByTestId('synchro-auto')).toContainText('Le site limite les requêtes.');
  });

  test('SC-028 : « Arrêter » écrit la demande d’arrêt pendant une synchro', async ({ pageCollection }) => {
    await poser(pageCollection, {
      bailSynchro: Date.now() + 120_000,
      statutSynchro: statut({ etape: 'pages', page: 11, pages: 40 }),
    });
    await pageCollection.getByRole('button', { name: 'Arrêter' }).click();
    await expect
      .poll(() => pageCollection.evaluate(async () => typeof (await chrome.storage.local.get('arretSynchro')).arretSynchro))
      .toBe('number');
  });
});

test.describe('Clavier', () => {
  test('SC-028 : interrupteur et lien d’historique atteignables au clavier, sans tabindex positif', async ({ pageCollection }) => {
    await poser(pageCollection, { journal: { version: 2, entrees: [entreeJournal(1)] } });
    const positifs = await pageCollection.getByRole('tabpanel').locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count();
    expect(positifs).toBe(0);
    await pageCollection.getByRole('tab', { name: /^Synchro/ }).focus();
    const atteints = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await pageCollection.keyboard.press('Tab');
      const nom = await pageCollection.evaluate(() => {
        const a = document.activeElement;
        return a ? `${a.getAttribute('role') ?? a.tagName.toLowerCase()}|${a.getAttribute('aria-label') ?? a.textContent ?? ''}` : '';
      });
      atteints.add(nom);
    }
    expect([...atteints].some((n) => n.startsWith('switch|') && n.includes('Synchronisation automatique'))).toBe(true);
    expect([...atteints].some((n) => /^a\|.*historique/i.test(n))).toBe(true);
  });
});

test.describe('SC-009 : captures et débordement', () => {
  for (const colorScheme of THEMES) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`SC-009 : onglet Synchro ${colorScheme} ${name}, sans défilement horizontal`, async ({ pageCollection }) => {
        await pageCollection.emulateMedia({ colorScheme });
        await pageCollection.setViewportSize({ width, height });
        await poser(pageCollection, {
          bailSynchro: Date.now() + 120_000,
          derniereSynchro: Date.now() - 3_600_000,
          statutSynchro: statut({ etape: 'prix', page: 40, pages: 40, prixFaits: 12, prixPrevus: 60 }),
          execution: {
            version: 2, idLot: 'lot-cap', etat: 'en-cours', traitees: 3, total: 30,
            lots: [
              { famille: 'etiquettes', total: 20, traitees: 3, sautees: 0 },
              { famille: 'encheres', total: 10, traitees: 0, sautees: 0 },
            ],
            pauseJusqua: null, erreur: null,
          },
          journal: { version: 2, entrees: Array.from({ length: 22 }, (_, i) => entreeJournal(i + 1)) },
        });
        await expect(global(pageCollection)).toContainText('Étape 3 / 4');
        const debordement = await pageCollection.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(debordement).toBeLessThanOrEqual(0);
        await pageCollection.screenshot({ path: `test-results/captures/refonte-synchro-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
