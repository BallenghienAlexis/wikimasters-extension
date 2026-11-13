import { describe, expect, it } from 'vitest';
import {
  MAX_ENTREES,
  MAX_OCTETS,
  cleCouple,
  cloreInterrompues,
  completerEntree,
  dernierePoseParCouple,
  ouvrirEntree,
  passerEntree,
  validerJournal,
  type ChampsEntree,
  type Journal,
} from '../../src/lib/journal';

const horloge = (debut = '2026-11-07T10:00:00.000Z') => {
  let t = Date.parse(debut);
  return () => {
    const d = new Date(t);
    t += 1000;
    return d;
  };
};

const champs = (surcharge: Partial<ChampsEntree> = {}): ChampsEntree => ({
  idCarte: 'Rare|Loutre',
  titre: 'Loutre',
  type: 'pose-etiquette',
  parametre: 'Ami Un',
  idLot: 'lot-1',
  ...surcharge,
});

const OK = { classe: 'reussie', codeHttp: 200, cause: 'ok' } as const;

describe('ouvrirEntree / completerEntree', () => {
  it('ajoute une entrée « en cours » sans mutation du journal reçu', () => {
    const vide: Journal = [];
    const r = ouvrirEntree(vide, champs(), horloge());
    expect(vide).toEqual([]);
    expect(r.journal).toHaveLength(1);
    expect(r.journal[0]).toMatchObject({
      id: r.id,
      horodatage: '2026-11-07T10:00:00.000Z',
      idCarte: 'Rare|Loutre',
      titre: 'Loutre',
      type: 'pose-etiquette',
      parametre: 'Ami Un',
      resultat: 'en-cours',
      codeHttp: null,
      idLot: 'lot-1',
    });
  });

  it('donne des identifiants uniques (compteur + horodatage), même à horloge figée', () => {
    const figee = () => new Date('2026-11-07T10:00:00.000Z');
    let j: Journal = [];
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = ouvrirEntree(j, champs(), figee);
      j = r.journal;
      ids.add(r.id);
    }
    expect(ids.size).toBe(5);
    for (const id of ids) expect(id).toMatch(/^\d+-\d+$/);
  });

  it('complète une entrée selon la classe du résultat', () => {
    const cas = [
      [{ classe: 'reussie', codeHttp: 200, cause: 'ok' }, 'reussie', 200],
      [{ classe: 'echec', codeHttp: 429, cause: 'x' }, 'echouee', 429],
      [{ classe: 'arret', codeHttp: 401, cause: 'x' }, 'interrompue', 401],
      [{ classe: 'inconnu', codeHttp: null, cause: 'x' }, 'inconnu', null],
    ] as const;
    for (const [res, attendu, code] of cas) {
      const { journal, id } = ouvrirEntree([], champs(), horloge());
      const fin = completerEntree(journal, id, res);
      expect(fin[0]?.resultat).toBe(attendu);
      expect(fin[0]?.codeHttp).toBe(code);
      expect(journal[0]?.resultat).toBe('en-cours');
    }
  });

  it('ignore un identifiant inconnu et ne touche pas une entrée déjà complétée', () => {
    const { journal, id } = ouvrirEntree([], champs(), horloge());
    expect(completerEntree(journal, 'absent', OK)).toEqual(journal);
    const fin = completerEntree(journal, id, OK);
    const encore = completerEntree(fin, id, { classe: 'echec', codeHttp: 500, cause: 'x' });
    expect(encore[0]?.resultat).toBe('reussie');
  });
});

describe('cloreInterrompues', () => {
  it('clôt les entrées « en cours » du lot en « interrompue » et laisse le reste', () => {
    const h = horloge();
    let j: Journal = [];
    j = ouvrirEntree(j, champs({ idLot: 'lot-1' }), h).journal;
    const b = ouvrirEntree(j, champs({ idLot: 'lot-2' }), h);
    j = completerEntree(b.journal, b.id, OK);
    j = ouvrirEntree(j, champs({ idLot: 'lot-2' }), h).journal;
    j = ouvrirEntree(j, champs({ idLot: 'lot-1', idCarte: 'Rare|Autre' }), h).journal;
    const fin = cloreInterrompues(j, 'lot-1');
    expect(fin.map((e) => e.resultat)).toEqual(['interrompue', 'reussie', 'en-cours', 'interrompue']);
    expect(j[0]?.resultat).toBe('en-cours');
  });
});

describe('FIFO', () => {
  it('garde au plus 1 000 entrées et écarte la plus ancienne', () => {
    const h = horloge();
    let j: Journal = [];
    const premier = ouvrirEntree(j, champs({ idCarte: 'Rare|0' }), h);
    j = premier.journal;
    for (let i = 1; i < MAX_ENTREES + 5; i++) {
      j = ouvrirEntree(j, champs({ idCarte: `Rare|${i}` }), h).journal;
    }
    expect(MAX_ENTREES).toBe(1000);
    expect(j).toHaveLength(1000);
    expect(j.some((e) => e.id === premier.id)).toBe(false);
    expect(j[0]?.idCarte).toBe('Rare|5');
    expect(j[999]?.idCarte).toBe(`Rare|${MAX_ENTREES + 4}`);
  });
});

