import { describe, expect, it } from 'vitest'
import type { Action, ResultatAction } from '../../src/lib/actions'
import { collectionVide, type Carte } from '../../src/lib/collection'
import { creerSuiviVentes, type DependancesSuiviVentes } from '../../src/content/suiviVentes'
import type { EtatSuiviVentes, StatutRelanceVentes } from '../../src/lib/stockage'
import { definirThemesWikipedia } from '../../src/lib/themes'
import { preferencesParDefaut, type Preferences } from '../../src/lib/tri'
import { etatInitial, type EtatOrdonnanceur } from '../../src/lib/ordonnanceur'
import { suiviVide, type LancementVente, type SuiviVentes } from '../../src/lib/ventes'

const T0 = Date.parse('2026-11-17T10:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const carte: Carte = {
  id: 'c', titre: 'Berger allemand', description: 'race de chien', rarete: 'C', quantite: 1, url: null, favori: false,
  idsSite: ['ex-c'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: 100,
}
const vente = (id: string, finDans: number) => ({ id, card_id: `ex-${id}`, base_amount: 50, current_bid: null, effective_bid: 50, created_at: iso(T0), end_at: iso(T0 + finDans), card: { wikipedia_title: `T${id}` } })

function monde(opts: { reponses: Array<{ statut: number; json: unknown }>; relance?: boolean; resultat?: ResultatAction; visible?: boolean; actif?: boolean; synchroRecente?: boolean; pauseLots?: number; lotEnCours?: boolean; etat?: EtatOrdonnanceur; surcouches?: () => Promise<void>; preferences?: Preferences; carte?: Carte; synchroPcAJour?: () => Promise<boolean> }) {
  let t = T0
  // Le bail du suivi est le sien : celui de la synchro globale (tenu ou non) ne le concerne pas.
  let bailValeur: number | null = null
  let globalEtat: EtatOrdonnanceur | null = opts.etat ?? (opts.synchroRecente === false ? { ...etatInitial(), arretJusqua: T0 + 3_600_000 } : { ...etatInitial(), cardIds: { c: 'card-site-c' } })
  const etat = { suivi: suiviVide() as SuiviVentes, statut: null as StatutRelanceVentes | null, suiviEtat: null as EtatSuiviVentes | null, verrous: 0, lancements: [] as LancementVente[], ecartes: {} as Record<string, number>, lectures: 0, ordres: [] as Action[] }
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
    verrou: async (f) => {
      etat.verrous += 1
      return f()
    },
    chargerEtatSuivi: async () => etat.suiviEtat,
    enregistrerEtatSuivi: async (e) => void (etat.suiviEtat = e),
    lotEnCours: async () => opts.lotEnCours ?? false,
    ...(opts.synchroPcAJour ? { synchroPcAJour: opts.synchroPcAJour } : {}),
    route: '/api/marketplace?page=1&limit=50&sort=recent&mine=1',
    relanceActive: async () => opts.relance ?? false,
    chargerSuivi: async () => etat.suivi,
    enregistrerSuivi: async (s) => void (etat.suivi = s),
    chargerStatut: async () => etat.statut,
    enregistrerStatut: async (s) => void (etat.statut = s),
    chargerCollection: async () => ({ ...collectionVide(), cartes: [opts.carte ?? carte] }),
    chargerPreferences: async () => opts.preferences ?? preferencesParDefaut(),
    ...(opts.surcouches ? { chargerSurcouchesThemes: opts.surcouches } : {}),
    chargerLancements: async () => etat.lancements,
    ajouterLancement: async (l) => void etat.lancements.push(l),
    chargerEcartes: async () => etat.ecartes,
    enregistrerEcartes: async (e) => void (etat.ecartes = e),
    pauseLots: async () => opts.pauseLots ?? null,
    chargerEtat: async () => globalEtat,
    enregistrerEtat: async (e) => void (globalEtat = e),
    bail: { lire: async () => bailValeur, ecrire: async (v) => void (bailValeur = v) },
  }
  return { suivi: creerSuiviVentes(deps), etat, global: () => globalEtat, bail: (v: number | null) => void (bailValeur = v), bailValeur: () => bailValeur, avancer: (ms: number) => void (t += ms), maintenant: () => t }
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
    expect(m.etat.suiviEtat).toMatchObject({ etat: 'pause', jusqua: T0 + 1_800_000 })
    // Le site demande de ralentir : la synchro globale le voit aussi (la pause lui est transmise, jamais l’inverse).
    expect(m.global()?.arretJusqua).toBe(T0 + 1_800_000)
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
    expect(m.etat.suiviEtat).toMatchObject({ etat: 'ok', echecs: 0 })
  })
  it('relance : une carte éligible est mise en vente quand une place est libre, sans clic', async () => {
    const m = monde({ reponses: [ok([])], relance: true })
    const delai = await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.ordres[0]).toMatchObject({ type: 'enchere', idExemplaire: 'ex-c' })
    expect(m.etat.lancements[0]).toMatchObject({ resultat: 'reussie', titre: 'Berger allemand' })
    expect(delai).toBe(2000)
  })
  it('relance : 409 « déjà en vente ou plus possédée » écarte l’exemplaire un jour, sans attente d’une minute', async () => {
    const m = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'echec', codeHttp: 409, cause: 'carte déjà en vente ou plus possédée' } })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.ecartes['ex-c']).toBeGreaterThan(m.maintenant())
    expect(m.etat.statut?.etat).not.toBe('pause')
  })
  it('relance : 409 limite d’enchères ou conflit non reconnu : attente d’une minute, rien d’écarté', async () => {
    for (const cause of ['limite d’enchères atteinte', 'conflit signalé par le site']) {
      const m = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'echec', codeHttp: 409, cause } })
      await m.suivi.cycle()
      expect(m.etat.ecartes['ex-c']).toBeUndefined()
      expect(m.etat.statut?.etat).toBe('pause')
    }
  })
  it('relance : synchro entre PC périmée, aucune mise en vente ; dépendance qui échoue vaut périmée ; absente, comportement inchangé', async () => {
    const m1 = monde({ reponses: [ok([])], relance: true, synchroPcAJour: async () => false })
    await m1.suivi.cycle()
    expect(m1.etat.ordres).toHaveLength(0)
    const m2 = monde({ reponses: [ok([])], relance: true, synchroPcAJour: async () => { throw new Error('stockage') } })
    await m2.suivi.cycle()
    expect(m2.etat.ordres).toHaveLength(0)
    const m3 = monde({ reponses: [ok([])], relance: true, synchroPcAJour: async () => true })
    await m3.suivi.cycle()
    expect(m3.etat.ordres).toHaveLength(1)
  })
  it('relance : un thème venu de Wikipédia et suivi par un ami garde la carte (jamais mise en vente)', async () => {
    const prefs: Preferences = { ...preferencesParDefaut(), amis: [{ nom: 'Quentin', themes: ['guerre'] }] }
    const base: Carte = { ...carte, titre: 'Base aérienne 942 Lyon-Mont Verdun', description: '', rarete: 'SR', valeurMarchande: 27 }
    try {
      const m = monde({ reponses: [ok([])], relance: true, preferences: prefs, carte: base, surcouches: async () => definirThemesWikipedia(new Map([[base.titre, ['guerre']]])) })
      await m.suivi.cycle()
      expect(m.etat.ordres).toHaveLength(0)
    } finally {
      definirThemesWikipedia(new Map())
    }
  })
  it('relance : surcouches de thèmes illisibles, rien n’est mis en vente à l’aveugle', async () => {
    const m = monde({ reponses: [ok([])], relance: true, surcouches: async () => { throw new Error('stockage illisible') } })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(0)
  })
  it('relance : maximum absent de la réponse du site, la limite de 5 de la configuration s’applique et la relance part', async () => {
    const m = monde({ reponses: [{ statut: 200, json: { selling: [], history: [] } }], relance: true })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
  })
  it('relance : une enchère dont la fin est dépassée mais encore listée ne prend plus de place (5/5 retrouvé)', async () => {
    const m = monde({ reponses: [ok([vente('a', -5_000), vente('b', 3_600_000), vente('v', 3_600_000), vente('d', 3_600_000), vente('e', 3_600_000)])], relance: true })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
  })
  it('relance : pause des lots en cours, la place libre est retentée à la fin de la pause', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)])], relance: true, pauseLots: T0 + 20_000 })
    const attente = await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(0)
    expect(attente).toBeLessThanOrEqual(20_000)
  })
  it('relance : prix introuvable (passée), nouvelle tentative sous 10 s', async () => {
    const m = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'passee', codeHttp: 404, cause: 'prix du marché indisponible' } })
    expect(await m.suivi.cycle()).toBeLessThanOrEqual(10_000)
  })
  it('relance : envoi en échec (500), la place libre est retentée dès la fin de l’attente, pas 5 min plus tard', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)]), ok([vente('a', 3_600_000)])], relance: true, resultat: { classe: 'echec', codeHttp: 500, cause: 'erreur serveur' } })
    const attente = await m.suivi.cycle()
    expect(attente).toBeLessThanOrEqual(10_000)
    m.avancer(attente)
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(2)
    expect(m.etat.ordres.length).toBeGreaterThanOrEqual(1)
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
  it('relance : l’ordre porte la carte du site, la rareté et les non-ventes pour relire la tendance avant l’envoi', async () => {
    const etat = { ...etatInitial(), cardIds: { c: 'card-site-c' }, prix: { c: { valeur: 100, releveLe: T0, tendance: { variationPct: 40, min4: 10, max4: 300, ventes4: 12 } } } }
    const m = monde({ reponses: [ok([])], relance: true, etat })
    m.etat.suivi = { ...suiviVide(), nonVentes: { 'C|Berger allemand': 1 }, finsVues: [] }
    await m.suivi.cycle()
    expect(m.etat.ordres[0]).toMatchObject({ type: 'enchere', idCarteSite: 'card-site-c', rarete: 'C', reductions: 1 })
  })
  it('relance : prix du marché introuvable à la relecture, la carte est écartée un jour sans attente d’échec', async () => {
    const m = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'passee', codeHttp: 404, cause: 'prix du marché indisponible' } })
    await m.suivi.cycle()
    expect(m.etat.lancements[0]).toMatchObject({ resultat: 'echec', cause: 'prix du marché indisponible' })
    expect(Object.keys(m.etat.ecartes)).toContain('ex-c')
    expect(m.etat.statut?.etat).toBe('attente')
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
    m.etat.suiviEtat = { etat: 'pause', message: 'x', jusqua: T0 + 1_800_000, echecs: 0, dernierPassage: null, dernierSucces: null, forceLe: null }
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
  it('autonome : ni la pause de la synchro globale, ni son absence de relevé récent, ne bloquent la lecture', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)])], synchroRecente: false })
    expect(await m.suivi.cycle()).toBe(300_000)
    expect(m.etat.lectures).toBe(1)
    expect(m.etat.verrous).toBe(1)
  })
  it('autonome : la lecture libère son propre bail', async () => {
    const m = monde({ reponses: [ok([])] })
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(1)
    expect(m.bailValeur()).toBeNull()
  })
  it('un lot d’écriture en cours : la lecture attend sa fin (jamais celle de la synchro) et « Forcer » le dit', async () => {
    const m = monde({ reponses: [ok([])], lotEnCours: true })
    expect(await m.suivi.cycle()).toBe(5000)
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(0)
    expect(m.etat.suiviEtat?.message).toContain('lot d’écriture')
  })
  it('« Forcer » ignoré : bail tenu ailleurs ou déjà demandé, le message l’explique', async () => {
    const m = monde({ reponses: [ok([]), ok([])] })
    m.bail(T0 + 60_000)
    await m.suivi.forcer()
    expect(m.etat.suiviEtat?.message).toContain('déjà en cours')
    m.bail(null)
    await m.suivi.forcer()
    await m.suivi.forcer()
    expect(m.etat.suiviEtat?.message).toContain('moins d’une minute')
  })
  it('bail propre tenu par un autre onglet : aucune lecture', async () => {
    const m = monde({ reponses: [ok([])] })
    m.bail(T0 + 60_000)
    expect(await m.suivi.cycle()).toBe(5000)
    expect(m.etat.lectures).toBe(0)
  })
  it('santé : dernier passage et dernier succès sont notés, même après un échec', async () => {
    const m = monde({ reponses: [ok([]), { statut: 500, json: null }] })
    await m.suivi.cycle()
    expect(m.etat.suiviEtat).toMatchObject({ etat: 'ok', dernierPassage: T0, dernierSucces: T0 })
    m.avancer(300_000)
    await m.suivi.cycle()
    expect(m.etat.suiviEtat).toMatchObject({ etat: 'attente', echecs: 1, dernierPassage: T0 + 300_000, dernierSucces: T0 })
  })
  it('« Forcer » : lit tout de suite malgré l’échéance et l’attente, onglet caché compris', async () => {
    const m = monde({ reponses: [ok([vente('a', 3_600_000)]), { statut: 500, json: null }, ok([])], visible: false })
    await m.suivi.cycle(true)
    expect(m.etat.lectures).toBe(1)
    m.avancer(60_001)
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(2)
    expect(m.etat.suiviEtat?.etat).toBe('attente')
    m.avancer(61_000)
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(3)
    expect(m.etat.suiviEtat?.etat).toBe('ok')
  })
  it('« Forcer » : une demande par minute au plus, et jamais deux requêtes en parallèle (bail)', async () => {
    const m = monde({ reponses: [ok([]), ok([]), ok([])] })
    await m.suivi.forcer()
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(1)
  })
  it('« Forcer » passe outre la pause 429 du suivi, pas le verrou de requête', async () => {
    const m = monde({ reponses: [{ statut: 429, json: null }, ok([])] })
    await m.suivi.cycle()
    expect(m.etat.suiviEtat?.etat).toBe('pause')
    expect(await m.suivi.cycle()).toBe(1_800_000)
    m.avancer(61_000)
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(2)
    expect(m.etat.suiviEtat?.etat).toBe('ok')
    expect(m.etat.verrous).toBe(2)
  })
  it('pause du site (401/403/429 de la synchro) : la lecture continue, aucun envoi de relance', async () => {
    const m = monde({ reponses: [ok([])], relance: true, synchroRecente: false })
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(1)
    expect(m.etat.ordres).toHaveLength(0)
  })
  it('429 en lecture puis « Forcer » : la lecture forcée passe, mais aucun envoi pendant la pause', async () => {
    const m = monde({ reponses: [{ statut: 429, json: null }, ok([])], relance: true })
    await m.suivi.cycle()
    m.avancer(61_000)
    await m.suivi.forcer()
    expect(m.etat.lectures).toBe(2)
    expect(m.etat.ordres).toHaveLength(0)
  })
  it('la relance (écriture) passe aussi par le verrou de requête', async () => {
    const m = monde({ reponses: [ok([])], relance: true })
    await m.suivi.cycle()
    expect(m.etat.ordres).toHaveLength(1)
    expect(m.etat.verrous).toBe(2)
  })
  it('la réponse du listing lue par la synchro met le suivi à jour sans requête', async () => {
    const m = monde({ reponses: [] })
    await m.suivi.integrer({ selling: [vente('a', 3_600_000)], history: [], maxConcurrentAuctions: 5 })
    expect(m.etat.suivi.actives).toHaveLength(1)
    expect(m.etat.lectures).toBe(0)
    expect(await m.suivi.cycle()).toBeGreaterThan(200_000)
    expect(m.etat.lectures).toBe(0)
  })
  it('interrupteur du suivi coupé : aucune lecture, état « inactif », réactivable', async () => {
    const m = monde({ reponses: [ok([])], actif: false })
    await m.suivi.cycle()
    expect(m.etat.lectures).toBe(0)
    expect(m.etat.suiviEtat?.etat).toBe('inactif')
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
    expect(m.etat.suiviEtat).toMatchObject({ etat: 'pause', jusqua: T0 + 1_800_000 })
    const r = monde({ reponses: [ok([])], relance: true, resultat: { classe: 'echec', codeHttp: 403, cause: 'réponse hors contrat' } })
    await r.suivi.cycle()
    expect(r.etat.ecartes['ex-c']).toBeGreaterThan(T0)
  })
})
