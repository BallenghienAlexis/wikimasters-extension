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
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
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
  it('donne Statut puis les thèmes, du plus précis au plus général, sans #Autres', () => {
    expect(attendues(carte('a', CHIEN))).toEqual(['Statut · Garder', '#Chien', '#Animaux', '#Nature'])
    expect(attendues(carte('a', { titre: 'Carte', description: 'agrume' }))).toEqual(['Statut · Garder', '#Fruit', '#Gastronomie'])
    expect(attendues(carte('a'))).toEqual(['Statut · Garder'])
  })

  it('ne dépend pas des préférences pour les thèmes', () => {
    expect(attendues(carte('a', CHIEN), config({ amis: AMIS }))).toEqual(attendues(carte('a', CHIEN)))
  })

  it.each(['garder', 'echanger', 'vendre'] as const)('statut %s : étiqueté', (statut) => {
    expect(attendues(carte('a', { ...CHIEN, statut }))).toContain('#Chien')
  })

  it('en vente sur le site : aucune étiquette attendue, et aucune place prise dans la limite de noms', () => {
    expect(attendues(carte('a', { ...CHIEN, statut: 'en-vente' }))).toEqual([])
    const lot = construireLot(coll(carte('a', { ...CHIEN, statut: 'en-vente' }), carte('b', { ...CHIEN, id: 'b', statut: 'garder', idsSite: ['ex-b'] })), registre(), config({ limiteNoms: 4 }), TOUS)
    expect(lot.actions.every((a) => a.idCarte === 'b')).toBe(true)
    expect(lot.actions.length).toBeGreaterThan(0)
  })

  it('favori, à trier et à défausser : aucune étiquette ni action de thème ou d’échange', () => {
    for (const extra of [{ favori: true }, { statut: 'a-trier' as const }, { statut: 'defausser' as const }]) {
      const c = carte('a', { ...CHIEN, ...extra })
      expect(exemplairesAttendus(c, config({ amis: AMIS }))).toEqual([])
    }
    const lot = construireLot(coll(carte('a', { ...CHIEN, favori: true })), registre(), config({ amis: AMIS }), TOUS)
    expect(lot.actions).toEqual([])
  })

  it('un exemplaire par identifiant relié, chacun avec les mêmes étiquettes', () => {
    const r = exemplairesAttendus(carte('a', { ...CHIEN, idsSite: ['x1', 'x2'] }), config())
    expect(r.map((e) => e.idExemplaire)).toEqual(['x1', 'x2'])
    expect(r[0]?.etiquettes).toEqual(r[1]?.etiquettes)
  })
})

