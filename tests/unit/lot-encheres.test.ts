import { describe, expect, it } from 'vitest'
import type { Action, ActionEnchere, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { prixDepart } from '../../src/lib/tri'
import { construireLot, type Config } from '../../src/lib/lot'
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
  idsSite: [`ex-${id}-1`, `ex-${id}-2`],
  statut: 'vendre',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: 30,
  decidePar: null,
  ...extra,
})

const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({
  maxVentesSimultanees: 5,
  longueurMaxEtiquette: 50,
  nomsExistants: [],
  lienCardId: true,
  ...extra,
})
const lot = (c: Collection, cfg: Config = config(), dispo: TypesDisponibles = TOUS) =>
  construireLot(c, registreVide(), cfg, dispo)
const encheres = (actions: Action[]): ActionEnchere[] =>
  actions.filter((a): a is ActionEnchere => a.type === 'enchere')
const raisons = (l: ReturnType<typeof lot>, idCarte: string) =>
  l.ecartees.filter((e) => e.idCarte === idCarte).map((e) => e.raison)

describe('enchères : places libres (AC1)', () => {
  it('limite le nombre d’enchères aux places libres', () => {
    const cartes = ['a', 'b', 'c', 'd'].map((id) => carte(id))
    const l = lot(coll(...cartes), config({ maxVentesSimultanees: 3 }))
    expect(encheres(l.actions)).toHaveLength(3)
  })

  it('retire les cartes déjà en vente des places libres', () => {
    const cartes = [
      carte('en1', { statut: 'en-vente' }),
      carte('en2', { statut: 'en-vente' }),
      carte('a'),
      carte('b'),
      carte('c'),
    ]
    const l = lot(coll(...cartes), config({ maxVentesSimultanees: 3 }))
    expect(encheres(l.actions)).toHaveLength(1)
  })

  it('un nombre de cartes en vente supérieur à la limite donne zéro place (jamais négatif)', () => {
    const cartes = [carte('en1', { statut: 'en-vente' }), carte('en2', { statut: 'en-vente' }), carte('a')]
    const l = lot(coll(...cartes), config({ maxVentesSimultanees: 1 }))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['en-attente-place'])
  })

  it('au plus une enchère par carte, sur le premier exemplaire de idsSite', () => {
    const l = lot(coll(carte('a', { quantite: 2 })))
    const e = encheres(l.actions)
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ type: 'enchere', idCarte: 'a', idExemplaire: 'ex-a-1' })
  })

  it('sans lienCardId (défaut), le type enchère est non disponible (H45)', () => {
    const { lienCardId: _ignore, ...sans } = config()
    const l = lot(coll(carte('a')), sans as Config)
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['action-non-disponible'])
  })

  it('lienCardId à false : aucune enchère', () => {
    const l = lot(coll(carte('a')), config({ lienCardId: false }))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['action-non-disponible'])
  })

  it('type enchère absent de disponibles : « action non disponible », sans action', () => {
    const dispo = new Set<TypeAction>(TYPES_ACTION.filter((t) => t !== 'enchere'))
    const l = lot(coll(carte('a')), config(), dispo)
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['action-non-disponible'])
  })
})

