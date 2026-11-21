import { describe, expect, it } from 'vitest';
import { analyserPage, analyserPrix, sensDuPrix, analyserStats, decrireForme, diagnosticStats } from '../../src/lib/lectureApi';

// Réponses fictives, conformes à specs/synchro-auto/releve-api.md.
const etiquette = (id: string, name: string) => ({ id, name, color: '#112233', user_id: 'u-fictif', created_at: '2026-01-01' });

const element = (surcharge: Record<string, unknown> = {}, carte: Record<string, unknown> = {}) => ({
  id: 'uc-1',
  card_id: 'c-1',
  count: 1,
  starred: false,
  is_shiny: false,
  obtained_at: '2026-01-01',
  user_id: 'u-fictif',
  tags: [etiquette('t-1', 'Thème · Chats')],
  card: {
    id: 'c-1',
    rarity: 'SR',
    wikipedia_title: 'Chat fictif',
    atk: 10,
    def: 20,
    secret: 'ne-pas-copier',
    ...carte,
  },
  ...surcharge,
});

const page = (collection: unknown[]) => ({ collection, total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] });

describe('analyserPage : ordre par date d’ajout', () => {
  it('confirme « plus récent d’abord » quand les dates décroissent', () => {
    const a = element({ id: 'e1', card_id: 'c-a', obtained_at: '2026-03-02T00:00:00Z' });
    const b = element({ id: 'e2', card_id: 'c-b', obtained_at: '2026-03-01T00:00:00Z' });
    expect(analyserPage(page([a, b]))?.recentDabord).toBe(true);
    expect(analyserPage(page([b, a]))?.recentDabord).toBe(false);
    expect(analyserPage(page([a, { ...b, obtained_at: undefined }]))?.recentDabord).toBe(false);
  });
});

describe('analyserStats', () => {
  it('SC-012 : renvoie total, totalUnique et étiquettes converties', () => {
    const r = analyserStats({
      total: 12,
      totalUnique: 10,
      rarityCounts: { C: 1 },
      tagOptions: [{ id: 't-1', user_id: 'u', name: 'Ami · Zoé', color: '#fff', created_at: 'x', cardCount: 4 }],
    });
    expect(r).toEqual({ total: 12, totalUnique: 10, etiquettes: [{ id: 't-1', nom: 'Ami · Zoé', couleur: '#fff', nbCartes: 4 }] });
  });

  it('SC-010 : forme inattendue → null', () => {
    expect(analyserStats(null)).toBeNull();
    expect(analyserStats({ total: '12', totalUnique: 1, tagOptions: [] })).toBeNull();
    expect(analyserStats({ total: -1, totalUnique: 1, tagOptions: [] })).toBeNull();
    expect(analyserStats({ total: 1, totalUnique: 1 })).toEqual({ total: 1, totalUnique: 1, etiquettes: [] });
  });

  it('totalUnique ou tagOptions absents (réponse allégée du site) : repli, pas de rejet', () => {
    expect(analyserStats({ total: 5, tagOptions: [] })).toEqual({ total: 5, totalUnique: null, etiquettes: [] });
    expect(analyserStats({ total: 5, totalUnique: 'x', tagOptions: 3 })).toEqual({ total: 5, totalUnique: null, etiquettes: [] });
    expect(analyserStats({ totalUnique: 5 })).toBeNull();
  });

  it('une étiquette illisible est ignorée, une couleur absente devient vide, plus de 200 étiquettes sont acceptées', () => {
    const options = Array.from({ length: 300 }, (_, i) => ({ id: `t-${i}`, name: `E${i}`, color: i === 0 ? null : '#fff', cardCount: i }));
    const r = analyserStats({ total: 1, totalUnique: 1, tagOptions: [{ id: 1 }, { id: 'x', name: '', cardCount: 1 }, ...options] });
    expect(r?.etiquettes).toHaveLength(300);
    expect(r?.etiquettes[0]).toMatchObject({ id: 't-0', couleur: '' });
  });
});

describe('analyserPage', () => {
  it('SC-012 : convertit une carte (identifiant rareté|titre, idsSite, favori, étiquettes)', () => {
    const r = analyserPage(page([element({ count: 2, starred: true })]));
    expect(r).not.toBeNull();
    expect(r!.fin).toBe(false);
    expect(r!.ignorees).toBe(0);
    expect(r!.cartes).toEqual([
      {
        id: 'SR|Chat fictif',
        titre: 'Chat fictif',
        rarete: 'SR',
        cardId: 'c-1',
        idsSite: ['uc-1'],
        quantite: 2,
        favori: true,
        etiquettesSite: ['Thème · Chats'],
      },
    ]);
  });

  it('SC-010 : une carte de forme inattendue est ignorée et comptée, les autres sont gardées', () => {
    const r = analyserPage(
      page([element(), { id: 'uc-2' }, element({ id: 'uc-3', count: 'beaucoup' }), element({ id: 'uc-4' }, { rarity: 'ZZ' }), 42, null]),
    );
    expect(r!.cartes).toHaveLength(1);
    expect(r!.ignorees).toBe(5);
  });

  it('SC-013 : collection vide = fin du parcours', () => {
    expect(analyserPage(page([]))).toEqual({ cartes: [], ignorees: 0, fin: true, lignes: 0, recentDabord: false });
  });

  it('SC-010 : réponse sans tableau collection → null', () => {
    expect(analyserPage(null)).toBeNull();
    expect(analyserPage({})).toBeNull();
    expect(analyserPage({ collection: 'x' })).toBeNull();
  });

  it('regroupe les exemplaires d’une même carte (même identifiant local)', () => {
    const r = analyserPage(
      page([
        element({ id: 'uc-1', count: 1 }),
        element({ id: 'uc-2', count: 2, starred: true, tags: [etiquette('t-2', 'Statut · Garder')] }),
      ]),
    );
    expect(r!.cartes).toHaveLength(1);
    expect(r!.cartes[0]).toMatchObject({
      idsSite: ['uc-1', 'uc-2'],
      quantite: 3,
      favori: true,
      etiquettesSite: ['Thème · Chats', 'Statut · Garder'],
    });
  });

  it('SC-010 : une étiquette de forme inattendue rend la carte ignorée', () => {
    const r = analyserPage(page([element({ tags: [{ id: 't' }] })]));
    expect(r!.cartes).toHaveLength(0);
    expect(r!.ignorees).toBe(1);
  });

  it('AC4 : aucun champ hors liste blanche n’est copié', () => {
    const r = analyserPage(page([element({ user_id: 'secret-utilisateur' })]));
    const texte = JSON.stringify(r);
    expect(texte).not.toContain('ne-pas-copier');
    expect(texte).not.toContain('secret-utilisateur');
    expect(texte).not.toContain('u-fictif');
    expect(Object.keys(r!.cartes[0]!).sort()).toEqual(
      ['cardId', 'etiquettesSite', 'favori', 'id', 'idsSite', 'quantite', 'rarete', 'titre'].sort(),
    );
  });
});

