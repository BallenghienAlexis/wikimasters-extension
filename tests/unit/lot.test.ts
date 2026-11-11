import { describe, expect, it } from 'vitest'
import type { Action, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { STATUTS, collectionVide } from '../../src/lib/collection'
import { CONFIG_PRIX } from '../../src/config/prix'
import { preferencesParDefaut, prixDepart, proposerTri } from '../../src/lib/tri'
import { construireLot, exemplairesAttendus, type Config } from '../../src/lib/lot'
import type { Registre } from '../../src/lib/actions'
import { registreVide } from '../../src/lib/registre'

const TOUS: TypesDisponibles = new Set<TypeAction>(TYPES_ACTION)

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${id}`],
  etiquettesSite: [],
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...extra,
})

const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({
  maxVentesSimultanees: 5,
  longueurMaxEtiquette: 50,
  nomsExistants: [],
  ...extra,
})
const registre = (couples: Registre['couples'] = [], etiquettes: Registre['etiquettes'] = {}): Registre => ({
  ...registreVide(),
  couples,
  etiquettes,
})
const types = (...t: TypeAction[]): TypesDisponibles => new Set(t)
const de = (a: Action[], type: TypeAction) => a.filter((x) => x.type === type)

describe('garde-fous (SC-003, SC-004, SC-005)', () => {
  it('un favori ne produit aucune action, même avec une étiquette obsolète (SC-003)', () => {
    const c = carte('a', { favori: true, statut: 'defausser', valeurMarchande: 1 })
    const lot = construireLot(coll(c), registre([{ ex: 'ex-a', nom: 'Statut · Garder' }]), config(), TOUS)
    expect(lot.actions).toEqual([])
    expect(lot.ecartees).toEqual([])
    expect(lot.obsoletes).toEqual([{ idCarte: 'a', titre: 'Carte a', idExemplaire: 'ex-a', nomEtiquette: 'Statut · Garder' }])
  })

  it('une carte à trier ne produit aucune action et ses étiquettes obsolètes sont signalées (SC-004, H18)', () => {
    const c = carte('a', { statut: 'a-trier' })
    const lot = construireLot(coll(c), registre([{ ex: 'ex-a', nom: 'Statut · Garder' }]), config(), TOUS)
    expect(lot.actions).toEqual([])
    expect(lot.obsoletes).toHaveLength(1)
  })

  it('un favori ne produit aucune action pour aucun statut (SC-003)', () => {
    for (const statut of STATUTS) {
      const c = carte('a', { favori: true, statut, valeurMarchande: 100, prixCible: 10, idsSite: ['x1', 'x2'], quantite: 2 })
      const r = registre([{ ex: 'x1', nom: 'Statut · Garder' }], { 'Statut · Garder': 'e1' })
      const lot = construireLot(coll(c), r, config(), TOUS)
      expect(lot.actions, statut).toEqual([])
      expect(lot.obsoletes, statut).toEqual([{ idCarte: 'a', titre: 'Carte a', idExemplaire: 'x1', nomEtiquette: 'Statut · Garder' }])
    }
  })

  it('le statut stocké décide, pas la proposition de l’assistant (SC-005)', () => {
    const prefs = preferencesParDefaut()
    // Stocké « garder », mais l’assistant défausserait (valeur sous le seuil).
    const g = carte('a', { statut: 'garder', decidePar: 'moi', valeurMarchande: CONFIG_PRIX.seuilDefausse - 1 })
    expect(proposerTri(g, prefs).statut).toBe('defausser')
    // Stocké « défausser », mais l’assistant vendrait.
    const d = carte('b', { statut: 'defausser', decidePar: 'moi', valeurMarchande: 100 })
    expect(proposerTri(d, prefs).statut).toBe('vendre')
    expect(prixDepart(100)).not.toBeNull()

    const lot = construireLot(coll(g, d), registre(), config(), TOUS)
    expect(lot.actions).toEqual([
      { type: 'creation-etiquette', idCarte: 'a', nomEtiquette: 'Statut · Garder' },
      { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Statut · Garder' },
    ])
    // Le statut stocké « défausser » est suivi (pas d’enchère), mais la valeur dépasse le plafond de défausse.
    expect(lot.ecartees).toEqual([{ idCarte: 'b', titre: 'Carte b', raison: 'valeur-defausse-elevee' }])
  })

  it('ne modifie pas ses entrées', () => {
    const c = coll(carte('a'))
    const r = registre()
    const avant = JSON.stringify([c, r])
    construireLot(c, r, config(), TOUS)
    expect(JSON.stringify([c, r])).toBe(avant)
  })
})

describe('cartes écartées (SC-024, H47)', () => {
  it('une carte non reliée est écartée sans action', () => {
    const lot = construireLot(coll(carte('a', { idsSite: null })), registre(), config(), TOUS)
    expect(lot.actions).toEqual([])
    expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'non-reliee' }])
  })

  it('un identifiant présent dans deux cartes les écarte toutes les deux', () => {
    const lot = construireLot(
      coll(carte('a', { idsSite: ['x', 'y'] }), carte('b', { idsSite: ['y'] }), carte('c')),
      registre(),
      config(),
      TOUS,
    )
    expect(lot.ecartees.map((e) => [e.idCarte, e.raison])).toEqual([
      ['a', 'identifiant-en-conflit'],
      ['b', 'identifiant-en-conflit'],
    ])
    expect(lot.actions.every((a) => a.idCarte === 'c')).toBe(true)
  })
})

describe('étiquettes (SC-007 a à e, H16)', () => {
  it('(a) pose « Statut · <libellé> » sur chaque exemplaire relié, après une création', () => {
    const lot = construireLot(coll(carte('a', { idsSite: ['x1', 'x2'] })), registre(), config(), TOUS)
    expect(lot.actions).toEqual([
      { type: 'creation-etiquette', idCarte: 'a', nomEtiquette: 'Statut · Garder' },
      { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x1', nomEtiquette: 'Statut · Garder' },
      { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x2', nomEtiquette: 'Statut · Garder' },
    ])
  })

  it('(a) une carte vendre en attente de place reçoit quand même son étiquette (H16)', () => {
    const lot = construireLot(coll(carte('a', { statut: 'vendre' })), registre(), config({ maxVentesSimultanees: 0 }), TOUS)
    expect(de(lot.actions, 'pose-etiquette').map((a) => (a as { nomEtiquette: string }).nomEtiquette)).toEqual(['Statut · Vendre'])
  })

  it('(b) échanger avec un ami reçoit aussi « #À échanger <nom> » (trim), pas si l’ami est vide', () => {
    const lot = construireLot(coll(carte('a', { statut: 'echanger', ami: '  Léa ' }), carte('b', { statut: 'echanger', ami: '   ' })), registre(), config(), TOUS)
    const noms = (id: string) =>
      de(lot.actions, 'pose-etiquette').filter((a) => a.idCarte === id).map((a) => (a as { nomEtiquette: string }).nomEtiquette)
    expect(noms('a')).toEqual(['Statut · Échanger', '#À échanger Léa'])
    expect(noms('b')).toEqual(['Statut · Échanger'])
  })

  it('(c) retire du registre toute étiquette qui n’est plus attendue', () => {
    const r = registre([{ ex: 'ex-a', nom: 'Statut · Vendre' }, { ex: 'ex-a', nom: 'Ami · Léa' }], { 'Statut · Garder': 'e1', 'Statut · Vendre': 'e2', 'Ami · Léa': 'e3' })
    const lot = construireLot(coll(carte('a', { statut: 'garder' })), r, config(), TOUS)
    expect(de(lot.actions, 'retrait-etiquette')).toEqual([
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Statut · Vendre' },
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Ami · Léa' },
    ])
  })

  it('H17 : en-vente remplace « Statut · Vendre » par « Statut · En vente » sur chaque exemplaire', () => {
    const r = registre(
      [{ ex: 'x1', nom: 'Statut · Vendre' }, { ex: 'x2', nom: 'Statut · Vendre' }],
      { 'Statut · Vendre': 'e2', 'Statut · En vente': 'e3' },
    )
    const lot = construireLot(coll(carte('a', { statut: 'en-vente', idsSite: ['x1', 'x2'] })), r, config(), TOUS)
    expect(lot.actions).toEqual([
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'x1', nomEtiquette: 'Statut · Vendre' },
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'x2', nomEtiquette: 'Statut · Vendre' },
      { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x1', nomEtiquette: 'Statut · En vente' },
      { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x2', nomEtiquette: 'Statut · En vente' },
    ])
  })

  it('(d) un couple attendu déjà au registre ne produit aucune action', () => {
    const r = registre([{ ex: 'ex-a', nom: 'Statut · Garder' }], { 'Statut · Garder': 'e1' })
    expect(construireLot(coll(carte('a')), r, config(), TOUS).actions).toEqual([])
  })

  it('(e) aucun retrait pour un couple absent du registre', () => {
    const lot = construireLot(coll(carte('a')), registre([], { 'Statut · Vendre': 'e2' }), config(), TOUS)
    expect(de(lot.actions, 'retrait-etiquette')).toEqual([])
  })

  it('(f) au plus une création par nom, avant la première pose, aucune si le nom est au registre', () => {
    const lot = construireLot(coll(carte('a'), carte('b'), carte('c', { statut: 'vendre' })), registre([], { 'Statut · Vendre': 'e2' }), config(), TOUS)
    const crees = de(lot.actions, 'creation-etiquette').map((a) => (a as { nomEtiquette: string }).nomEtiquette)
    expect(crees).toEqual(['Statut · Garder'])
    const iCreation = lot.actions.findIndex((a) => a.type === 'creation-etiquette')
    const iPose = lot.actions.findIndex((a) => a.type === 'pose-etiquette')
    expect(iCreation).toBeLessThan(iPose)
  })

  it('exemplairesAttendus donne les étiquettes attendues par exemplaire', () => {
    expect(exemplairesAttendus(carte('a', { statut: 'echanger', ami: 'Léa', idsSite: ['x1', 'x2'] }))).toEqual([
      { idExemplaire: 'x1', etiquettes: ['Statut · Échanger', '#À échanger Léa'] },
      { idExemplaire: 'x2', etiquettes: ['Statut · Échanger', '#À échanger Léa'] },
    ])
    expect(exemplairesAttendus(carte('a', { favori: true }))).toEqual([])
    expect(exemplairesAttendus(carte('a', { statut: 'defausser', valeurMarchande: 1 }))).toEqual([])
    expect(exemplairesAttendus(carte('a', { idsSite: null }))).toEqual([])
  })
})

describe('noms d’étiquette (AC8)', () => {
  it('un nom trop long ne produit aucune action et est signalé', () => {
    const lot = construireLot(coll(carte('a', { statut: 'echanger', ami: 'x'.repeat(60) })), registre(), config({ longueurMaxEtiquette: 20 }), TOUS)
    expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'nom-trop-long' }])
    expect(de(lot.actions, 'pose-etiquette').map((a) => (a as { nomEtiquette: string }).nomEtiquette)).toEqual(['Statut · Échanger'])
  })

  it('longueur inconnue (null) : seul le plafond du registre, 200, s’applique', () => {
    const lot = construireLot(coll(carte('a', { statut: 'echanger', ami: 'x'.repeat(150) })), registre(), config({ longueurMaxEtiquette: null }), TOUS)
    expect(lot.ecartees).toEqual([])
    expect(de(lot.actions, 'pose-etiquette')).toHaveLength(2)
  })

  it('un homonyme connu non créé par l’extension est signalé, sans action pour ce nom', () => {
    const lot = construireLot(coll(carte('a')), registre(), config({ nomsExistants: ['Statut · Garder'] }), TOUS)
    expect(lot.actions).toEqual([])
    expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'homonyme' }])
  })

  it('un nom déjà créé par l’extension n’est pas un homonyme', () => {
    const lot = construireLot(coll(carte('a')), registre([], { 'Statut · Garder': 'e1' }), config({ nomsExistants: ['Statut · Garder'] }), TOUS)
    expect(lot.ecartees).toEqual([])
    expect(de(lot.actions, 'pose-etiquette')).toHaveLength(1)
  })
})

describe('défausses (H19, H46)', () => {
  it('une action par exemplaire relié, dans l’ordre de idsSite, au plus la quantité', () => {
    const lot = construireLot(coll(carte('a', { statut: 'defausser', valeurMarchande: 1, quantite: 2, idsSite: ['z', 'y', 'x'] })), registre(), config(), TOUS)
    expect(lot.actions).toEqual([
      { type: 'defausse', idCarte: 'a', idExemplaire: 'z' },
      { type: 'defausse', idCarte: 'a', idExemplaire: 'y' },
    ])
  })

  it('les exemplaires non reliés sont signalés', () => {
    const lot = construireLot(coll(carte('a', { statut: 'defausser', valeurMarchande: 1, quantite: 3, idsSite: ['z'] })), registre(), config(), TOUS)
    expect(de(lot.actions, 'defausse')).toHaveLength(1)
    expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'exemplaires-non-relies' }])
  })

  it('aucun retrait d’étiquette avant défausse (H19)', () => {
    const r = registre([{ ex: 'ex-a', nom: 'Statut · Garder' }], { 'Statut · Garder': 'e1' })
    const lot = construireLot(coll(carte('a', { statut: 'defausser', valeurMarchande: 1 })), r, config(), TOUS)
    expect(lot.actions.map((a) => a.type)).toEqual(['defausse'])
  })
})

describe('plafond de valeur de la défausse (Alexis, 2026-11-11)', () => {
  it.each([[5, true], [1, true], [6, false], [100, false], [null, false]])('valeur %s : défausse envoyée = %s', (valeur, envoyee) => {
    const lot = construireLot(coll(carte('a', { statut: 'defausser', valeurMarchande: valeur })), registre(), config(), TOUS)
    expect(de(lot.actions, 'defausse')).toHaveLength(envoyee ? 1 : 0)
    if (!envoyee) expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'valeur-defausse-elevee' }])
  })
  it('même décidée à la main, une carte trop chère n’est pas défaussée', () => {
    const lot = construireLot(coll(carte('a', { statut: 'defausser', decidePar: 'moi', valeurMarchande: 50 })), registre(), config(), TOUS)
    expect(lot.actions).toEqual([])
  })
})

describe('types non disponibles', () => {
  it('une carte dont l’action n’est pas disponible est listée « action non disponible »', () => {
    const lot = construireLot(coll(carte('a', { statut: 'defausser', valeurMarchande: 1 }), carte('b')), registre(), config(), types())
    expect(lot.actions).toEqual([])
    expect(lot.ecartees.map((e) => [e.idCarte, e.raison])).toEqual([
      ['a', 'action-non-disponible'],
      ['b', 'action-non-disponible'],
    ])
  })

  it('création disponible mais pose non disponible : aucune création', () => {
    const lot = construireLot(coll(carte('a')), registre(), config(), types('creation-etiquette'))
    expect(de(lot.actions, 'creation-etiquette')).toEqual([])
    expect(lot.actions).toEqual([])
    expect(lot.ecartees).toEqual([{ idCarte: 'a', titre: 'Carte a', raison: 'action-non-disponible' }])
  })

  it('génère les types disponibles et signale les autres', () => {
    const r = registre([], { 'Statut · Garder': 'e1' })
    const lot = construireLot(coll(carte('a'), carte('b', { statut: 'defausser', valeurMarchande: 1 })), r, config(), types('pose-etiquette'))
    expect(lot.actions.map((a) => a.type)).toEqual(['pose-etiquette'])
    expect(lot.ecartees).toEqual([{ idCarte: 'b', titre: 'Carte b', raison: 'action-non-disponible' }])
  })
})

describe('ordre H9', () => {
  it('créations, retraits, poses, enchères, défausses ; id croissant dans un groupe', () => {
    const r = registre([{ ex: 'ex-b', nom: 'Statut · Vendre' }], { 'Statut · Vendre': 'e2' })
    const lot = construireLot(
      coll(
        carte('d', { statut: 'defausser', valeurMarchande: 1, quantite: 2, idsSite: ['d2', 'd1'] }),
        carte('c'),
        carte('b', { statut: 'garder' }),
        carte('a', { statut: 'garder', idsSite: ['a2', 'a1'] }),
      ),
      r,
      config(),
      TOUS,
    )
    expect(lot.actions.map((a) => a.type)).toEqual([
      'creation-etiquette',
      'retrait-etiquette',
      'pose-etiquette',
      'pose-etiquette',
      'pose-etiquette',
      'pose-etiquette',
      'defausse',
      'defausse',
    ])
    const poses = de(lot.actions, 'pose-etiquette').map((a) => (a as { idExemplaire: string }).idExemplaire)
    expect(poses).toEqual(['a2', 'a1', 'ex-b', 'ex-c'])
    expect(de(lot.actions, 'defausse').map((a) => (a as { idExemplaire: string }).idExemplaire)).toEqual(['d2', 'd1'])
  })
})

describe('performance (AC9)', () => {
  it('construit un lot de 5 000 cartes en moins de 500 ms', () => {
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { statut: i % 3 === 0 ? 'defausser' : 'echanger', ami: 'Léa', idsSite: [`s${i}a`, `s${i}b`] }),
    )
    const t0 = performance.now()
    const lot = construireLot(coll(...cartes), registre(), config(), TOUS)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(lot.actions.length).toBeGreaterThan(5000)
  })
})
