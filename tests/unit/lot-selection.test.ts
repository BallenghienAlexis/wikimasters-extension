import { describe, expect, it } from 'vitest'
import type { Action, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { construireLot, type Config, type SelectionLot } from '../../src/lib/lot'
import { preferencesParDefaut } from '../../src/lib/tri'
import { registreVide } from '../../src/lib/registre'
import { choixInitial, conseilLancement, estEtiquetteAVendre, precocher, versSelection } from '../../src/lib/selectionLot'

const TOUS: TypesDisponibles = new Set<TypeAction>(TYPES_ACTION)
const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }
const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id, ...CHIEN, rarete: 'commune', quantite: 1, url: null, favori: false,
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

  it('écarte une carte « à classer » : ni vente, ni défausse', () => {
    const sansTheme = { titre: 'Zzz', description: '' }
    const l = lot([carte('a', { ...sansTheme, valeurMarchande: 90, prixCible: 10 }), carte('b', { ...sansTheme, valeurMarchande: 1 }), carte('c', { etiquettesSite: ['#À classer'], valeurMarchande: 1 })], { vendre: ['a'], defausser: { b: 1, c: 1 } })
    expect(de(l.actions, 'enchere')).toHaveLength(0)
    expect(de(l.actions, 'defausse')).toHaveLength(0)
    expect(l.ecartees.filter((e) => e.raison === 'a-classer')).toHaveLength(3)
  })

  it('ne pose aucune étiquette d’échange sur une carte « à classer »', () => {
    const l = lot([carte('a', { titre: 'Zzz', description: '', ami: 'Zoé' })], aucune)
    expect(l.actions.some((x) => 'nomEtiquette' in x && x.nomEtiquette.startsWith('#À échanger'))).toBe(false)
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
  it('reconnaît « Statut · Vendre » et « À vendre », pas les autres statuts', () => {
    expect(estEtiquetteAVendre('Statut · Vendre')).toBe(true)
    expect(estEtiquetteAVendre('#À vendre')).toBe(true)
    for (const nom of ['Statut · En vente', 'Statut · Échanger', 'Statut · Garder', 'Vendre']) expect(estEtiquetteAVendre(nom)).toBe(false)
  })

  it('préchoisit la vente, ignore favoris et cartes non reliées, jamais de défausse', () => {
    const cartes = [
      carte('a', { etiquettesSite: ['Statut · Vendre'] }),
      carte('b', { etiquettesSite: ['#Défausse'], quantite: 2 }),
      carte('c', { etiquettesSite: ['Statut · Vendre'], favori: true }),
      carte('d', { etiquettesSite: ['Statut · Vendre'], idsSite: null }),
      carte('e', { etiquettesSite: ['Statut · En vente'] }),
    ]
    const choix = choixInitial(cartes)
    expect([...choix.keys()]).toEqual(['a'])
    expect(versSelection(cartes, choix)).toEqual({ vendre: ['a'], defausser: {} })
  })
})

describe('pré-coche selon mes thèmes, mes amis et le plafond', () => {
  const prefs = preferencesParDefaut()
  const zzz = {}

  it('valeur au plafond ou en dessous : défausse ; au-dessus : mise aux enchères ; inconnue : rien', () => {
    const cartes = [carte('a', { ...zzz, valeurMarchande: 5 }), carte('b', { ...zzz, valeurMarchande: 6 }), carte('c', { ...zzz, valeurMarchande: null })]
    const choix = precocher(cartes, prefs, new Map())
    expect(choix.get('a')?.choix).toBe('defausser')
    expect(choix.get('b')?.choix).toBe('vendre')
    expect(choix.has('c')).toBe(false)
  })

  it('jamais une carte « à classer »', () => {
    expect(precocher([carte('a', { titre: 'Zzz', description: '', valeurMarchande: 1 })], prefs, new Map()).size).toBe(0)
  })

  it('ni favori, ni carte d’un ami, ni thème gardé', () => {
    const cartes = [carte('f', { ...zzz, favori: true, valeurMarchande: 1 }), carte('g', { ...zzz, ami: 'Zoé', valeurMarchande: 1 }), carte('h', { ...zzz, valeurMarchande: 1 })]
    expect([...precocher(cartes, prefs, new Map()).keys()]).toEqual(['h'])
    expect(precocher(cartes, { ...prefs, mesThemes: ['chien'] }, new Map()).size).toBe(0)
  })

  it('ne remplace jamais une coche existante', () => {
    const cartes = [carte('a', { ...zzz, valeurMarchande: 1 })]
    const choix = precocher(cartes, prefs, new Map([['a', { choix: 'vendre' as const, exemplaires: 1 }]]))
    expect(choix.get('a')?.choix).toBe('vendre')
  })
})

describe('conseil de lancement', () => {
  const heureForte = new Date(2026, 10, 16, 20).getTime() // lundi 20 h : créneau par défaut
  const heureLibre = new Date(2026, 10, 16, 15).getTime()
  it('chères en heure forte, moins chères en temps libre', () => {
    expect(conseilLancement(300, heureForte, [])).toBe('heure forte : bon moment')
    expect(conseilLancement(300, heureLibre, [])).toBe('carte chère : attendre une heure forte')
    expect(conseilLancement(50, heureLibre, [])).toBe('temps libre : bon moment')
    expect(conseilLancement(50, heureForte, [])).toContain('réserver')
    expect(conseilLancement(null, heureForte, [])).toBe('valeur inconnue')
  })
})
