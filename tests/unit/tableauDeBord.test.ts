import { describe, expect, it } from 'vitest'
import type { Carte, Collection, Statut } from '../../src/lib/collection'
import { etiquettesDeCarte, placesEncheres } from '../../src/lib/lot'
import { calculerTableauDeBord, type ContexteTableauDeBord } from '../../src/lib/tableauDeBord'

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
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...extra,
})
const collection = (cartes: Carte[]): Collection => ({ version: 3, cartes })

const MAINTENANT = 1_800_000_000_000
const MIN = 60_000

const contexte = (extra: Partial<ContexteTableauDeBord> = {}): ContexteTableauDeBord => ({
  maxVentesSimultanees: 5,
  ventesSite: null,
  synchro: { activee: true, etat: 'a-jour', derniereTerminee: MAINTENANT - 12 * MIN },
  prix: {},
  ...extra,
})

const calcul = (cartes: Carte[], ctx: ContexteTableauDeBord = contexte()) =>
  calculerTableauDeBord(collection(cartes), ctx, MAINTENANT)

describe('chiffres clés', () => {
  it('SC-001 : exemplaires = somme des quantités hors en-vente, cartes distinctes, N en vente', () => {
    const t = calcul([
      carte('commune|A', { quantite: 3, statut: 'garder' }),
      carte('rare|B', { quantite: 2, statut: 'vendre' }),
      carte('rare|C', { quantite: 1, statut: 'en-vente' }),
      carte('rare|D', { quantite: 1, statut: 'en-vente' }),
    ])
    expect(t.exemplaires).toBe(5)
    expect(t.distinctes).toBe(2)
    expect(t.enVente).toBe(2)
  })

  it('SC-001 : valeur estimée = somme valeur × quantité des cartes hors en-vente à valeur connue', () => {
    const t = calcul([
      carte('a', { quantite: 2, valeurMarchande: 10, statut: 'garder' }),
      carte('b', { quantite: 3, valeurMarchande: 4, statut: 'vendre' }),
      carte('c', { quantite: 1, valeurMarchande: null }),
      carte('d', { quantite: 1, valeurMarchande: 1000, statut: 'en-vente' }),
    ])
    expect(t.valeur).toBe(32)
  })

  it('SC-001 : part sans prix = % entier des cartes distinctes hors en-vente sans valeur', () => {
    const t = calcul([
      carte('a', { valeurMarchande: 10 }),
      carte('b', { valeurMarchande: null }),
      carte('c', { valeurMarchande: 5 }),
      carte('d', { valeurMarchande: null, statut: 'en-vente' }),
    ])
    expect(t.partSansPrix).toBe(33)
  })

  it('SC-001 : une valeur de 0 est une valeur connue', () => {
    const t = calcul([carte('a', { valeurMarchande: 0 }), carte('b', { valeurMarchande: null })])
    expect(t.valeur).toBe(0)
    expect(t.partSansPrix).toBe(50)
  })

  it('SC-001 : écarts = nombre de cartes renvoyées par calculerEcarts', () => {
    // Carte reliée au site, statut garder, sans aucune étiquette sur le site : étiquettes manquantes.
    const reliee = (id: string) => carte(id, { idsSite: [`ex-${id}`], statut: 'garder', etiquettesSite: [] })
    const t = calcul([reliee('a'), reliee('b'), carte('c', { idsSite: null })])
    expect(t.ecarts).toBe(2)
  })

  it('SC-001 : écarts calculés avec les amis du contexte (étiquette « #À échanger <ami> » attendue, donc 0 écart)', () => {
    const amis = [{ nom: 'Zoé', themes: [] }]
    const base = carte('e', { idsSite: ['ex-e'], statut: 'echanger', ami: 'Zoé' })
    const attendues = etiquettesDeCarte(base, { amis }).retenues
    expect(attendues).toContain('#À échanger Zoé')
    const reliee = { ...base, etiquettesSite: [...attendues] }
    expect(calcul([reliee], contexte({ amis })).ecarts).toBe(0)
    // Sans les amis, l’étiquette d’échange serait vue comme en trop.
    expect(calcul([reliee]).ecarts).toBe(1)
  })

  it('SC-001 : places d’enchères occupées / max via placesEncheres, ventesSite plus contraignant', () => {
    const cartes = [carte('a', { statut: 'en-vente' }), carte('b', { statut: 'en-vente' })]
    expect(calcul(cartes).places).toEqual({ occupees: 2, max: 5 })
    const t = calcul(cartes, contexte({ ventesSite: { enCours: 4, max: 3 } }))
    expect(t.places).toEqual({ occupees: 4, max: 3 })
  })
})