describe('construction champ par champ', () => {
  it('ne recopie aucune clé parasite', () => {
    const parasite = {
      ...champs(),
      jeton: 'JETON-TEMOIN-FICTIF',
      authorization: 'Bearer JETON-TEMOIN-FICTIF',
      idExemplaire: 'ex-secret',
    } as unknown as ChampsEntree;
    const { journal, id } = ouvrirEntree([], parasite, horloge());
    const fin = completerEntree(journal, id, {
      classe: 'reussie',
      codeHttp: 200,
      cause: 'ok',
      corps: 'JETON-TEMOIN-FICTIF',
      jeton: 'JETON-TEMOIN-FICTIF',
    } as never);
    const json = JSON.stringify(fin);
    expect(json).not.toContain('JETON-TEMOIN-FICTIF');
    expect(json).not.toContain('authorization');
    expect(json).not.toContain('ex-secret');
    expect(Object.keys(fin[0] ?? {}).sort()).toEqual(
      ['cause', 'codeHttp', 'horodatage', 'id', 'idCarte', 'idLot', 'lot', 'parametre', 'rang', 'resultat', 'titre', 'total', 'type'],
    );
  });

  it('tronque les champs libres aux longueurs maximales', () => {
    const { journal } = ouvrirEntree(
      [],
      champs({ titre: 'é'.repeat(500), parametre: 'x'.repeat(500) }),
      horloge(),
    );
    expect(journal[0]?.titre).toHaveLength(300);
    expect(journal[0]?.parametre).toHaveLength(300);
  });

  it('accepte un paramètre nul', () => {
    const { journal } = ouvrirEntree([], champs({ type: 'lecture', parametre: null }), horloge());
    expect(journal[0]?.parametre).toBeNull();
  });
});

describe('validerJournal', () => {
  const valide = () => ouvrirEntree([], champs(), horloge()).journal;

  it('accepte un journal produit par le module, y compris vide', () => {
    expect(validerJournal([])).toEqual([]);
    expect(validerJournal(JSON.parse(JSON.stringify(valide())))).toEqual(valide());
  });

  it('rejette tout ce qui n’est pas un tableau', () => {
    for (const brut of [null, undefined, 3, 'x', {}, { 0: valide()[0] }]) {
      expect(validerJournal(brut)).toBeNull();
    }
  });

  it('rejette une entrée de forme inattendue', () => {
    const e = valide()[0]!;
    const mauvaises: unknown[] = [
      null,
      'x',
      { ...e, jeton: 'x' },
      { ...e, id: 3 },
      { ...e, horodatage: 'hier' },
      { ...e, horodatage: '2026-11-07' },
      { ...e, type: 'inconnu' },
      { ...e, resultat: 'autre' },
      { ...e, codeHttp: '200' },
      { ...e, codeHttp: 99 },
      { ...e, parametre: 3 },
      { ...e, titre: 'x'.repeat(301) },
      Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'idLot')),
    ];
    for (const m of mauvaises) expect(validerJournal([m])).toBeNull();
  });

  it('rejette un journal de plus de 1 000 entrées', () => {
    const e = valide()[0]!;
    expect(validerJournal(Array.from({ length: 1001 }, () => e))).toBeNull();
    expect(validerJournal(Array.from({ length: 1000 }, () => e))).toHaveLength(1000);
  });

  it('renvoie une copie construite champ par champ', () => {
    const brut = JSON.parse(JSON.stringify(valide())) as unknown[];
    const sortie = validerJournal(brut)!;
    expect(sortie[0]).not.toBe(brut[0]);
  });
});

describe('dernierePoseParCouple', () => {
  it('renvoie la pose réussie la plus récente par couple (carte, étiquette)', () => {
    const h = horloge();
    let j: Journal = [];
    const poser = (c: Partial<ChampsEntree>, res: Parameters<typeof completerEntree>[2]) => {
      const r = ouvrirEntree(j, champs(c), h);
      j = completerEntree(r.journal, r.id, res);
      return r.id;
    };
    poser({}, OK);
    const recente = poser({}, OK);
    poser({}, { classe: 'echec', codeHttp: 500, cause: 'x' });
    poser({ type: 'retrait-etiquette' }, OK);
    poser({ type: 'enchere', parametre: '50' }, OK);
    const autreEtiquette = poser({ parametre: 'Ami Deux' }, OK);
    const autreCarte = poser({ idCarte: 'Rare|Renard', titre: 'Renard' }, OK);
    // en cours : ne compte pas
    j = ouvrirEntree(j, champs({ parametre: 'Ami Trois' }), h).journal;

    const m = dernierePoseParCouple(j);
    expect(m.size).toBe(3);
    expect(m.get(cleCouple('Rare|Loutre', 'Ami Un'))?.id).toBe(recente);
    expect(m.get(cleCouple('Rare|Loutre', 'Ami Deux'))?.id).toBe(autreEtiquette);
    expect(m.get(cleCouple('Rare|Renard', 'Ami Un'))?.id).toBe(autreCarte);
    expect(m.has(cleCouple('Rare|Loutre', 'Ami Trois'))).toBe(false);
  });

  it('distingue les couples dont les noms se recoupent', () => {
    expect(cleCouple('a|b', 'c')).not.toBe(cleCouple('a', 'b|c'));
  });
});