describe('enchères : prix, tri et départage (AC2)', () => {
  it('prix = prixCible sinon prixDepart(valeurMarchande)', () => {
    const l = lot(
      coll(carte('a', { prixCible: 7, valeurMarchande: 30 }), carte('b', { prixCible: null, valeurMarchande: 60 })),
    )
    const prix = Object.fromEntries(encheres(l.actions).map((e) => [e.idCarte, e.prix]))
    expect(prix).toEqual({ a: 7, b: prixDepart(60) })
  })

  it('tri par prix décroissant, puis valeur marchande décroissante, puis id croissant', () => {
    const l = lot(
      coll(
        carte('d', { prixCible: 5, valeurMarchande: 40 }),
        carte('c', { prixCible: 5, valeurMarchande: 40 }),
        carte('b', { prixCible: 5, valeurMarchande: 90 }),
        carte('a', { prixCible: 9, valeurMarchande: 20 }),
      ),
    )
    expect(encheres(l.actions).map((e) => e.idCarte)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('les cartes en attente de place sont les moins bien classées', () => {
    const l = lot(
      coll(carte('a', { prixCible: 2 }), carte('b', { prixCible: 8 }), carte('c', { prixCible: 5 })),
      config({ maxVentesSimultanees: 2 }),
    )
    expect(encheres(l.actions).map((e) => e.idCarte)).toEqual(['b', 'c'])
    expect(raisons(l, 'a')).toEqual(['en-attente-place'])
  })
})

describe('enchères : cartes écartées (AC3)', () => {
  it('valeur marchande absente : le repli par rareté ne suffit pas', () => {
    const l = lot(coll(carte('a', { valeurMarchande: null, prixCible: 5 })))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['valeur-absente'])
  })

  it('prix absent (aucune tranche de la matrice)', () => {
    const l = lot(coll(carte('a', { valeurMarchande: 3, prixCible: null })))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['prix-invalide'])
  })

  it('prix inférieur à 1, y compris 0', () => {
    const l = lot(coll(carte('a', { prixCible: 0 }), carte('b', { prixCible: 0.5 })))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['prix-invalide'])
    expect(raisons(l, 'b')).toEqual(['prix-invalide'])
  })

  it('prix supérieur ou égal à la valeur marchande', () => {
    const l = lot(
      coll(carte('a', { prixCible: 30, valeurMarchande: 30 }), carte('b', { prixCible: 31, valeurMarchande: 30 })),
    )
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['prix-superieur-valeur'])
    expect(raisons(l, 'b')).toEqual(['prix-superieur-valeur'])
  })

  it('carte non reliée : écartée une seule fois, sans enchère', () => {
    const l = lot(coll(carte('a', { idsSite: null })))
    expect(encheres(l.actions)).toEqual([])
    expect(raisons(l, 'a')).toEqual(['non-reliee'])
  })

  it('une carte écartée ne consomme pas de place', () => {
    const l = lot(
      coll(carte('a', { valeurMarchande: null }), carte('b', { prixCible: 3 })),
      config({ maxVentesSimultanees: 1 }),
    )
    expect(encheres(l.actions).map((e) => e.idCarte)).toEqual(['b'])
  })

  it('seules les cartes au statut vendre, hors favori, reçoivent une enchère', () => {
    const l = lot(
      coll(
        carte('a', { statut: 'garder' }),
        carte('b', { statut: 'echanger', ami: 'Zoé' }),
        carte('c', { favori: true }),
        carte('d', { statut: 'a-trier' }),
        carte('e', { statut: 'en-vente' }),
      ),
    )
    expect(encheres(l.actions)).toEqual([])
  })
})

describe('enchères : étiquettes d’une carte à vendre (AC4, H16)', () => {
  it('la carte vendre garde ses étiquettes « Statut · … » en plus de l’enchère', () => {
    const l = lot(coll(carte('a')))
    expect(l.actions.filter((a) => a.type === 'pose-etiquette')).toHaveLength(2)
    expect(encheres(l.actions)).toHaveLength(1)
  })

  it('une carte en attente de place garde ses étiquettes', () => {
    const l = lot(coll(carte('a')), config({ maxVentesSimultanees: 0 }))
    expect(raisons(l, 'a')).toEqual(['en-attente-place'])
    expect(l.actions.filter((a) => a.type === 'pose-etiquette')).toHaveLength(2)
  })

  it('les enchères viennent après les poses et avant les défausses (H9)', () => {
    const l = lot(coll(carte('a'), carte('z', { statut: 'defausser', idsSite: ['ex-z'] })))
    const types = l.actions.map((a) => a.type)
    expect(types.lastIndexOf('pose-etiquette')).toBeLessThan(types.indexOf('enchere'))
    expect(types.indexOf('enchere')).toBeLessThan(types.indexOf('defausse'))
  })
})

describe('enchères : performance (AC5)', () => {
  it('5 000 cartes fictives avec enchères en moins de 500 ms', () => {
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { valeurMarchande: 20 + (i % 500), statut: i % 3 === 0 ? 'vendre' : 'garder' }),
    )
    const t0 = performance.now()
    const l = lot(coll(...cartes), config({ maxVentesSimultanees: 50 }))
    const duree = performance.now() - t0
    expect(encheres(l.actions).length).toBeGreaterThan(0)
    expect(duree).toBeLessThan(500)
  })
})