describe('étiquettes d’échange (SC-021, SC-025)', () => {
  const ech = (extra: Partial<Carte> = {}) => carte('a', { ...CHIEN, statut: 'echanger', ...extra })

  it('Léa et Hugo suivent animaux : deux étiquettes, entre Statut et les thèmes', () => {
    expect(attendues(ech(), config({ amis: AMIS }))).toEqual([
      'Statut · Échanger', '#À échanger Léa', '#À échanger Hugo', '#Chien', '#Animaux', '#Nature',
    ])
  })

  it('carte.ami passe en premier, sans espaces, sans doublon', () => {
    expect(attendues(ech({ ami: '  Hugo ' }), config({ amis: AMIS })).slice(0, 3)).toEqual(['Statut · Échanger', '#À échanger Hugo', '#À échanger Léa'])
  })

  it('un ami saisi à la main sans thème suivi : une seule étiquette d’échange', () => {
    expect(attendues(ech({ ami: 'Zoé' }), config({ amis: [{ nom: 'Léa', themes: ['pont'] }] }))).toEqual([
      'Statut · Échanger', '#À échanger Zoé', '#Chien', '#Animaux', '#Nature',
    ])
  })

  it('ignore les noms vides et les doublons de la liste d’amis', () => {
    const amis = [{ nom: '  ', themes: ['animaux'] }, { nom: 'Léa', themes: ['animaux'] }, { nom: 'Léa', themes: ['chien'] }]
    expect(attendues(ech({ ami: '   ' }), config({ amis })).filter((n) => n.startsWith('#À'))).toEqual(['#À échanger Léa'])
  })

  it('aucune étiquette d’échange pour garder, vendre ou en-vente', () => {
    for (const statut of ['garder', 'vendre', 'en-vente'] as const) {
      const noms = attendues(ech({ statut, ami: 'Léa' }), config({ amis: AMIS }))
      expect(noms.some((n) => n.startsWith('#À échanger'))).toBe(false)
    }
  })

  it('une carte échanger sans ami concerné ne porte que Statut et ses thèmes (H16)', () => {
    expect(attendues(ech(), config({ amis: [{ nom: 'Léa', themes: ['pont'] }] }))).toEqual(['Statut · Échanger', '#Chien', '#Animaux', '#Nature'])
  })

  it('Benji (barrage, tibet) et Anna (ukraine) : étiquettes d’échange (SC-025)', () => {
    const amis = [{ nom: 'Benji', themes: ['barrage', 'tibet'] }, { nom: 'Anna', themes: ['ukraine'] }]
    const b = carte('b', { titre: 'Barrage hydroélectrique', description: 'centrale', statut: 'echanger' })
    const t = carte('t', { titre: 'Lhassa', description: 'capitale du Tibet', statut: 'echanger' })
    const u = carte('u', { titre: 'Kiev', description: 'capitale de l’Ukraine', statut: 'echanger' })
    expect(attendues(b, config({ amis }))).toContain('#À échanger Benji')
    expect(attendues(t, config({ amis }))).toContain('#À échanger Benji')
    expect(attendues(u, config({ amis }))).toContain('#À échanger Anna')
    expect(attendues(u, config({ amis }))).not.toContain('#À échanger Benji')
  })
})

describe('lot : créations, poses, ordre (SC-008)', () => {
  it('pose Statut, échanges puis thèmes sur chaque exemplaire, avec une création par nom', () => {
    const lot = construireLot(coll(carte('a', { ...CHIEN, statut: 'echanger', idsSite: ['x1', 'x2'] })), registre(), config({ amis: AMIS }), TOUS)
    expect(nomsDe(lot.actions, 'creation-etiquette')).toEqual([
      'Statut · Échanger', '#À échanger Léa', '#À échanger Hugo', '#Chien', '#Animaux', '#Nature',
    ])
    const poses = lot.actions.filter((a) => a.type === 'pose-etiquette')
    expect(poses).toHaveLength(12)
    const types = lot.actions.map((a) => a.type)
    expect(types.indexOf('pose-etiquette')).toBeGreaterThan(types.lastIndexOf('creation-etiquette'))
  })

  it('aucune action pour un couple déjà au registre', () => {
    const noms = ['Statut · Garder', '#Chien', '#Animaux', '#Nature']
    const r = registre(noms.map((nom) => ({ ex: 'ex-a', nom })), Object.fromEntries(noms.map((n, i) => [n, `e${i}`])))
    expect(construireLot(coll(carte('a', CHIEN)), r, config(), TOUS).actions).toEqual([])
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
    const c = carte('a', { ...CHIEN, statut: 'echanger' })
    const lot = construireLot(coll(c), registre(), config({ amis: AMIS, nomsExistants: ['#À échanger Léa'] }), TOUS)
    expect(nomsDe(lot.actions, 'pose-etiquette')).not.toContain('#À échanger Léa')
    expect(nomsDe(lot.actions, 'pose-etiquette')).toContain('#À échanger Hugo')
  })

  it('un nom d’ami trop long est écarté, jamais tronqué', () => {
    const c = carte('a', { statut: 'echanger', ami: 'x'.repeat(60) })
    const lot = construireLot(coll(c), registre(), config({ longueurMaxEtiquette: 32 }), TOUS)
    expect(nomsDe(lot.actions, 'pose-etiquette')).toEqual(['Statut · Échanger'])
    expect(lot.ecartees).toContainEqual({ idCarte: 'a', titre: 'Carte a', raison: 'nom-trop-long' })
    expect(lot.nonPosees.map((n) => n.raison)).toEqual(['nom-trop-long'])
  })
})

