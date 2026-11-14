import { describe, expect, it } from 'vitest'
import type { Action, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { ETIQUETTE_A_CLASSER, construireLot, type Config } from '../../src/lib/lot'
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
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
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
// Les cartes de ces tests n’ont aucun thème : elles reçoivent aussi l’étiquette de repli, vérifiée à part.

describe('garde-fous (étiquettes du site = vérité, 2026-11-14)', () => {
  it('une carte sans thème reconnu reçoit « #À classer » sur chaque exemplaire relié, favori compris', () => {
    for (const favori of [false, true]) {
      const lot = construireLot(coll(carte('a', { favori, idsSite: ['x1', 'x2'], quantite: 2 })), registre(), config(), TOUS)
      expect(lot.actions).toEqual([
        { type: 'creation-etiquette', idCarte: 'a', nomEtiquette: ETIQUETTE_A_CLASSER },
        { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x1', nomEtiquette: ETIQUETTE_A_CLASSER },
        { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x2', nomEtiquette: ETIQUETTE_A_CLASSER },
      ])
    }
  })

  it('le lot ne contient jamais d’enchère ni de défausse, quelle que soit la valeur', () => {
    const cartes = [carte('a', { valeurMarchande: 1 }), carte('b', { valeurMarchande: 500, prixCible: 20 }), carte('c', { favori: true })]
    const lot = construireLot(coll(...cartes), registre(), config(), TOUS)
    expect(lot.actions.filter((a) => a.type === 'enchere' || a.type === 'defausse')).toEqual([])
  })

  it('un favori ne reçoit jamais d’étiquette d’échange, une autre carte oui', () => {
    const amis = [{ nom: 'Léa', themes: ['animaux'] }]
    const animal = { titre: 'Loutre', description: 'espèce de mammifères' }
    const favori = construireLot(coll(carte('a', { ...animal, favori: true })), registre(), config({ amis }), TOUS)
    const autre = construireLot(coll(carte('b', animal)), registre(), config({ amis }), TOUS)
    const noms = (a: Action[]): string[] => a.flatMap((x) => ('nomEtiquette' in x ? [x.nomEtiquette] : []))
    expect(noms(favori.actions).some((n) => n.startsWith('#À échanger'))).toBe(false)
    expect(noms(autre.actions)).toContain('#À échanger Léa')
  })

  it('les anciennes étiquettes « Statut · … » de l’extension sont retirées, une seule fois par exemplaire', () => {
    const r = registre([{ ex: 'ex-a', nom: 'Statut · Garder' }], { 'Statut · Garder': 'e1' })
    const lot = construireLot(coll(carte('a')), r, config(), TOUS)
    expect(de(lot.actions, 'retrait-etiquette')).toEqual([
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Statut · Garder' },
    ])
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

  it('(c) retire du registre toute étiquette qui n’est plus attendue (anciens Statut et Ami)', () => {
    const r = registre([{ ex: 'ex-a', nom: 'Statut · Vendre' }, { ex: 'ex-a', nom: 'Ami · Léa' }], { 'Statut · Garder': 'e1', 'Statut · Vendre': 'e2', 'Ami · Léa': 'e3' })
    const lot = construireLot(coll(carte('a', { })), r, config(), TOUS)
    expect(de(lot.actions, 'retrait-etiquette')).toEqual([
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Statut · Vendre' },
      { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: 'Ami · Léa' },
    ])
  })

  it('(e) aucun retrait pour un couple absent du registre', () => {
    const lot = construireLot(coll(carte('a')), registre([], { 'Statut · Vendre': 'e2' }), config(), TOUS)
    expect(de(lot.actions, 'retrait-etiquette')).toEqual([])
  })

})

describe('types non disponibles', () => {
  it('une carte dont l’action n’est pas disponible est listée « action non disponible »', () => {
    const lot = construireLot(coll(carte('a'), carte('b')), registre(), config(), types())
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

})

describe('performance (AC9)', () => {
  it('construit un lot de 5 000 cartes en moins de 500 ms', () => {
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { ami: 'Léa', idsSite: [`s${i}a`, `s${i}b`] }),
    )
    const t0 = performance.now()
    const lot = construireLot(coll(...cartes), registre(), config(), TOUS)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(lot.actions.length).toBeGreaterThan(5000)
  })
})
