import { describe, expect, it } from 'vitest'
import type { Carte } from '../../src/lib/collection'
import {
  doublons,
  plusCheres,
  themesFrequents,
} from '../../src/lib/analyses'
import { compterThemes, themesDeCarte } from '../../src/lib/themes'

// Données fictives uniquement.
const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...extra,
})
const ids = (cartes: readonly Carte[]): string[] => cartes.map((c) => c.id)

describe('doublons', () => {
  it('SC-021 : cartes de quantité > 1, ordre de la collection conservé', () => {
    const r = doublons([carte('a', { quantite: 2 }), carte('b'), carte('c', { quantite: 5 }), carte('d', { quantite: 2 })])
    expect(ids(r)).toEqual(['a', 'c', 'd'])
  })
  it('SC-021 : liste vide exploitable', () => {
    expect(doublons([])).toEqual([])
    expect(doublons([carte('a')])).toEqual([])
  })
})

describe('plusCheres', () => {
  it('SC-021 : 10 au plus, valeur décroissante, valeurs inconnues exclues', () => {
    const cartes = Array.from({ length: 12 }, (_, i) => carte(`c${i}`, { valeurMarchande: i + 1 }))
    cartes.push(carte('sans', { valeurMarchande: null }))
    const r = plusCheres(cartes)
    expect(r).toHaveLength(10)
    expect(ids(r)).toEqual(['c11', 'c10', 'c9', 'c8', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2'])
  })
  it('SC-021 : exactement 10 cartes, puis 9 : pas de bourrage', () => {
    const dix = Array.from({ length: 10 }, (_, i) => carte(`c${i}`, { valeurMarchande: i + 1 }))
    expect(plusCheres(dix)).toHaveLength(10)
    expect(plusCheres(dix.slice(0, 9))).toHaveLength(9)
  })
  it('SC-021 : égalités stables (ordre de la collection)', () => {
    const r = plusCheres([
      carte('a', { valeurMarchande: 5 }),
      carte('b', { valeurMarchande: 9 }),
      carte('c', { valeurMarchande: 5 }),
      carte('d', { valeurMarchande: 5 }),
    ])
    expect(ids(r)).toEqual(['b', 'a', 'c', 'd'])
  })
  it('SC-021 : une valeur 0 est connue ; liste vide exploitable', () => {
    expect(ids(plusCheres([carte('a', { valeurMarchande: 0 })]))).toEqual(['a'])
    expect(plusCheres([])).toEqual([])
    expect(plusCheres([carte('a')])).toEqual([])
  })
  it('SC-021 : ne modifie pas la collection reçue', () => {
    const cartes = [carte('a', { valeurMarchande: 1 }), carte('b', { valeurMarchande: 2 })]
    plusCheres(cartes)
    expect(ids(cartes)).toEqual(['a', 'b'])
  })
})

describe('themesFrequents', () => {
  const descriptions = [
    'homme d’État français',
    'physicienne et chimiste polonaise',
    'sixième planète du Système solaire',
    'espèce d’oiseaux',
    'agrume',
    'volcan au sud-ouest de Tokyo',
    'artiste peintre mexicaine',
    'film réalisé en 1986',
    'compositeur allemand',
    'écrivain français',
    'école de la philosophie indienne',
    'athlète belge',
  ]
  const cartes = descriptions.map((d, i) => carte(`t${i}`, { titre: `Titre fictif ${i}`, description: d }))

  it('SC-021 : 10 thèmes au plus, nombre décroissant, comptes identiques à themesDeCarte', () => {
    const r = themesFrequents(cartes)
    expect(r.length).toBeLessThanOrEqual(10)
    expect(r.length).toBeGreaterThan(0)
    for (let i = 1; i < r.length; i++) expect(r[i - 1]?.nombre).toBeGreaterThanOrEqual(r[i]?.nombre as number)
    const attendu = compterThemes(cartes)
    for (const { theme, nombre } of r) expect(nombre).toBe(attendu[theme])
    // Un thème utilisé par une carte au moins ; jamais de thème à zéro.
    expect(r.every((t) => t.nombre > 0)).toBe(true)
  })

  it('SC-021 : le thème le plus fréquent vient en tête, égalités départagées de façon stable', () => {
    const musique = (n: number) => carte(`m${n}`, { titre: `Musique ${n}`, description: 'compositeur allemand' })
    const r = themesFrequents([...cartes, musique(1), musique(2), musique(3)])
    expect(themesDeCarte(musique(1))).toContain(r[0]?.theme)
    const a = themesFrequents(cartes)
    const b = themesFrequents([...cartes].reverse())
    // Ordre des égalités indépendant de l’ordre des cartes : tri secondaire sur l’identifiant du thème.
    expect(b.map((t) => t.theme)).toEqual(a.map((t) => t.theme))
  })

  it('SC-021 : liste vide exploitable', () => {
    expect(themesFrequents([])).toEqual([])
  })
})
