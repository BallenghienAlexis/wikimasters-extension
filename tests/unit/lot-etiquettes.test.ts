import { meilleureDuree } from './duree'
import { describe, expect, it } from 'vitest'
import type { Action, Registre, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { construireLot, etiquettesDeCarte, exemplairesAttendus, type Config } from '../../src/lib/lot'
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
const config = (extra: Partial<Config> = {}): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], ...extra })
const registre = (couples: Registre['couples'] = [], etiquettes: Registre['etiquettes'] = {}): Registre => ({ ...registreVide(), couples, etiquettes })
const nomsDe = (actions: Action[], type: TypeAction, id?: string): string[] =>
  actions.filter((a) => a.type === type && (id === undefined || a.idCarte === id)).map((a) => (a as { nomEtiquette: string }).nomEtiquette)

const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }
const AMIS = [
  { nom: 'Léa', themes: ['animaux'] },
  { nom: 'Hugo', themes: ['animaux', 'pont'] },
]
const attendues = (c: Carte, cfg: Config = config()): string[] => exemplairesAttendus(c, cfg)[0]?.etiquettes ?? []

describe('étiquettes attendues (SC-008)', () => {

  it('toute carte reliée, favori ou non, avec ou sans thème reconnu, a au moins une étiquette de thème', () => {
    for (const favori of [false, true]) {
      for (const extra of [CHIEN, { titre: 'Zzz', description: '' }]) {
        const noms = attendues(carte('a', { ...extra, favori }), config({ amis: AMIS, limiteParExemplaire: 1 }))
        expect(noms.some((n) => !n.startsWith('#À échanger')), `${favori}`).toBe(true)
      }
    }
  })

  it('un nom de thème écarté par la limite de noms du compte laisse la carte signalée « sans-etiquette-theme »', () => {
    const lot = construireLot(coll(carte('a', CHIEN)), registre([], { '#W': 'e1', '#X': 'e2' }), config({ limiteNoms: 2 }), TOUS)
    expect(lot.ecartees).toContainEqual({ idCarte: 'a', titre: 'Berger allemand', raison: 'sans-etiquette-theme' })
  })

  it('un exemplaire par identifiant relié, chacun avec les mêmes étiquettes', () => {
    const r = exemplairesAttendus(carte('a', { ...CHIEN, idsSite: ['x1', 'x2'] }), config())
    expect(r.map((e) => e.idExemplaire)).toEqual(['x1', 'x2'])
    expect(r[0]?.etiquettes).toEqual(r[1]?.etiquettes)
  })
})

describe('étiquettes d’échange (SC-021, SC-025)', () => {
  const ech = (extra: Partial<Carte> = {}) => carte('a', { ...CHIEN, ...extra })

  it('ignore les noms vides et les doublons de la liste d’amis', () => {
    const amis = [{ nom: '  ', themes: ['animaux'] }, { nom: 'Léa', themes: ['animaux'] }, { nom: 'Léa', themes: ['chien'] }]
    expect(attendues(ech({ ami: '   ' }), config({ amis })).filter((n) => n.startsWith('#À'))).toEqual(['#À échanger Léa'])
  })

  it('Benji (barrage, tibet) et Anna (ukraine) : étiquettes d’échange (SC-025)', () => {
    const amis = [{ nom: 'Benji', themes: ['barrage', 'tibet'] }, { nom: 'Anna', themes: ['ukraine'] }]
    const b = carte('b', { titre: 'Barrage hydroélectrique', description: 'centrale', })
    const t = carte('t', { titre: 'Lhassa', description: 'capitale du Tibet', })
    const u = carte('u', { titre: 'Kiev', description: 'capitale de l’Ukraine', })
    expect(attendues(b, config({ amis }))).toContain('#À échanger Benji')
    expect(attendues(t, config({ amis }))).toContain('#À échanger Benji')
    expect(attendues(u, config({ amis }))).toContain('#À échanger Anna')
    expect(attendues(u, config({ amis }))).not.toContain('#À échanger Benji')
  })
})

