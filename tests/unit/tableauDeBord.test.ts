import { describe, expect, it } from 'vitest'
import type { Carte, Collection } from '../../src/lib/collection'
import { themesDeCarte } from '../../src/lib/themes'
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
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...extra,
})
const collection = (cartes: Carte[]): Collection => ({ version: 4, cartes })

const MAINTENANT = 1_800_000_000_000
const MIN = 60_000

const contexte = (extra: Partial<ContexteTableauDeBord> = {}): ContexteTableauDeBord => ({
  synchro: { activee: true, etat: 'a-jour', derniereTerminee: MAINTENANT - 12 * MIN },
  prix: {},
  ...extra,
})

const calcul = (cartes: Carte[], ctx: ContexteTableauDeBord = contexte()) =>
  calculerTableauDeBord(collection(cartes), ctx, MAINTENANT)

describe('chiffres clés', () => {
  it('SC-001 : exemplaires = somme des quantités, cartes distinctes', () => {
    const t = calcul([
      carte('commune|A', { quantite: 3 }),
      carte('rare|B', { quantite: 2 }),
    ])
    expect(t.exemplaires).toBe(5)
    expect(t.distinctes).toBe(2)
  })

  it('SC-001 : valeur estimée = somme valeur × quantité des cartes à valeur connue', () => {
    const t = calcul([
      carte('a', { quantite: 2, valeurMarchande: 10, }),
      carte('b', { quantite: 3, valeurMarchande: 4, }),
      carte('c', { quantite: 1, valeurMarchande: null }),
    ])
    expect(t.valeur).toBe(32)
  })

  it('SC-001 : part sans prix = % entier des cartes distinctes sans valeur', () => {
    const t = calcul([
      carte('a', { valeurMarchande: 10 }),
      carte('b', { valeurMarchande: null }),
      carte('c', { valeurMarchande: 5 }),
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
    const reliee = (id: string) => carte(id, { idsSite: [`ex-${id}`], etiquettesSite: [] })
    const t = calcul([reliee('a'), reliee('b'), carte('c', { idsSite: null })])
    expect(t.ecarts).toBe(2)
  })

  it('SC-001 : écarts calculés avec les amis du contexte (étiquette « #À échanger <ami> » attendue, donc 0 écart)', () => {
    const base = carte('e', { idsSite: ['ex-e'], description: 'compositeur allemand' })
    // Zoé suit un thème de la carte : l’étiquette d’échange vient du contexte, pas de la carte.
    const amis = [{ nom: 'Zoé', themes: themesDeCarte(base) }]
    const attendues = etiquettesDeCarte(base, { amis }).retenues
    expect(attendues).toContain('#À échanger Zoé')
    const reliee = { ...base, etiquettesSite: [...attendues] }
    expect(calcul([reliee], contexte({ amis })).ecarts).toBe(0)
    // Sans les amis, l’étiquette d’échange serait vue comme en trop.
    expect(calcul([reliee]).ecarts).toBe(1)
  })
})

describe('placesEncheres (extraite de lot.ts)', () => {
  it('SC-001 : max = min(config, site), occupées = max(en-vente, enCours du site)', () => {
    expect(placesEncheres({ maxVentesSimultanees: 5, ventesSite: null }, 2)).toEqual({ occupees: 2, max: 5 })
    expect(placesEncheres({ maxVentesSimultanees: 5, ventesSite: { enCours: 1, max: 3 } }, 2)).toEqual({ occupees: 2, max: 3 })
    expect(placesEncheres({ maxVentesSimultanees: 2, ventesSite: { enCours: 4, max: 10 } }, 0)).toEqual({ occupees: 4, max: 2 })
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
    expect(t.valeur).toBeNull()
    expect(t.partSansPrix).toBeNull()
    expect(t.ecarts).toBe(0)
    expect(sansNaN(t)).toBe(true)
  })

  it('SC-001 : cartes toutes sans prix : valeur nulle, part 100 %', () => {
    const t = calcul([carte('a', { quantite: 2 }), carte('b')])
    expect(t.exemplaires).toBe(3)
    expect(t.valeur).toBeNull()
    expect(t.partSansPrix).toBe(100)
    expect(Number.isNaN(t.partSansPrix)).toBe(false)
  })
})
