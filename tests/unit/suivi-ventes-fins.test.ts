import { describe, expect, it } from 'vitest'
import type { Action, ResultatAction } from '../../src/lib/actions'
import { collectionVide, type Carte } from '../../src/lib/collection'
import { creerSuiviVentes, type DependancesSuiviVentes } from '../../src/content/suiviVentes'
import type { EtatSuiviVentes, StatutRelanceVentes } from '../../src/lib/stockage'
import { preferencesParDefaut } from '../../src/lib/tri'
import { suiviVide, type LancementVente, type SuiviVentes } from '../../src/lib/ventes'

const T0 = Date.parse('2026-11-17T10:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const carte = (code: string, valeur: number): Carte => ({
  id: `c-${code}`, titre: `Carte ${code}`, description: 'race de chien', rarete: 'C', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${code}`], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: valeur,
})
const enCours = (code: string, finDans = 3_600_000) => ({ id: `v-${code}`, card_id: `ex-${code}`, base_amount: 50, current_bid: null, effective_bid: 50, created_at: iso(T0 - 600_000), end_at: iso(T0 + finDans), snapshot_rarity: 'C', card: { wikipedia_title: `Carte ${code}` } })
const fin = (code: string, status: string, dans: number) => ({ id: `v-${code}`, card_id: `ex-${code}`, base_amount: 50, current_bid: null, effective_bid: 50, final_price: status === 'settled_sold' ? 80 : null, status, snapshot_rarity: 'C', created_at: iso(T0 - 4_000_000), settled_at: iso(T0 + dans), end_at: iso(T0 + dans), card: { wikipedia_title: `Carte ${code}` } })
const liste = (selling: unknown[], history: unknown[]) => ({ statut: 200, json: { selling, history, maxConcurrentAuctions: 5 } })

function monde(opts: { reponses: Array<{ statut: number; json: unknown }>; cartes: Carte[]; resultats?: ResultatAction[] }) {
  let t = T0
  const reponses = [...opts.reponses]
  const resultats = [...(opts.resultats ?? [])]
  const etat = { suivi: { ...suiviVide(), finsVues: [] } as SuiviVentes, statut: null as StatutRelanceVentes | null, suiviEtat: null as EtatSuiviVentes | null, verrous: 0, lancements: [] as LancementVente[], ecartes: {} as Record<string, number>, ordres: [] as Action[] }
  let bail: number | null = null
  const deps: DependancesSuiviVentes = {
    horloge: { now: () => t, attendreJusqua: async (e) => void (t = Math.max(t, e)) },
    gigue: () => 0,
    transport: async () => reponses.shift() ?? liste([], []),
    emettre: async (o) => (etat.ordres.push(o), resultats.shift() ?? { classe: 'reussie', codeHttp: 201, cause: 'action réussie' }),
    visible: () => true,
    actif: async () => true,
    verrou: async (f) => (etat.verrous++, f()),
    chargerEtatSuivi: async () => etat.suiviEtat,
    enregistrerEtatSuivi: async (e) => void (etat.suiviEtat = e),
    lotEnCours: async () => false,
    route: '/api/marketplace?page=1&limit=50&sort=recent&mine=1',
    relanceActive: async () => true,
    chargerSuivi: async () => etat.suivi,
    enregistrerSuivi: async (s) => void (etat.suivi = s),
    chargerStatut: async () => etat.statut,
    enregistrerStatut: async (s) => void (etat.statut = s),
    chargerCollection: async () => ({ ...collectionVide(), cartes: opts.cartes }),
    chargerPreferences: async () => preferencesParDefaut(),
    chargerLancements: async () => etat.lancements,
    ajouterLancement: async (l) => void etat.lancements.push(l),
    chargerEcartes: async () => etat.ecartes,
    enregistrerEcartes: async (e) => void (etat.ecartes = e),
    pauseLots: async () => null,
    chargerEtat: async () => null,
    enregistrerEtat: async () => undefined,
    bail: { lire: async () => bail, ecrire: async (v) => void (bail = v) },
  }
  return { suivi: creerSuiviVentes(deps), etat, avancer: (ms: number) => void (t += ms) }
}

const ex = (a: Action): string => (a as { idExemplaire: string }).idExemplaire
const prix = (a: Action): number => (a as { prix: number }).prix

/** Cartes du joueur : K (annulée, de nouveau disponible), U (non vendue), E1 et E2 (jamais mises en vente) ; S (vendue) a quitté la collection. */
const cartes = [carte('K', 300), carte('E1', 200), carte('E2', 150), carte('U', 100)]

describe('fins d’enchères simultanées', () => {
  it('trois fins dans la même seconde (vendue, non vendue, annulée) : chacune est traitée, la non vendue retentée moins chère', async () => {
    const base = monde({ reponses: [liste([], [])], cartes: [carte('U', 100)] })
    await base.suivi.cycle()
    const normal = prix(base.etat.ordres[0]!)

    const m = monde({
      reponses: [liste([enCours('A'), enCours('B')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000)])],
      cartes,
    })
    await m.suivi.cycle()
    expect(m.etat.ordres.map(ex).sort()).toEqual(['ex-E1', 'ex-E2', 'ex-U'])
    // La non vendue repart : même exemplaire, prix de départ divisé par deux.
    const retentee = m.etat.ordres.find((o) => ex(o) === 'ex-U')!
    expect(prix(retentee)).toBe(Math.max(1, Math.floor(normal / 2)))
    // File vidée, une ligne de journal par fin traitée avec son issue, un envoi à la fois sous le verrou (1 lecture + 3 envois).
    expect(m.etat.suivi.aTraiter).toEqual([])
    expect(m.etat.lancements).toHaveLength(3)
    expect(m.etat.lancements.map((l) => l.issue).sort()).toEqual(['annulee', 'non-vendue', 'vendue'])
    expect(m.etat.lancements.every((l) => l.resultat === 'reussie')).toBe(true)
    expect(m.etat.verrous).toBe(4)
  })

  it('annulée : une carte est remise en vente, mais jamais la carte annulée', async () => {
    const m = monde({ reponses: [liste([enCours('A')], [fin('K', 'cancelled', -1000)])], cartes })
    await m.suivi.cycle()
    expect(m.etat.ordres.map(ex)).not.toContain('ex-K')
    expect(m.etat.ordres.length).toBeGreaterThan(0)
    expect(m.etat.ecartes['ex-K']).toBeGreaterThan(T0)
  })

  it('idempotent : relire la même liste ne relance rien de plus', async () => {
    const m = monde({
      reponses: [
        liste([enCours('A'), enCours('B')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000)]),
        liste([enCours('A'), enCours('B'), enCours('E1'), enCours('E2'), enCours('U')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000)]),
      ],
      cartes,
    })
    await m.suivi.cycle()
    m.avancer(400_000)
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(3)
    expect(m.etat.suivi.aTraiter).toEqual([])
  })

  it('limite des places : seules les places libres sont prises, les fins restantes attendent leur tour', async () => {
    const m = monde({
      reponses: [
        liste([enCours('A'), enCours('B'), enCours('C'), enCours('D')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000)]),
        liste([enCours('A'), enCours('B'), enCours('C')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000), fin('D', 'settled_sold', 1000)]),
      ],
      cartes,
    })
    await m.suivi.cycle()
    // Quatre enchères en cours sur cinq : une seule place, prise par la non vendue U (retentée en priorité).
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.suivi.aTraiter).toEqual(['v-S', 'v-K'])
    m.avancer(400_000)
    await m.suivi.cycle()
    // Deux places libres de plus : les fins restantes sont traitées, la non vendue retentée.
    expect(m.etat.ordres.map(ex)).toContain('ex-U')
    expect(m.etat.suivi.aTraiter).not.toContain('v-U')
    expect(m.etat.ordres.length).toBeLessThanOrEqual(5)
  })

  it('401/429 pendant le traitement : la fin en cours reste dans la file, aucune autre n’est tentée', async () => {
    const m = monde({
      reponses: [liste([enCours('A')], [fin('S', 'settled_sold', -3000), fin('U', 'settled_unsold', -2000), fin('K', 'cancelled', -1000)])],
      cartes,
      resultats: [{ classe: 'reussie', codeHttp: 201, cause: 'action réussie' }, { classe: 'arret', codeHttp: 429, cause: 'le site demande de ralentir' }],
    })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(2)
    expect(m.etat.suivi.aTraiter).toEqual(['v-S', 'v-K'])
    expect(m.etat.statut).toMatchObject({ etat: 'pause' })
    expect(m.etat.statut?.jusqua).toBe(T0 + 1_800_000)
  })

  it('enchère disparue sans verdict : on attend son statut (10 s) avant de choisir, puis la non vendue est retentée', async () => {
    const m = monde({
      reponses: [liste([enCours('A')], []), liste([enCours('A')], []), liste([enCours('A')], [fin('U', 'settled_unsold', 5000)])],
      cartes: [carte('U', 100), carte('E1', 500)],
    })
    m.etat.suivi = { ...suiviVide(), finsVues: [], actives: [{ id: 'v-U', idExemplaire: 'ex-U', titre: 'Carte U', rarete: 'C', prixDepart: 50, prixActuel: 50, avecMise: false, creeLe: T0 - 3_600_000, finLe: T0 - 1000, finInitiale: T0 - 1000 }, ...suiviVide().actives] }
    const delai = await m.suivi.cycle()
    // U a disparu de la liste sans être dans l’historique : rien n’est lancé, nouvelle lecture dans 10 s.
    expect(m.etat.ordres).toHaveLength(0)
    expect(delai).toBe(10_000)
    m.avancer(10_000)
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(0)
    m.avancer(10_000)
    await m.suivi.cycle()
    // Verdict connu (non vendue) : la même carte repart en priorité, malgré la carte plus chère disponible.
    expect(ex(m.etat.ordres[0]!)).toBe('ex-U')
  })
})