describe('limites du site (SC-010)', () => {
  it('limite par exemplaire : Statut et échanges d’abord, les thèmes les plus précis ensuite', () => {
    const c = carte('a', { ...CHIEN, statut: 'echanger' })
    const cfg = config({ amis: AMIS, limiteParExemplaire: 4 })
    expect(attendues(c, cfg)).toEqual(['Statut · Échanger', '#À échanger Léa', '#À échanger Hugo', '#Chien'])
    const lot = construireLot(coll(c), registre(), cfg, TOUS)
    expect(lot.nonPosees.filter((n) => n.raison === 'au-dela-limite').map((n) => n.nomEtiquette)).toEqual(['#Animaux', '#Nature'])
  })

  it('une limite trop basse n’écarte jamais Statut ni les échanges au profit d’un thème', () => {
    const c = carte('a', { ...CHIEN, statut: 'echanger' })
    expect(attendues(c, config({ amis: AMIS, limiteParExemplaire: 1 }))).toEqual(['Statut · Échanger'])
  })

  it('limite par compte : les noms du registre passent d’abord, puis Statut et échanges, puis les thèmes les plus fréquents', () => {
    const cartes = [
      carte('a', { titre: 'Berger', description: 'race de chien' }),
      carte('b', { titre: 'Caniche', description: 'chiens de compagnie' }),
      carte('c', { titre: 'Pont du Gard', description: 'aqueduc romain, pont' }),
    ]
    const r = registre([{ ex: 'ex-c', nom: '#Pont' }], { '#Pont': 'e1' })
    const lot = construireLot(coll(...cartes), r, config({ limiteNoms: 4 }), TOUS)
    const crees = nomsDe(lot.actions, 'creation-etiquette')
    const tous = new Set([...Object.keys(r.etiquettes), ...crees])
    expect(tous.size).toBeLessThanOrEqual(4)
    expect(tous.has('#Pont')).toBe(true)
    expect(tous.has('Statut · Garder')).toBe(true)
    expect(tous.has('#Chien')).toBe(true)
    expect(lot.nonPosees.some((n) => n.raison === 'au-dela-limite')).toBe(true)
  })

  it('limite à null ou absente : rien n’est écarté', () => {
    const cfg = config({ limiteParExemplaire: null, limiteNoms: null })
    const lot = construireLot(coll(carte('a', CHIEN)), registre(), cfg, TOUS)
    expect(lot.nonPosees).toEqual([])
    expect(attendues(carte('a', CHIEN), cfg)).toHaveLength(4)
  })
})

