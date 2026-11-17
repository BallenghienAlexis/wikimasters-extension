import { describe, expect, it } from 'vitest'
import type { Carte } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { choisirProchaineEnchere } from '../../src/lib/relanceVentes'
import { preferencesParDefaut } from '../../src/lib/tri'
import {
  DELAI_FINAL_MS,
  DELAI_NORMAL_MS,
    analyserListeVentes,
  attenteApresEchec,
  cartesAAvertir,
  clePasserCarte,
  cleVuCarte,
  delaiSuivant,
  etatTerminee,
  formaterDecompte,
  fusionnerSuivi,
  origineDe,
  prolongations,
  suiviVide,
  type LancementVente,
} from '../../src/lib/ventes'

const T0 = Date.parse('2026-11-17T10:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const vente = (id: string, extra: Record<string, unknown> = {}) => ({
  id, card_id: `ex-${id}`, base_amount: 200, current_bid: null, effective_bid: 200, created_at: iso(T0), end_at: iso(T0 + 3_600_000), status: 'active',
  snapshot_rarity: 'rare', card: { wikipedia_title: `Carte ${id}` }, seller: { username: 'secret' }, ...extra,
})
const liste = (selling: unknown[], history: unknown[] = []) => ({ selling, history, maxConcurrentAuctions: 5 })

describe('lecture du listing des ventes', () => {
  it('garde les champs utiles et jamais le vendeur', () => {
    const l = analyserListeVentes(liste([vente('a')]))
    expect(l?.max).toBe(5)
    expect(l?.actives).toEqual([
      { id: 'a', idExemplaire: 'ex-a', titre: 'Carte a', rarete: 'rare', prixDepart: 200, prixActuel: 200, avecMise: false, creeLe: T0, finLe: T0 + 3_600_000 },
    ])
    expect(JSON.stringify(l)).not.toContain('secret')
  })
  it('prix actuel = mise posée, sinon prix de départ', () => {
    const l = analyserListeVentes(liste([vente('a', { current_bid: 260, effective_bid: 260 })]))
    expect(l?.actives[0]).toMatchObject({ prixActuel: 260, avecMise: true })
  })
  it('forme inattendue : null, entrée illisible ignorée', () => {
    expect(analyserListeVentes({})).toBeNull()
    expect(analyserListeVentes(null)).toBeNull()
    expect(analyserListeVentes(liste([vente('a'), { id: 3 }]))?.actives).toHaveLength(1)
  })
  it('historique trié du plus récent, borné', () => {
    const h = [vente('x', { end_at: iso(T0 - 5000), settled_at: null, final_price: 300 }), vente('y', { end_at: iso(T0 - 1000), settled_at: iso(T0 - 1000), final_price: null })]
    expect(analyserListeVentes(liste([], h))?.terminees.map((t) => t.id)).toEqual(['y', 'x'])
  })
})

describe('prolongations et cadence', () => {
  it('une fin qui avance de 60 s = une prolongation, la première fin est gardée', () => {
    const l1 = analyserListeVentes(liste([vente('a')]))!
    const s1 = fusionnerSuivi(suiviVide(), l1, T0)
    const l2 = analyserListeVentes(liste([vente('a', { end_at: iso(T0 + 3_660_000) })]))!
    const s2 = fusionnerSuivi(s1, l2, T0 + 1000)
    expect(s2.actives[0]!.finInitiale).toBe(T0 + 3_600_000)
    expect(prolongations(s2.actives[0]!)).toBe(1)
    const l3 = analyserListeVentes(liste([vente('a', { end_at: iso(T0 + 3_720_000) })]))!
    expect(prolongations(fusionnerSuivi(s2, l3, T0 + 2000).actives[0]!)).toBe(2)
  })
  it('5 min, ramenées au début de la dernière minute, puis 10 s', () => {
    expect(delaiSuivant([], T0)).toBe(DELAI_NORMAL_MS)
    expect(delaiSuivant([{ finLe: T0 + 3_600_000 }], T0)).toBe(DELAI_NORMAL_MS)
    expect(delaiSuivant([{ finLe: T0 + 90_000 }], T0)).toBe(30_000)
    expect(delaiSuivant([{ finLe: T0 + 60_000 }], T0)).toBe(DELAI_FINAL_MS)
    expect(delaiSuivant([{ finLe: T0 + 5_000 }], T0)).toBe(DELAI_FINAL_MS)
    expect(delaiSuivant([{ finLe: T0 - 10_000 }], T0)).toBe(DELAI_FINAL_MS)
    expect(delaiSuivant([{ finLe: T0 - 600_000 }], T0)).toBe(30_000)
  })
  it('attente après échec : 5 s puis +5 s, sans plafond', () => {
    expect([1, 2, 3, 100].map(attenteApresEchec)).toEqual([5000, 10_000, 15_000, 500_000])
  })
  it('décompte lisible', () => {
    expect(formaterDecompte(-1)).toBe('terminée')
    expect(formaterDecompte(45_000)).toBe('45 s')
    expect(formaterDecompte(725_000)).toBe('12 min 05 s')
    expect(formaterDecompte(3_700_000)).toBe('1 h 01 min')
  })
})