describe('placesEncheres (extraite de lot.ts)', () => {
  it('SC-001 : max = min(config, site), occupées = max(en-vente, enCours du site)', () => {
    expect(placesEncheres({ maxVentesSimultanees: 5, ventesSite: null }, 2)).toEqual({ occupees: 2, max: 5 })
    expect(placesEncheres({ maxVentesSimultanees: 5, ventesSite: { enCours: 1, max: 3 } }, 2)).toEqual({ occupees: 2, max: 3 })
    expect(placesEncheres({ maxVentesSimultanees: 2, ventesSite: { enCours: 4, max: 10 } }, 0)).toEqual({ occupees: 4, max: 2 })
  })
})

describe('répartition par statut', () => {
  const ordre: Statut[] = ['a-trier', 'garder', 'echanger', 'vendre', 'en-vente', 'defausser']

  it('SC-022 : un statut à 0 exemplaire est absent, ordre À trier → Défausser', () => {
    const t = calcul([carte('a', { statut: 'defausser' }), carte('b', { statut: 'garder' }), carte('c', { statut: 'a-trier' })])
    expect(t.repartition.map((s) => s.statut)).toEqual(['a-trier', 'garder', 'defausser'])
    expect(ordre).toContain(t.repartition[0]?.statut)
  })

  it('SC-022 : en-vente exclu des totaux mais présent dans la répartition (H6)', () => {
    const t = calcul([carte('a', { statut: 'garder', quantite: 3 }), carte('b', { statut: 'en-vente', quantite: 1 })])
    expect(t.exemplaires).toBe(3)
    const ev = t.repartition.find((s) => s.statut === 'en-vente')
    expect(ev?.exemplaires).toBe(1)
    expect(t.repartition.find((s) => s.statut === 'garder')?.part).toBe(75)
    expect(ev?.part).toBe(25)
  })

  it('SC-022 : exemplaires et valeur par statut', () => {
    const t = calcul([
      carte('a', { statut: 'vendre', quantite: 2, valeurMarchande: 10 }),
      carte('b', { statut: 'vendre', quantite: 1, valeurMarchande: 5 }),
      carte('c', { statut: 'vendre', quantite: 1, valeurMarchande: null }),
      carte('d', { statut: 'garder', quantite: 1, valeurMarchande: null }),
    ])
    const vendre = t.repartition.find((s) => s.statut === 'vendre')
    expect(vendre?.exemplaires).toBe(4)
    expect(vendre?.valeur).toBe(25)
    // Aucune valeur connue dans ce statut : null, pas 0.
    expect(t.repartition.find((s) => s.statut === 'garder')?.valeur).toBeNull()
  })

  it('SC-022 : 3 titres d’exemple par statut au plus, dans l’ordre de la collection', () => {
    const cartes = ['A', 'B', 'C', 'D', 'E'].map((n) => carte(`rare|${n}`, { titre: `Titre ${n}`, statut: 'garder' }))
    const t = calcul([...cartes, carte('z', { titre: 'Autre', statut: 'vendre' })])
    expect(t.repartition.find((s) => s.statut === 'garder')?.exemples).toEqual(['Titre A', 'Titre B', 'Titre C'])
    expect(t.repartition.find((s) => s.statut === 'vendre')?.exemples).toEqual(['Autre'])
  })

  it('SC-022 : parts par plus forts restes, somme = 100 (3 × 1 sur 3, égalité au premier dans l’ordre)', () => {
    const t = calcul([carte('a', { statut: 'a-trier' }), carte('b', { statut: 'garder' }), carte('c', { statut: 'vendre' })])
    expect(t.repartition.map((s) => s.part)).toEqual([34, 33, 33])
  })

  it('SC-022 : parts exactes quand la division tombe juste', () => {
    const t = calcul([
      carte('a', { statut: 'garder', quantite: 5 }),
      carte('b', { statut: 'vendre', quantite: 3 }),
      carte('c', { statut: 'echanger', quantite: 2 }),
    ])
    expect(Object.fromEntries(t.repartition.map((s) => [s.statut, s.part]))).toEqual({ garder: 50, echanger: 20, vendre: 30 })
  })

  it('SC-022 : la somme des parts vaut toujours 100, jamais de part négative', () => {
    for (const quantites of [[1, 1, 1, 1, 1, 1], [7, 1, 1], [13, 29, 3, 5, 1, 2], [1, 1, 1, 1, 1, 100]]) {
      const cartes = quantites.map((q, i) => carte(`c${i}`, { statut: ordre[i], quantite: q }))
      const t = calcul(cartes)
      expect(t.repartition.reduce((s, x) => s + x.part, 0)).toBe(100)
      expect(t.repartition.every((s) => Number.isInteger(s.part) && s.part >= 0)).toBe(true)
    }
  })
})