describe('corrections de revue (SC-010, SC-021)', () => {
  it('limite par exemplaire basse : les échanges retirés sont signalés', () => {
    const lot = construireLot(coll(carte('a', { ...CHIEN, statut: 'echanger' })), registre(), config({ amis: AMIS, limiteParExemplaire: 1 }), TOUS)
    const noms = lot.nonPosees.map((n) => n.nomEtiquette)
    expect(noms).toContain('#À échanger Léa')
    expect(noms).toContain('#À échanger Hugo')
    expect(lot.nonPosees.every((n) => n.raison === 'au-dela-limite')).toBe(true)
  })

  it('limite à 0 : « Statut · … » reste posé', () => {
    expect(attendues(carte('a', CHIEN), config({ limiteParExemplaire: 0 }))).toEqual(['Statut · Garder'])
  })

  it('les noms du registre plus attendus comptent dans la limite de noms', () => {
    const reg = registre(
      [{ ex: 'ex-z', nom: '#Vieux' }],
      { 'Ami · Léa': 'e1', '#Vieux': 'e2', '#Autre': 'e3' },
    )
    const lot = construireLot(coll(carte('a', CHIEN)), reg, config({ limiteNoms: 3 }), TOUS)
    expect(nomsDe(lot.actions, 'creation-etiquette')).toEqual([])
    expect(nomsDe(lot.actions, 'pose-etiquette')).toEqual([])
    expect(lot.nonPosees.map((n) => n.nomEtiquette)).toContain('Statut · Garder')
  })

  it('l’ami de la carte et l’ami de la liste ne diffèrent pas par la casse', () => {
    const noms = attendues(carte('a', { ...CHIEN, statut: 'echanger', ami: 'léa' }), config({ amis: AMIS }))
    expect(noms.filter((n) => n.startsWith('#À échanger'))).toEqual(['#À échanger léa', '#À échanger Hugo'])
  })

  it('un nom de plus de 200 caractères est écarté même sans longueur connue', () => {
    const lot = construireLot(coll(carte('a', { statut: 'echanger', ami: 'x'.repeat(250) })), registre(), config({ longueurMaxEtiquette: null }), TOUS)
    expect(lot.nonPosees.some((n) => n.raison === 'nom-trop-long')).toBe(true)
    expect(nomsDe(lot.actions, 'pose-etiquette')).toEqual(['Statut · Échanger'])
  })

  it('performance avec limites connues : moins de 500 ms', () => {
    const themes = ['animaux', 'pont', 'chien', 'chat', 'volcan', 'lac', 'tunnel', 'cheval', 'ile', 'ski']
    const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami ${i}`, themes }))
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { titre: `Carte ${i}`, description: i % 2 ? 'race de chien' : 'pont sur un lac', statut: 'echanger' }),
    )
    const cfg = config({ amis, limiteParExemplaire: 2, limiteNoms: 3 })
    expect(meilleureDuree(() => void construireLot(coll(...cartes), registre(), cfg, TOUS))).toBeLessThan(500)
  })
})

describe('retraits (SC-011, SC-022)', () => {
  const r = (noms: string[]): Registre => registre(noms.map((nom) => ({ ex: 'ex-a', nom })), Object.fromEntries(noms.map((n, i) => [n, `e${i}`])))

  it('retire un thème qui n’est plus détecté', () => {
    const lot = construireLot(coll(carte('a')), r(['Statut · Garder', '#Chien']), config(), TOUS)
    expect(nomsDe(lot.actions, 'retrait-etiquette')).toEqual(['#Chien'])
  })

  it('retire « #À échanger Léa » quand Léa ne suit plus aucun thème de la carte, ou n’est plus dans la liste', () => {
    const c = carte('a', { ...CHIEN, statut: 'echanger' })
    const base = ['Statut · Échanger', '#À échanger Léa', '#Chien', '#Animaux', '#Nature']
    const sansTheme = construireLot(coll(c), r(base), config({ amis: [{ nom: 'Léa', themes: ['pont'] }] }), TOUS)
    expect(nomsDe(sansTheme.actions, 'retrait-etiquette')).toEqual(['#À échanger Léa'])
    const retiree = construireLot(coll(c), r(base), config({ amis: [] }), TOUS)
    expect(nomsDe(retiree.actions, 'retrait-etiquette')).toEqual(['#À échanger Léa'])
    const toujours = construireLot(coll(c), r(base), config({ amis: AMIS }), TOUS)
    expect(nomsDe(toujours.actions, 'retrait-etiquette')).toEqual([])
  })

  it('l’ami inscrit sur la carte garde son étiquette même sans thème suivi', () => {
    const c = carte('a', { ...CHIEN, statut: 'echanger', ami: 'Zoé' })
    const lot = construireLot(coll(c), r(['Statut · Échanger', '#À échanger Zoé', '#Chien', '#Animaux', '#Nature']), config(), TOUS)
    expect(lot.actions).toEqual([])
  })

  it('retire « #À échanger Léa » quand la carte passe à garder ou vendre', () => {
    for (const statut of ['garder', 'vendre'] as const) {
      const c = carte('a', { ...CHIEN, statut })
      const lot = construireLot(coll(c), r(['#À échanger Léa']), config({ amis: AMIS }), TOUS)
      expect(nomsDe(lot.actions, 'retrait-etiquette')).toContain('#À échanger Léa')
    }
  })

  it('retire une étiquette « Ami · … » héritée du registre', () => {
    const lot = construireLot(coll(carte('a', { statut: 'echanger', ami: 'Léa' })), r(['Statut · Échanger', 'Ami · Léa']), config(), TOUS)
    expect(nomsDe(lot.actions, 'retrait-etiquette')).toEqual(['Ami · Léa'])
  })

  it('ne retire jamais une étiquette absente du registre', () => {
    expect(nomsDe(construireLot(coll(carte('a')), registre(), config(), TOUS).actions, 'retrait-etiquette')).toEqual([])
  })

  it('favori et à trier : étiquettes obsolètes signalées, aucun retrait ; défausse : aucun retrait', () => {
    const noms = ['Statut · Garder', '#Chien']
    for (const extra of [{ favori: true }, { statut: 'a-trier' as const }]) {
      const lot = construireLot(coll(carte('a', { ...CHIEN, ...extra })), r(noms), config(), TOUS)
      expect(nomsDe(lot.actions, 'retrait-etiquette')).toEqual([])
      expect(lot.obsoletes.map((o) => o.nomEtiquette)).toEqual(noms)
    }
    const d = construireLot(coll(carte('a', { ...CHIEN, statut: 'defausser' })), r(noms), config(), TOUS)
    expect(nomsDe(d.actions, 'retrait-etiquette')).toEqual([])
  })
})

describe('performance (SC-017)', () => {
  it('construit le lot de 5 000 cartes, 20 amis × 10 thèmes, en moins de 500 ms', () => {
    const themes = ['animaux', 'pont', 'chien', 'chat', 'volcan', 'lac', 'tunnel', 'cheval', 'ile', 'ski']
    const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami ${i}`, themes }))
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { titre: `Carte ${i}`, description: i % 2 ? 'race de chien' : 'pont sur un lac', statut: 'echanger' }),
    )
    expect(meilleureDuree(() => void construireLot(coll(...cartes), registre(), config({ amis }), TOUS))).toBeLessThan(500)
  })
})