const lancement = (titre: string, le: number, resultat: 'reussie' | 'echec' = 'reussie'): LancementVente => ({ le, source: 'auto', titre, prix: 10, resultat, cause: null })

describe('origine, vendue ou non, avertissement', () => {
  it('origine : relance automatique, lot, sinon inconnue', () => {
    const v = { titre: 'Carte a', creeLe: T0 }
    expect(origineDe(v, [lancement('Carte a', T0 + 1000)], [])).toEqual({ type: 'auto' })
    expect(origineDe(v, [], [{ titre: 'Carte a', at: T0 - 1000, idLot: 'L1' }])).toEqual({ type: 'lot', idLot: 'L1' })
    expect(origineDe(v, [lancement('Carte a', T0 + 3_600_000)], [])).toEqual({ type: 'inconnue' })
  })
  it('terminée : vendue, non vendue relancée, non vendue', () => {
    const base = { id: 'a', titre: 'Carte a', rarete: '', prixDepart: 10, creeLe: T0, finLe: T0 + 3_600_000 }
    expect(etatTerminee({ ...base, prixFinal: 50 }, [])).toBe('vendue')
    expect(etatTerminee({ ...base, prixFinal: null }, [lancement('Carte a', base.finLe + 5000)])).toBe('non-vendue-relancee')
    expect(etatTerminee({ ...base, prixFinal: null }, [])).toBe('non-vendue')
  })
  it('avertit dès 3 remises en vente après une fin sans vente ; « Continuer » et « Retirer » sont des choix, jamais un arrêt', () => {
    const fin = (i: number) => ({ id: `t${i}`, titre: 'Carte a', rarete: '', prixDepart: 10, prixFinal: null, creeLe: T0 + i * 7_200_000, finLe: T0 + i * 7_200_000 + 3_600_000 })
    const terminees = [0, 1, 2].map(fin)
    const l = terminees.map((t) => lancement('Carte a', t.finLe + 2000))
    expect(cartesAAvertir(l, {}, terminees)).toEqual([{ titre: 'Carte a', relances: 3 }])
    expect(cartesAAvertir(l, { [cleVuCarte('Carte a')]: 3 }, terminees)).toEqual([])
    expect(cartesAAvertir(l, { [clePasserCarte('Carte a')]: 1 }, terminees)).toEqual([])
    // Des ventes réussies ne comptent jamais.
    expect(cartesAAvertir(l, {}, terminees.map((t) => ({ ...t, prixFinal: 50 })))).toEqual([])
    // Trois mises en vente sans fin sans vente : pas d’avertissement.
    expect(cartesAAvertir([lancement('Carte b', T0), lancement('Carte b', T0 + 1), lancement('Carte b', T0 + 2)], {}, [])).toEqual([])
  })
})

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id, titre: 'Berger allemand', description: 'race de chien', rarete: 'commune', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${id}-1`], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: 100, ...extra,
})
const entree = (cartes: Carte[], extra: Partial<Parameters<typeof choisirProchaineEnchere>[0]> = {}) => ({
  collection: { ...collectionVide(), cartes },
  preferences: preferencesParDefaut(),
  enCours: 4,
  max: 5,
  exemplairesEnVente: new Set<string>(),
  exemplairesEcartes: new Set<string>(),
  ...extra,
})

describe('choix de la carte suivante (règle de pré-cochage, plus chères d’abord)', () => {
  it('prend la plus chère éligible', () => {
    const r = choisirProchaineEnchere(entree([carte('a', { titre: 'Chien A', valeurMarchande: 40 }), carte('b', { titre: 'Chien B', valeurMarchande: 400 })]))
    expect(r?.action.idCarte).toBe('b')
    expect(r?.action.type).toBe('enchere')
  })
  it('aucune place libre : rien', () => {
    expect(choisirProchaineEnchere(entree([carte('a')], { enCours: 5 }))).toBeNull()
  })
  it('ni favori, ni carte à classer, ni valeur inconnue, ni valeur au plafond de défausse', () => {
    const cartes = [carte('f', { favori: true }), carte('c', { titre: 'Zzzz', description: '' }), carte('v', { valeurMarchande: null }), carte('p', { valeurMarchande: 3 })]
    expect(choisirProchaineEnchere(entree(cartes))).toBeNull()
  })
  it('un exemplaire déjà en vente, écarté ou une carte retirée par le joueur ne sont pas relancés', () => {
    expect(choisirProchaineEnchere(entree([carte('a')], { exemplairesEnVente: new Set(['ex-a-1']) }))).toBeNull()
    expect(choisirProchaineEnchere(entree([carte('a')], { exemplairesEcartes: new Set(['ex-a-1']) }))).toBeNull()
    expect(choisirProchaineEnchere(entree([carte('a')], { titresRetires: new Set(['Berger allemand']) }))).toBeNull()
  })
  it('prend l’exemplaire suivant quand le premier est en vente', () => {
    const r = choisirProchaineEnchere(entree([carte('a', { quantite: 2, idsSite: ['e1', 'e2'] })], { exemplairesEnVente: new Set(['e1']) }))
    expect(r?.action.idExemplaire).toBe('e2')
  })
})