describe('santé de la synchro', () => {
  it('SC-001 : pastille selon l’état, âge « il y a 12 min » avec horloge injectée', () => {
    const t = calcul([carte('a')])
    expect(t.sante).toEqual({ pastille: 'a-jour', ageLibelle: 'il y a 12 min' })
  })

  it.each(['a-jour', 'en-cours', 'arretee', 'erreur'] as const)('SC-001 : pastille %s transmise', (etat) => {
    const t = calcul([], contexte({ synchro: { activee: true, etat, derniereTerminee: MAINTENANT - MIN } }))
    expect(t.sante.pastille).toBe(etat)
    expect(t.sante.ageLibelle).toBe('il y a 1 min')
  })

  it('SC-001 : « jamais » sans synchro terminée', () => {
    const t = calcul([], contexte({ synchro: { activee: true, etat: 'a-jour', derniereTerminee: null } }))
    expect(t.sante.ageLibelle).toBe('jamais')
  })

  it('SC-001 : « synchro automatique coupée » quand l’interrupteur est coupé', () => {
    const t = calcul([], contexte({ synchro: { activee: false, etat: 'arretee', derniereTerminee: MAINTENANT - MIN } }))
    expect(t.sante.ageLibelle).toBe('synchro automatique coupée')
  })

  it('SC-001 : moins d’une minute, heures et jours sont lisibles', () => {
    const age = (ms: number) =>
      calcul([], contexte({ synchro: { activee: true, etat: 'a-jour', derniereTerminee: MAINTENANT - ms } })).sante.ageLibelle
    expect(age(20_000)).toBe('à l’instant')
    expect(age(3 * 60 * MIN)).toBe('il y a 3 h')
    expect(age(2 * 24 * 60 * MIN)).toBe('il y a 2 j')
  })
})

describe('fraîcheur des prix', () => {
  it('SC-001 : nombre de relevés, plus récent et plus ancien', () => {
    const t = calcul([carte('a')], contexte({
      prix: {
        a: { valeur: 3, releveLe: MAINTENANT - 5 * MIN },
        b: { valeur: null, releveLe: MAINTENANT - 90 * MIN },
        c: { valeur: 8, releveLe: MAINTENANT - MIN },
      },
    }))
    expect(t.fraicheurPrix).toEqual({ releves: 3, plusRecent: MAINTENANT - MIN, plusAncien: MAINTENANT - 90 * MIN })
  })

  it('SC-001 : aucun relevé : zéro et null, sans NaN', () => {
    expect(calcul([carte('a')]).fraicheurPrix).toEqual({ releves: 0, plusRecent: null, plusAncien: null })
  })
})

describe('cas limites (jamais de NaN)', () => {
  const sansNaN = (v: unknown): boolean =>
    typeof v === 'number'
      ? !Number.isNaN(v)
      : Array.isArray(v)
        ? v.every(sansNaN)
        : v !== null && typeof v === 'object'
          ? Object.values(v).every(sansNaN)
          : true

  it('SC-001 : collection vide', () => {
    const t = calcul([])
    expect(t.exemplaires).toBe(0)
    expect(t.distinctes).toBe(0)
    expect(t.enVente).toBe(0)
    expect(t.valeur).toBeNull()
    expect(t.partSansPrix).toBeNull()
    expect(t.repartition).toEqual([])
    expect(t.ecarts).toBe(0)
    expect(t.places).toEqual({ occupees: 0, max: 5 })
    expect(sansNaN(t)).toBe(true)
  })

  it('SC-001 : cartes toutes sans prix : valeur nulle, part 100 %', () => {
    const t = calcul([carte('a', { quantite: 2 }), carte('b')])
    expect(t.exemplaires).toBe(3)
    expect(t.valeur).toBeNull()
    expect(t.partSansPrix).toBe(100)
    expect(t.repartition[0]?.valeur).toBeNull()
    expect(Number.isNaN(t.partSansPrix)).toBe(false)
  })

  it('SC-001 : seulement des cartes en-vente : 0 exemplaire, valeur et part nulles, répartition = en-vente', () => {
    const t = calcul([carte('a', { statut: 'en-vente' })])
    expect(t.exemplaires).toBe(0)
    expect(t.distinctes).toBe(0)
    expect(t.enVente).toBe(1)
    expect(t.valeur).toBeNull()
    expect(t.partSansPrix).toBeNull()
    expect(t.repartition.map((s) => [s.statut, s.part])).toEqual([['en-vente', 100]])
  })
})