describe('passerEntree', () => {
  it('inscrit une entrée « en cours » en « passée », sans toucher aux autres', () => {
    const h = horloge();
    const a = ouvrirEntree([], champs(), h);
    const b = ouvrirEntree(a.journal, champs({ idCarte: 'Rare|Autre' }), h);
    const fin = passerEntree(b.journal, a.id);
    expect(fin.map((e) => e.resultat)).toEqual(['passee', 'en-cours']);
    expect(fin[0]?.codeHttp).toBeNull();
    expect(b.journal[0]?.resultat).toBe('en-cours');
  });

  it('ignore un identifiant inconnu et une entrée déjà complétée', () => {
    const { journal, id } = ouvrirEntree([], champs(), horloge());
    expect(passerEntree(journal, 'absent')).toEqual(journal);
    const fin = completerEntree(journal, id, OK);
    expect(passerEntree(fin, id)[0]?.resultat).toBe('reussie');
  });
});

describe('idLot', () => {
  it('est tronqué de la même façon à l’ouverture et à la clôture', () => {
    const long = `lot-${'x'.repeat(100)}`;
    const { journal } = ouvrirEntree([], champs({ idLot: long }), horloge());
    expect(Array.from(journal[0]!.idLot)).toHaveLength(64);
    const fin = cloreInterrompues(journal, long);
    expect(fin[0]?.resultat).toBe('interrompue');
    expect(validerJournal(fin)).not.toBeNull();
  });
});

describe('classe de résultat inattendue', () => {
  it('ne cherche pas dans le prototype', () => {
    const { journal, id } = ouvrirEntree([], champs(), horloge());
    for (const classe of ['constructor', 'toString', '__proto__']) {
      const fin = completerEntree(journal, id, { classe, codeHttp: 200, cause: 'x' } as never);
      expect(fin[0]?.resultat).toBe('inconnu');
    }
  });
});

const octets = (j: unknown): number => new TextEncoder().encode(JSON.stringify(j)).length;

describe('double borne : au plus 1 000 entrées ET au plus 1 Mo', () => {
  const remplir = (texte: string, n = MAX_ENTREES): Journal => {
    const h = horloge();
    let j: Journal = [];
    for (let i = 0; i < n; i++) {
      const r = ouvrirEntree(
        j,
        champs({ idCarte: `Légendaire|${texte}`, titre: texte, parametre: texte }),
        h,
      );
      j = completerEntree(r.journal, r.id, OK);
    }
    return j;
  };

  it.each([
    ['ASCII', 't'.repeat(300)],
    ['émojis (4 octets UTF-8)', '😀'.repeat(300)],
  ])('%s : poids exact ≤ 1 Mo et le plus grand suffixe qui tient est conservé', (_nom, texte) => {
    const j = remplir(texte);
    const poids = octets(j);
    expect(poids).toBeLessThanOrEqual(MAX_OCTETS);
    expect(j.length).toBeLessThanOrEqual(MAX_ENTREES);
    // Maximalité : réintégrer l’entrée la plus ancienne écartée ferait dépasser 1 Mo
    // (une entrée pèse au moins autant que la première conservée, au chiffre de l’identifiant près).
    expect(poids + octets(j[0]) - 10).toBeGreaterThan(MAX_OCTETS);
  }, 60_000);

  it('le plafond en octets est exact avec des entrées courtes : 1 000 entrées conservées', () => {
    const j = remplir('t', MAX_ENTREES);
    expect(j).toHaveLength(MAX_ENTREES);
    expect(octets(j)).toBeLessThanOrEqual(MAX_OCTETS);
  });

  it('validerJournal rejette un journal valide en forme mais de plus de 1 Mo', () => {
    const e = ouvrirEntree([], champs({ titre: '😀'.repeat(300), parametre: '😀'.repeat(300) }), horloge())
      .journal[0]!;
    const gros = Array.from({ length: MAX_ENTREES }, () => e);
    expect(octets(gros)).toBeGreaterThan(MAX_OCTETS);
    expect(validerJournal(gros)).toBeNull();
    const ok = gros.slice(0, 100);
    expect(validerJournal(ok)).toHaveLength(100);
  });
});