describe('analyserPrix', () => {
  const reponse = (summary: unknown) => ({ wikipedia_title: 'Chat fictif', summary, isPro: false });

  it('SC-013 : renvoie average pour la rareté demandée', () => {
    expect(analyserPrix(reponse({ L: { average: 276 } }), 'L')).toBe(276);
    expect(analyserPrix(reponse({ L: { average: 276 }, SR: { average: 0 } }), 'SR')).toBe(0);
  });

  it('SC-010 : valeur invalide ou rareté absente → null', () => {
    expect(analyserPrix(reponse({ L: { average: 276 } }), 'SR')).toBeNull();
    expect(analyserPrix(reponse({ L: { average: 12.5 } }), 'L')).toBeNull();
    expect(analyserPrix(reponse({ L: { average: -1 } }), 'L')).toBeNull();
    expect(analyserPrix(reponse({ L: { average: '276' } }), 'L')).toBeNull();
    expect(analyserPrix(reponse({ L: {} }), 'L')).toBeNull();
    expect(analyserPrix(reponse(null), 'L')).toBeNull();
    expect(analyserPrix(null, 'L')).toBeNull();
    expect(analyserPrix({ error: 'pro_required' }, 'L')).toBeNull();
  });

  it('ne lit pas une clé héritée du prototype', () => {
    expect(analyserPrix(reponse({}), 'constructor')).toBeNull();
  });
});

describe('diagnostics de forme', () => {
  it('décrit la forme sans aucune valeur', () => {
    expect(decrireForme(null)).toBe('vide ou non JSON');
    expect(decrireForme([1, 2])).toBe('tableau de 2');
    expect(decrireForme({ total: 12, secret: 'jeton-abc' })).toBe('objet {total, secret}');
    expect(decrireForme({ total: 12, secret: 'jeton-abc' })).not.toContain('jeton-abc');
  });

  it('nomme le champ de stats fautif', () => {
    expect(diagnosticStats({ total: 'x', totalUnique: 1, tagOptions: [] })).toContain('total');
    expect(diagnosticStats('html')).toContain('string');
  });
});

describe('sensDuPrix', () => {
  const reponse = (summary: unknown) => ({ summary, isPro: false });
  it('distingue une valeur, une vraie absence de vente et une réponse vide', () => {
    expect(sensDuPrix(reponse({ L: { average: 5 } }), 'L')).toBe('valeur');
    expect(sensDuPrix(reponse({}), 'L')).toBe('aucune-vente');
    expect(sensDuPrix(reponse({ L: { average: null } }), 'L')).toBe('aucune-vente');
    expect(sensDuPrix(reponse({ L: {} }), 'L')).toBe('aucune-vente');
    expect(sensDuPrix(null, 'L')).toBe('vide');
    expect(sensDuPrix({}, 'L')).toBe('vide');
    expect(sensDuPrix(reponse(null), 'L')).toBe('vide');
    expect(sensDuPrix(reponse({ L: { average: '5' } }), 'L')).toBe('vide');
  });
});

describe('prix : nouvelle forme « recent » (2026-11-21)', () => {
  const vente = (rarity: string, final_price: number) => ({ id: 'v', final_price, settled_at: '2026-11-21T10:00:00+00:00', rarity });
  it('moyenne les ventes récentes de la rareté', () => {
    const json = { recent: [vente('SR', 22), vente('SR', 62), vente('UR', 400), vente('SR', 11)] };
    expect(sensDuPrix(json, 'SR')).toBe('valeur');
    expect(analyserPrix(json, 'SR')).toBe(32);
  });
  it('liste vide ou rareté absente = aucune vente, pas une réponse vide', () => {
    expect(sensDuPrix({ recent: [] }, 'SR')).toBe('aucune-vente');
    expect(sensDuPrix({ recent: [vente('UR', 5)] }, 'SR')).toBe('aucune-vente');
    expect(analyserPrix({ recent: [] }, 'SR')).toBeNull();
  });
  it('une forme illisible reste « vide »', () => {
    expect(sensDuPrix({ recent: 'x' }, 'SR')).toBe('vide');
    expect(sensDuPrix({ autre: 1 }, 'SR')).toBe('vide');
  });
  it('summary garde la priorité', () => {
    expect(analyserPrix({ summary: { SR: { average: 9 } }, recent: [vente('SR', 50)] }, 'SR')).toBe(9);
  });
});
