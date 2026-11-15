import { describe, expect, it } from 'vitest'
import type { Action, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { construireLot, type Config, type SelectionLot } from '../../src/lib/lot'
import { registreVide } from '../../src/lib/registre'
import { choixInitial, estEtiquetteAVendre, estEtiquetteDefausse, versSelection } from '../../src/lib/selectionLot'

const TOUS: TypesDisponibles = new Set<TypeAction>(TYPES_ACTION)
const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: 'commune', description: '', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${id}-1`, `ex-${id}-2`], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: 100, ...extra,
})
const lot = (cartes: Carte[], selection: SelectionLot, extra: Partial<Config> = {}) =>
  construireLot({ ...collectionVide(), cartes }, registreVide(), { maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], lienCardId: true, selection, ...extra }, TOUS)
const de = (a: Action[], t: TypeAction) => a.filter((x) => x.type === t)
const aucune: SelectionLot = { vendre: [], defausser: {} }

describe('sélection manuelle : enchères et défausses (2026-11-14)', () => {
  it('sans sélection, ni enchère ni défausse', () => {
    const l = lot([carte('a')], aucune)
    expect(de(l.actions, 'enchere')).toHaveLength(0)
    expect(de(l.actions, 'defausse')).toHaveLength(0)
  })

  it('met aux enchères les cartes choisies, les plus chères d’abord, un exemplaire chacune', () => {
    const l = lot([carte('a', { valeurMarchande: 40, prixCible: 10 }), carte('b', { valeurMarchande: 90, prixCible: 50 })], { vendre: ['a', 'b'], defausser: {} })
    expect(de(l.actions, 'enchere')).toEqual([
      { type: 'enchere', idCarte: 'b', idExemplaire: 'ex-b-1', prix: 50 },
      { type: 'enchere', idCarte: 'a', idExemplaire: 'ex-a-1', prix: 10 },
    ])
  })

  it('limite aux places libres et écarte le reste', () => {
    const cartes = ['a', 'b', 'c'].map((id, i) => carte(id, { valeurMarchande: 90, prixCible: 10 + i }))
    const l = lot(cartes, { vendre: ['a', 'b', 'c'], defausser: {} }, { maxVentesSimultanees: 2, ventesSite: { enCours: 1, max: 10 } })
    expect(de(l.actions, 'enchere')).toHaveLength(1)
    expect(l.ecartees.filter((e) => e.raison === 'en-attente-place')).toHaveLength(2)
  })

  it('écarte une enchère sans valeur marchande ou dont le prix atteint la valeur', () => {
    const l = lot([carte('a', { valeurMarchande: null }), carte('b', { valeurMarchande: 20, prixCible: 20 })], { vendre: ['a', 'b'], defausser: {} })
    expect(de(l.actions, 'enchere')).toHaveLength(0)
    expect(l.ecartees.map((e) => e.raison).sort()).toEqual(['prix-superieur-valeur', 'valeur-absente'])
  })

  it('défausse le nombre d’exemplaires choisi, sans étiquettes sur la carte', () => {
    const l = lot([carte('a', { valeurMarchande: 3, quantite: 2 })], { vendre: [], defausser: { a: 2 } })
    expect(de(l.actions, 'defausse')).toEqual([
      { type: 'defausse', idCarte: 'a', idExemplaire: 'ex-a-1' },
      { type: 'defausse', idCarte: 'a', idExemplaire: 'ex-a-2' },
    ])
    expect(l.actions.filter((x) => x.type === 'pose-etiquette' || x.type === 'creation-etiquette')).toHaveLength(0)
  })

  it('ne défausse jamais au-dessus du plafond ni sans valeur', () => {
    const l = lot([carte('a', { valeurMarchande: 6 }), carte('b', { valeurMarchande: null })], { vendre: [], defausser: { a: 1, b: 1 } })
    expect(de(l.actions, 'defausse')).toHaveLength(0)
    expect(l.ecartees.filter((e) => e.raison === 'valeur-defausse-elevee')).toHaveLength(2)
    expect(de(lot([carte('a', { valeurMarchande: 6 })], { vendre: [], defausser: { a: 1 } }, { plafondDefausse: 10 }).actions, 'defausse')).toHaveLength(1)
  })

  it('ne touche jamais un favori', () => {
    const l = lot([carte('a', { favori: true, valeurMarchande: 1 })], { vendre: ['a'], defausser: { a: 1 } })
    expect(de(l.actions, 'enchere')).toHaveLength(0)
    expect(de(l.actions, 'defausse')).toHaveLength(0)
    expect(l.ecartees.some((e) => e.raison === 'favori-verrouille')).toBe(true)
  })

  it('une défausse non disponible est écartée', () => {
    const l = construireLot({ ...collectionVide(), cartes: [carte('a', { valeurMarchande: 1 })] }, registreVide(), { maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], selection: { vendre: [], defausser: { a: 1 } } }, new Set<TypeAction>(['pose-etiquette']))
    expect(de(l.actions, 'defausse')).toHaveLength(0)
    expect(l.ecartees.some((e) => e.raison === 'action-non-disponible')).toBe(true)
  })
})

describe('sélection : choix de départ d’après les étiquettes du site', () => {
  it('reconnaît « #À vendre » et « #Défausse » sans tenir compte de la casse, des accents ni du dièse', () => {
    expect(estEtiquetteAVendre('#À vendre')).toBe(true)
    expect(estEtiquetteAVendre('a vendre')).toBe(true)
    expect(estEtiquetteAVendre('Vendre')).toBe(false)
    expect(estEtiquetteDefausse('#Défausse')).toBe(true)
    expect(estEtiquetteDefausse('#À défausser')).toBe(true)
    expect(estEtiquetteDefausse('Défaut')).toBe(false)
  })

  it('préremplit le choix, ignore les favoris et les cartes non reliées', () => {
    const cartes = [
      carte('a', { etiquettesSite: ['#À vendre'] }),
      carte('b', { etiquettesSite: ['#Défausse'], quantite: 2 }),
      carte('c', { etiquettesSite: ['#À vendre'], favori: true }),
      carte('d', { etiquettesSite: ['#À vendre'], idsSite: null }),
    ]
    const choix = choixInitial(cartes)
    expect([...choix.keys()]).toEqual(['a', 'b'])
    expect(versSelection(cartes, choix)).toEqual({ vendre: ['a'], defausser: { b: 2 } })
  })
})