describe('mémorisation des étiquettes par carte (T-903)', () => {
  it('même carte et mêmes réglages : même résultat ; amis ou limite différents : recalcul', () => {
    const c = carte('a', { ...CHIEN, statut: 'echanger' })
    const amis = [{ nom: 'Léa', themes: ['animaux'] }]
    const cfg = { amis, limiteParExemplaire: null }
    expect(etiquettesDeCarte(c, cfg)).toBe(etiquettesDeCarte(c, cfg))
    const autres = etiquettesDeCarte(c, { amis: [{ nom: 'Hugo', themes: ['animaux'] }], limiteParExemplaire: null })
    expect(autres.retenues).toContain('#À échanger Hugo')
    expect(autres.retenues).not.toContain('#À échanger Léa')
    expect(etiquettesDeCarte(c, { amis, limiteParExemplaire: 1 }).retenues).toEqual(['Statut · Échanger'])
  })

  it('une carte modifiée (nouvel objet) est recalculée', () => {
    const c = carte('a', { ...CHIEN, statut: 'garder' })
    const avant = etiquettesDeCarte(c, config())
    const apres = etiquettesDeCarte({ ...c, statut: 'vendre' }, config())
    expect(avant.retenues[0]).toBe('Statut · Garder')
    expect(apres.retenues[0]).toBe('Statut · Vendre')
  })
})
