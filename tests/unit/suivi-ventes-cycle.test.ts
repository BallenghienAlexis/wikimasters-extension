import { describe, expect, it } from 'vitest'
import type { Action, ResultatAction } from '../../src/lib/actions'
import { collectionVide, type Carte } from '../../src/lib/collection'
import { creerSuiviVentes, type DependancesSuiviVentes } from '../../src/content/suiviVentes'
import type { StatutRelanceVentes } from '../../src/lib/stockage'
import { preferencesParDefaut } from '../../src/lib/tri'
import { suiviVide, type LancementVente, type SuiviVentes } from '../../src/lib/ventes'

const T0 = Date.parse('2026-11-17T10:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const carte: Carte = {
  id: 'c', titre: 'Berger allemand', description: 'race de chien', rarete: 'C', quantite: 1, url: null, favori: false,
  idsSite: ['ex-c'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: 100,
}
const vente = (id: string, finDans: number) => ({ id, card_id: `ex-${id}`, base_amount: 50, current_bid: null, effective_bid: 50, created_at: iso(T0), end_at: iso(T0 + finDans), card: { wikipedia_title: `T${id}` } })

function monde(opts: { reponses: Array<{ statut: number; json: unknown }>; relance?: boolean; resultat?: ResultatAction; visible?: boolean; actif?: boolean; synchroRecente?: boolean; pauseLots?: number }) {
  let t = T0
  let bailValeur: number | null = null
  const etat = { suivi: suiviVide() as SuiviVentes, statut: null as StatutRelanceVentes | null, lancements: [] as LancementVente[], ecartes: {} as Record<string, number>, lectures: 0, ordres: [] as Action[] }
  const reponses = [...opts.reponses]
  const deps: DependancesSuiviVentes = {
    horloge: { now: () => t, attendreJusqua: async (e) => void (t = Math.max(t, e)) },
    gigue: () => 0,
    transport: async () => {
      etat.lectures += 1
      return reponses.shift() ?? { statut: 200, json: { selling: [], history: [], maxConcurrentAuctions: 5 } }
    },
    emettre: async (o) => (etat.ordres.push(o), opts.resultat ?? { classe: 'reussie', codeHttp: 201, cause: 'action réussie' }),
    visible: () => opts.visible ?? true,
    actif: async () => opts.actif ?? true,
    route: '/api/marketplace?page=1&limit=50&sort=recent&mine=1',
    relanceActive: async () => opts.relance ?? false,
    chargerSuivi: async () => etat.suivi,
    enregistrerSuivi: async (s) => void (etat.suivi = s),
    chargerStatut: async () => etat.statut,
    enregistrerStatut: async (s) => void (etat.statut = s),
    chargerCollection: async () => ({ ...collectionVide(), cartes: [carte] }),
    chargerPreferences: async () => preferencesParDefaut(),
    chargerLancements: async () => etat.lancements,
    ajouterLancement: async (l) => void etat.lancements.push(l),
    chargerEcartes: async () => etat.ecartes,
    enregistrerEcartes: async (e) => void (etat.ecartes = e),
    pauseLots: async () => opts.pauseLots ?? null,
    derniereSynchro: async () => (opts.synchroRecente === false ? null : T0),
    derniereReleve: async () => (opts.synchroRecente === false ? null : T0),
    chargerEtat: async () => null,
    enregistrerEtat: async () => undefined,
    bail: { lire: async () => bailValeur, ecrire: async (v) => void (bailValeur = v) },
  }
  return { suivi: creerSuiviVentes(deps), etat, avancer: (ms: number) => void (t += ms), maintenant: () => t }
}

const ok = (selling: unknown[]) => ({ statut: 200, json: { selling, history: [], maxConcurrentAuctions: 5 } })

describe('cycle de suivi des mises en vente', () => {
  it('lit, enregistre et rend 5 min sans enchère proche', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)])] })
    expect(await m.suivi.cycle()).toBe(300_000)
    expect(m.etat.suivi.actives).toHaveLength(1)
  })
  it('10 s dans la dernière minute', async () => {
    const m = monde({ reponses: [ok([vente('a', 40_000)])] })
    expect(await m.suivi.cycle()).toBe(10_000)
  })
  it('n’ajoute aucune requête avant l’échéance', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)])] })
    await m.suivi.cycle()
    m.avancer(60_000)
    const reste = await m.suivi.cycle()
    expect(m.etat.lectures).toBe(1)
    expect(reste).toBeLessThanOrEqual(240_000)
  })
  it('onglet caché : aucune requête', async () => {
    const m = monde({ reponses: [], visible: false })
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(0)
  })
  it('401/429 en lecture : pause de 30 min, comme le relevé d’affluence', async () => {
    const m = monde({ reponses: [{ statut: 429, json: null }, ok([])] })
    expect(await m.suivi.cycle()).toBe(1_800_000)
    expect(m.etat.statut).toMatchObject({ etat: 'pause', jusqua: T0 + 1_800_000 })
  })
  it('échecs : 5 s, 10 s, 15 s, jamais d’arrêt, puis reprise normale', async () => {
    const m = monde({ reponses: [{ statut: 403, json: { code: 'human_verification_required' } }, { statut: 502, json: null }, { statut: 500, json: null }, ok([])] })
    const attentes: number[] = []
    for (let i = 0; i < 4; i += 1) {
      attentes.push(await m.suivi.cycle())
      m.avancer(attentes.at(-1)!)
    }
    expect(attentes.slice(0, 3)).toEqual([5000, 10_000, 15_000])
    expect(attentes[3]).toBe(300_000)
    expect(m.etat.statut?.etat).toBe('lecture')
  })
  it('relance : une carte éligible est mise en vente quand une place est libre, sans clic', async () => {
    const m = monde({ reponses: [ok([])], relance: true })
    const delai = await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.ordres[0]).toMatchObject({ type: 'enchere', idExemplaire: 'ex-c' })
    expect(m.etat.lancements[0]).toMatchObject({ resultat: 'reussie', titre: 'Berger allemand' })
    expect(delai).toBe(2000)
  })
  it('relance : le prix de départ est divisé par deux autant de fois que la carte est restée non vendue', async () => {
    const m = monde({ reponses: [ok([])], relance: true })
    await m.suivi.cycle()
    const normal = (m.etat.ordres[0] as { prix: number }).prix
    const n = monde({ reponses: [ok([])], relance: true })
    n.etat.suivi = { ...suiviVide(), nonVentes: { 'C|Berger allemand': 2 }, finsVues: [] }
    await n.suivi.cycle()
    expect(n.etat.ordres[0]).toMatchObject({ type: 'enchere', prix: Math.max(1, Math.floor(normal / 4)) })
    expect(n.etat.lancements[0]?.prix).toBe(Math.max(1, Math.floor(normal / 4)))
  })
  it('de bout en bout : deux non-ventes lues dans l’historique du site divisent le prix de la relance (rareté en code du site)', async () => {
    const fin = (id: string, dans: number) => ({ id, card_id: 'ex-x', base_amount: 10, current_bid: null, effective_bid: 10, final_price: null, status: 'settled_unsold', snapshot_rarity: 'C', created_at: iso(T0 - 7_200_000), settled_at: iso(T0 + dans), end_at: iso(T0 + dans), card: { wikipedia_title: 'Berger allemand' } })
    const sans = monde({ reponses: [ok([])], relance: true })
    await sans.suivi.cycle()
    const normal = (sans.etat.ordres[0] as { prix: number }).prix
    const m = monde({ reponses: [{ statut: 200, json: { selling: [], history: [fin('h1', -2000), fin('h2', -1000)], maxConcurrentAuctions: 5 } }], relance: true })
    m.etat.suivi = { ...suiviVide(), finsVues: [] }
    await m.suivi.cycle()
    expect(m.etat.ordres[0]).toMatchObject({ type: 'enchere', prix: Math.max(1, Math.floor(normal / 4)) })
  })
  it('relance désactivée ou limite atteinte : aucun ordre', async () => {
    const off = monde({ reponses: [ok([])], relance: false })
    await off.suivi.cycle()
    expect(off.etat.ordres).toHaveLength(0)
    const pleine = monde({ reponses: [ok([1, 2, 3, 4, 5].map((i) => vente(String(i), 3_600_000)))], relance: true })
    await pleine.suivi.cycle()
    expect(pleine.etat.ordres).toHaveLength(0)
  })
  it('anti-bot sur l’écriture : attente progressive de 5 s puis nouvel essai, sans contournement ni arrêt', async () => {
    const m = monde({ reponses: [ok([]), ok([]), ok([])], relance: true, resultat: { classe: 'arret', codeHttp: 403, cause: 'vérification anti-bot requise' } })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.statut).toMatchObject({ etat: 'pause', jusqua: T0 + 5000 })
    m.avancer(300_000)
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(2)
    expect(m.etat.statut).toMatchObject({ etat: 'pause' })
    expect(m.etat.statut?.jusqua).toBe(m.maintenant() + 10_000)
  })
  it('pause 401/429 : une lecture réussie ne la lève pas, même après rechargement de l’onglet', async () => {
    const m = monde({ reponses: [ok([]), ok([]), ok([])], relance: true, resultat: { classe: 'arret', codeHttp: 429, cause: 'réponse hors contrat' } })
    await m.suivi.cycle()
    const fin = m.etat.statut!.jusqua!
    expect(fin).toBe(T0 + 1_800_000)
    const apres = monde({ reponses: [ok([])], relance: true })
    apres.etat.statut = m.etat.statut
    apres.etat.suivi = suiviVide()
    await apres.suivi.cycle()
    expect(apres.etat.ordres).toHaveLength(0)
    expect(apres.etat.statut?.jusqua).toBe(fin)
  })
  it('« Passer cette carte » pendant une pause 429 : la pause reste, aucune requête avant son échéance', async () => {
    const m = monde({ reponses: [ok([]), { statut: 429, json: null }, ok([])], relance: true, resultat: { classe: 'echec', codeHttp: 500, cause: 'erreur réseau' } })
    m.etat.statut = { etat: 'pause', message: 'x', jusqua: T0 + 1_800_000, echecs: 0, maj: T0, carte: { titre: 'Berger allemand', idExemplaire: 'ex-c', essais: 5 } }
    const attente = await m.suivi.cycle()
    expect(attente).toBe(1_800_000)
    expect(m.etat.lectures).toBe(0)
  })
  it('pause des autres process (lots) : aucune relance', async () => {
    const m = monde({ reponses: [ok([])], relance: true, pauseLots: T0 + 600_000 })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(0)
  })
  it('refus 403 de suite : au-delà de 2, attente progressive au lieu d’une rafale', async () => {
    const m = monde({ reponses: Array.from({ length: 6 }, () => ok([])), relance: true, resultat: { classe: 'echec', codeHttp: 403, cause: 'réponse hors contrat' } })
    for (let i = 0; i < 3; i += 1) {
      await m.suivi.cycle()
      m.avancer(400_000)
      m.etat.ecartes = {}
    }
    expect(m.etat.statut).toMatchObject({ etat: 'pause', jusqua: m.maintenant() - 400_000 + 5000 })
  })
  it('la synchro passe d’abord : aucune lecture tant qu’elle est due', async () => {
    const m = monde({ reponses: [ok([])], synchroRecente: false })
    expect(await m.suivi.cycle()).toBe(5000)
    expect(m.etat.lectures).toBe(0)
  })
  it('la réponse du listing lue par la synchro met le suivi à jour sans requête', async () => {
    const m = monde({ reponses: [] })
    await m.suivi.integrer({ selling: [vente('a', 3_600_000)], history: [], maxConcurrentAuctions: 5 })
    expect(m.etat.suivi.actives).toHaveLength(1)
    expect(m.etat.lectures).toBe(0)
    expect(await m.suivi.cycle()).toBeGreaterThan(200_000)
    expect(m.etat.lectures).toBe(0)
  })
  it('synchro automatique coupée : aucune lecture', async () => {
    const m = monde({ reponses: [ok([])], actif: false })
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(0)
  })
  it('5 échecs d’une même carte : avertissement avec choix, attente toujours en cours', async () => {
    const m = monde({ reponses: Array.from({ length: 8 }, () => ok([])), relance: true, resultat: { classe: 'echec', codeHttp: 500, cause: 'erreur réseau' } })
    for (let i = 0; i < 5; i += 1) {
      await m.suivi.cycle()
      m.avancer(400_000)
    }
    expect(m.etat.ordres).toHaveLength(5)
    expect(m.etat.statut).toMatchObject({ etat: 'pause', carte: { idExemplaire: 'ex-c', essais: 5 } })
  })
  it('429 : relance en pause 30 min ; 403 : l’exemplaire est écarté', async () => {
    const m = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'arret', codeHttp: 429, cause: 'réponse hors contrat' } })
    await m.suivi.cycle()
    expect(m.etat.statut).toMatchObject({ etat: 'pause', jusqua: T0 + 1_800_000 })
    const r = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'echec', codeHttp: 403, cause: 'réponse hors contrat' } })
    await r.suivi.cycle()
    expect(r.etat.ecartes['ex-c']).toBeGreaterThan(T0)
  })
})