describe('homonymes et longueur (SC-009, SC-021)', () => {
  it('un thème homonyme d’une étiquette du joueur n’est ni créé ni posé', () => {
    const lot = construireLot(coll(carte('a', CHIEN)), registre(), config({ nomsExistants: ['#Chien'] }), TOUS)
    expect(nomsDe(lot.actions, 'creation-etiquette')).not.toContain('#Chien')
    expect(nomsDe(lot.actions, 'pose-etiquette')).not.toContain('#Chien')
    expect(lot.ecartees).toContainEqual({ idCarte: 'a', titre: 'Berger allemand', raison: 'homonyme' })
    expect(lot.nonPosees).toContainEqual({ idCarte: 'a', titre: 'Berger allemand', nomEtiquette: '#Chien', raison: 'homonyme' })
  })

  it('un homonyme d’échange est écarté de la même façon', () => {
    const c = carte('a', { ...CHIEN, })
    const lot = construireLot(coll(c), registre(), config({ amis: AMIS, nomsExistants: ['#À échanger Léa'] }), TOUS)
    expect(nomsDe(lot.actions, 'pose-etiquette')).not.toContain('#À échanger Léa')
    expect(nomsDe(lot.actions, 'pose-etiquette')).toContain('#À échanger Hugo')
  })

})

describe('corrections de revue (SC-010, SC-021)', () => {
  it('limite par exemplaire basse : les échanges retirés sont signalés', () => {
    const lot = construireLot(coll(carte('a', { ...CHIEN, })), registre(), config({ amis: AMIS, limiteParExemplaire: 1 }), TOUS)
    const noms = lot.nonPosees.map((n) => n.nomEtiquette)
    expect(noms).toContain('#À échanger Léa')
    expect(noms).toContain('#À échanger Hugo')
    expect(lot.nonPosees.every((n) => n.raison === 'au-dela-limite')).toBe(true)
  })

  it('limite à 0 : au moins le thème le plus précis reste posé', () => {
    expect(attendues(carte('a', CHIEN), config({ limiteParExemplaire: 0 }))).toEqual(['#Chien'])
  })

  it('l’ami de la carte et l’ami de la liste ne diffèrent pas par la casse', () => {
    const noms = attendues(carte('a', { ...CHIEN, ami: 'léa' }), config({ amis: AMIS }))
    expect(noms.filter((n) => n.startsWith('#À échanger'))).toEqual(['#À échanger léa', '#À échanger Hugo'])
  })

  it('performance avec limites connues : moins de 500 ms', () => {
    const themes = ['animaux', 'pont', 'chien', 'chat', 'volcan', 'lac', 'tunnel', 'cheval', 'ile', 'ski']
    const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami ${i}`, themes }))
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { titre: `Carte ${i}`, description: i % 2 ? 'race de chien' : 'pont sur un lac', }),
    )
    const cfg = config({ amis, limiteParExemplaire: 2, limiteNoms: 3 })
    expect(meilleureDuree(() => void construireLot(coll(...cartes), registre(), cfg, TOUS))).toBeLessThan(500)
  })
})

describe('retraits (SC-011, SC-022)', () => {
  it('ne retire jamais une étiquette absente du registre', () => {
    expect(nomsDe(construireLot(coll(carte('a')), registre(), config(), TOUS).actions, 'retrait-etiquette')).toEqual([])
  })

})

describe('performance (SC-017)', () => {
  it('construit le lot de 5 000 cartes, 20 amis × 10 thèmes, en moins de 500 ms', () => {
    const themes = ['animaux', 'pont', 'chien', 'chat', 'volcan', 'lac', 'tunnel', 'cheval', 'ile', 'ski']
    const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami ${i}`, themes }))
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { titre: `Carte ${i}`, description: i % 2 ? 'race de chien' : 'pont sur un lac', }),
    )
    expect(meilleureDuree(() => void construireLot(coll(...cartes), registre(), config({ amis }), TOUS))).toBeLessThan(500)
  })
})

describe('mémorisation des étiquettes par carte (T-903)', () => {
  it('même carte et mêmes réglages : même résultat ; amis ou limite différents : recalcul', () => {
    const c = carte('a', { ...CHIEN, })
    const amis = [{ nom: 'Léa', themes: ['animaux'] }]
    const cfg = { amis, limiteParExemplaire: null }
    expect(etiquettesDeCarte(c, cfg)).toBe(etiquettesDeCarte(c, cfg))
    const autres = etiquettesDeCarte(c, { amis: [{ nom: 'Hugo', themes: ['animaux'] }], limiteParExemplaire: null })
    expect(autres.retenues).toContain('#À échanger Hugo')
    expect(autres.retenues).not.toContain('#À échanger Léa')
    expect(etiquettesDeCarte(c, { amis, limiteParExemplaire: 1 }).retenues).toEqual(['#Chien'])
  })

})
