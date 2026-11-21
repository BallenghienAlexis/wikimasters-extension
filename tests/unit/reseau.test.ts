import { describe, expect, it, vi } from 'vitest'
import { CAUSE_VERIFICATION_HUMAINE, estVerificationHumaine, type Action } from '../../src/lib/actions'
import { TABLE_CONTRAT } from '../../src/lib/contrat'
import { classerConflit, creerEmetteur } from '../../src/lib/reseau'
import { avecIdEtiquette, registreVide, enregistrerEtiquette } from '../../src/lib/registre'

const ORIGINE = 'https://www.wiki-masters.com'
const EX = '11111111-1111-4111-8111-111111111111'
const ET = '22222222-2222-4222-8222-222222222222'
const SESSION = { jeton: 'jeton-temoin-fictif', idJoueur: '33333333-3333-4333-8333-333333333333' }
const pose: Action = { type: 'pose-etiquette', idCarte: 'R|T', idExemplaire: EX, nomEtiquette: 'Garder', idEtiquette: ET }
const creation: Action = { type: 'creation-etiquette', idCarte: 'R|T', nomEtiquette: 'Garder' }

function reponse(status: number, corps = ''): Response {
  return new Response(status === 204 ? null : corps, { status })
}
const emetteur = (fetchImpl: typeof fetch, session: typeof SESSION | null = SESSION, origineOnglet = ORIGINE) =>
  creerEmetteur({ table: TABLE_CONTRAT, origineOnglet, session: () => session, fetchImpl })

describe('reseau : émetteur des étiquettes', () => {
  it('pose : requête vers l’hôte REST avec les en-têtes fixes et le jeton, sans cookie', async () => {
    const f = vi.fn(async () => reponse(201))
    const r = await emetteur(f as unknown as typeof fetch)(pose)
    expect(r).toEqual({ classe: 'reussie', codeHttp: 201, cause: 'action réussie' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://cyrxjeppjqsxxjayfrur.supabase.co/rest/v1/user_card_tags')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('omit')
    expect(init.redirect).toBe('error')
    expect(JSON.parse(init.body as string)).toEqual({ user_card_id: EX, tag_id: ET })
    const h = init.headers as Record<string, string>
    expect(Object.keys(h).sort()).toEqual(['Accept', 'Authorization', 'Content-Profile', 'Content-Type', 'apikey'])
    expect(h.Authorization).toBe(`Bearer ${SESSION.jeton}`)
  })

  it('création : renvoie l’identifiant validé et ajoute user_id depuis la session', async () => {
    const f = vi.fn(async () => reponse(201, JSON.stringify({ id: ET, name: 'Garder' })))
    const r = await emetteur(f as unknown as typeof fetch)(creation)
    expect(r).toEqual({ classe: 'reussie', codeHttp: 201, cause: 'action réussie', idEtiquette: ET })
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(init.body as string).user_id).toBe(SESSION.idJoueur)
    expect((init.headers as Record<string, string>).Prefer).toBe('return=representation')
  })

  it('sans session : arrêt « jeton-absent », aucune requête', async () => {
    const f = vi.fn()
    expect(await emetteur(f as unknown as typeof fetch, null)(pose)).toEqual({ classe: 'arret', codeHttp: null, cause: 'jeton-absent' })
    expect(f).not.toHaveBeenCalled()
  })

  it('onglet d’une autre origine : aucune requête, aucun jeton envoyé', async () => {
    const f = vi.fn()
    const r = await emetteur(f as unknown as typeof fetch, SESSION, 'https://exemple.test')(pose)
    expect(r.cause).toBe('jeton-absent')
    expect(f).not.toHaveBeenCalled()
  })

  it('type absent de la table ou identifiant manquant : action non disponible, aucune requête', async () => {
    const f = vi.fn()
    const e = emetteur(f as unknown as typeof fetch)
    expect((await e({ type: 'inconnu' } as unknown as Action)).cause).toBe('action non disponible')
    expect((await e({ ...pose, idEtiquette: undefined } as Action)).cause).toBe('action non disponible')
    expect(f).not.toHaveBeenCalled()
  })

  it('401, 403, 429 : échec avec le code (la file s’arrête) ; 500 : échec ordinaire', async () => {
    for (const code of [401, 403, 429, 500]) {
      const r = await emetteur((async () => reponse(code, 'secret-du-serveur')) as unknown as typeof fetch)(pose)
      expect(r.classe).toBe('echec')
      expect(r.codeHttp).toBe(code)
      expect(r.cause).not.toContain('secret-du-serveur')
    }
  })

  it('réponse hors contrat : résultat inconnu ; erreur réseau et délai classés à part', async () => {
    expect((await emetteur((async () => reponse(200)) as unknown as typeof fetch)(pose)).cause).toBe('réponse hors contrat')
    expect((await emetteur((async () => reponse(201, '{}')) as unknown as typeof fetch)(creation)).classe).toBe('inconnu')
    expect((await emetteur((async () => { throw new TypeError('x') }) as unknown as typeof fetch)(pose)).cause).toBe('erreur réseau')
    const abandon = (async () => { throw new DOMException('x', 'AbortError') }) as unknown as typeof fetch
    expect((await emetteur(abandon)(pose)).cause).toBe('délai dépassé')
  })

  it('ne lit la session qu’après les contrôles : jamais pour un type absent, une origine étrangère ou un identifiant invalide', async () => {
    const session = vi.fn(() => SESSION)
    const f = vi.fn()
    const e = (origine: string) => creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: origine, session, fetchImpl: f as unknown as typeof fetch })
    await e(ORIGINE)({ type: 'inconnu' } as unknown as Action)
    await e('https://exemple.test')(pose)
    await e(ORIGINE)({ ...pose, idEtiquette: 'a&b' } as Action)
    expect(session).not.toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
  })

  it('non-fuite : le jeton témoin n’apparaît ni dans le résultat, ni dans la console, même si le serveur le renvoie', async () => {
    const espions = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const r = await emetteur((async () => reponse(500, `erreur ${SESSION.jeton}`)) as unknown as typeof fetch)(pose)
    const r2 = await emetteur((async () => reponse(201, JSON.stringify({ id: ET, note: SESSION.jeton }))) as unknown as typeof fetch)(creation)
    expect(JSON.stringify([r, r2])).not.toContain(SESSION.jeton)
    for (const s of espions) expect(s).not.toHaveBeenCalled()
    espions.forEach((s) => s.mockRestore())
  })
})

describe('avecIdEtiquette : enrichissement au moment d’envoyer', () => {
  const registre = enregistrerEtiquette(registreVide(), 'Garder', ET)
  it('ajoute l’identifiant du registre, y compris pour une étiquette créée plus tôt dans le lot', () => {
    expect(avecIdEtiquette({ ...pose, idEtiquette: undefined } as typeof pose, registre)?.idEtiquette).toBe(ET)
  })
  it('renvoie null si le nom est absent ou hérité du prototype', () => {
    expect(avecIdEtiquette({ ...pose, nomEtiquette: 'Autre' }, registre)).toBeNull()
    for (const nom of ['__proto__', 'constructor', 'toString']) expect(avecIdEtiquette({ ...pose, nomEtiquette: nom }, registre)).toBeNull()
  })
  it('création puis pose : le résultat de la création alimente le registre, la pose le retrouve', async () => {
    const { appliquerResultat } = await import('../../src/lib/revision')
    const collection = { version: 2, cartes: [] } as never
    const suivant = appliquerResultat(collection, registreVide(), creation, { classe: 'reussie', codeHttp: 201, cause: 'action réussie', idEtiquette: ET })
    expect(avecIdEtiquette(pose, suivant.registre)?.idEtiquette).toBe(ET)
  })
})

describe('reseau : enchère et défausse sur l’origine du site', () => {
  const enchere: Action = { type: 'enchere', idCarte: 'R|T', idExemplaire: EX, prix: 25 }
  const defausse: Action = { type: 'defausse', idCarte: 'R|T', idExemplaire: EX }

  it('enchère : POST same-origin, seul Content-Type, ni jeton ni clé, corps fixe', async () => {
    const f = vi.fn(async () => reponse(201, JSON.stringify({ auction_id: 'a1' })))
    const sessionLue = vi.fn(() => SESSION)
    const r = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, session: sessionLue, fetchImpl: f as unknown as typeof fetch })(enchere)
    expect(r).toEqual({ classe: 'reussie', codeHttp: 201, cause: 'action réussie' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://www.wiki-masters.com/api/marketplace')
    expect(init.credentials).toBe('same-origin')
    expect(Object.keys(init.headers as Record<string, string>)).toEqual(['Content-Type'])
    expect(JSON.parse(init.body as string)).toEqual({ card_id: EX, base_amount: 25, duration_minutes: 60 })
    expect(sessionLue).not.toHaveBeenCalled()
  })

  it('enchère sans identifiant d’exemplaire valide : action non disponible, aucune requête', async () => {
    const f = vi.fn()
    const r = await emetteur(f as unknown as typeof fetch)({ ...enchere, idExemplaire: 'pas-un-uuid' } as Action)
    expect(r).toEqual({ classe: 'echec', codeHttp: null, cause: 'action non disponible' })
    expect(f).not.toHaveBeenCalled()
  })

  it('défausse : POST sans corps ni en-tête, 200 attendu', async () => {
    const f = vi.fn(async () => reponse(200))
    const r = await emetteur(f as unknown as typeof fetch)(defausse)
    expect(r.classe).toBe('reussie')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://www.wiki-masters.com/api/user-cards/${EX}/discard`)
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({})
    expect(init.credentials).toBe('same-origin')
  })

  it('défausse depuis un autre onglet que le site : refusée', async () => {
    const f = vi.fn()
    const r = await emetteur(f as unknown as typeof fetch, SESSION, 'https://autre.example')(defausse)
    expect(r.cause).toBe('action non disponible')
    expect(f).not.toHaveBeenCalled()
  })

  it.each([401, 403, 429])('%i sur enchère et défausse : échec avec le code, une seule requête chacune', async (code) => {
    for (const ordre of [enchere, defausse]) {
      const f = vi.fn(async () => reponse(code))
      const r = await emetteur(f as unknown as typeof fetch)(ordre)
      expect(r).toMatchObject({ classe: 'echec', codeHttp: code, cause: 'action non disponible' })
      expect(r.diagnostic).toContain(`→ ${code}`)
      expect(f).toHaveBeenCalledTimes(1)
    }
  })

  it('diagnostic d’un refus d’enchère : méthode, chemin, corps (identifiant raccourci), code et message du site', async () => {
    const f = vi.fn(async () => reponse(403, JSON.stringify({ message: 'Carte non disponible', error: 'forbidden' })))
    const r = await emetteur(f as unknown as typeof fetch)(enchere)
    expect(r.diagnostic).toBe('POST /api/marketplace corps {"card_id":"11111111…","base_amount":25,"duration_minutes":60} → 403 Carte non disponible · forbidden')
    // Corps non JSON (page d’erreur) : début du texte, balises retirées.
    const g = vi.fn(async () => reponse(403, '<html><body>Accès refusé</body></html>'))
    expect((await emetteur(g as unknown as typeof fetch)(enchere)).diagnostic).toContain('→ 403 Accès refusé')
  })

  it('le diagnostic ne contient jamais le jeton de session, même renvoyé par le serveur, ni d’en-tête', async () => {
    const f = vi.fn(async () => reponse(403, `refus ${SESSION.jeton}`))
    const r = await emetteur(f as unknown as typeof fetch)(pose)
    expect(r.diagnostic).not.toContain(SESSION.jeton)
    expect(r.diagnostic).toContain('[jeton masqué]')
    expect(r.diagnostic).not.toMatch(/authorization|apikey|bearer/i)
  })
})

describe('reseau : conflit 409 de l’enchère', () => {
  const enchere: Action = { type: 'enchere', idCarte: 'R|T', idExemplaire: EX, prix: 25 }
  it('classe le conflit en libellé fixe ; le corps n’est recopié que dans le diagnostic, champs listés seulement', async () => {
    const limite = vi.fn(async () => reponse(409, JSON.stringify({ message: 'Maximum de 5 enchères actives atteint', secret: 'zzz' })))
    const r1 = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, fetchImpl: limite as unknown as typeof fetch })(enchere)
    expect(r1.cause).toBe('limite d’enchères atteinte')
    expect(r1.cause).not.toContain('Maximum')
    expect(r1.diagnostic).toContain('Maximum de 5 enchères actives atteint')
    expect(r1.diagnostic).not.toContain('zzz')
    expect(JSON.stringify(r1)).not.toContain('"secret"')
    const autre = vi.fn(async () => reponse(409, 'oups'))
    const r2 = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, fetchImpl: autre as unknown as typeof fetch })(enchere)
    expect(r2).toMatchObject({ classe: 'echec', codeHttp: 409, cause: 'conflit signalé par le site' })
  })
  it('classerConflit tolère toute forme de corps', () => {
    for (const j of [null, undefined, 3, 'x', [], {}, { message: 4 }]) expect(classerConflit(j)).toBe('conflit signalé par le site')
  })
})

describe('reseau : vérification anti-bot du site (Alexis, 2026-11-15)', () => {
  const enchere: Action = { type: 'enchere', idCarte: 'commune|Chat', idExemplaire: '11111111-1111-4111-8111-111111111111', prix: 50 }
  const appel = async (corps: string) => {
    const f = vi.fn(async () => new Response(corps, { status: 403, headers: { 'content-type': 'application/json' } }))
    return creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: 'https://www.wiki-masters.com', fetchImpl: f as unknown as typeof fetch })(enchere)
  }
  it('403 + human_verification_required : cause dédiée, diagnostic conservé', async () => {
    const r = await appel(JSON.stringify({ error: 'Vérification anti-bot requise.', code: 'human_verification_required' }))
    expect(r).toMatchObject({ classe: 'echec', codeHttp: 403, cause: CAUSE_VERIFICATION_HUMAINE })
    expect(estVerificationHumaine(r.diagnostic)).toBe(true)
  })
  it('403 ordinaire : cause inchangée', async () => {
    const r = await appel(JSON.stringify({ error: 'Interdit' }))
    expect(r.cause).toBe('action non disponible')
    expect(estVerificationHumaine(r.diagnostic)).toBe(false)
  })
})

describe('reseau : lecture des enchères en cours (marketplace/mine)', () => {
  const lecture: Action = { type: 'lecture', idCarte: 'x' }
  const appeler = async (corps: unknown, statut = 200) => {
    const f = vi.fn(async () => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } }))
    const r = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: 'https://www.wiki-masters.com', fetchImpl: f as unknown as typeof fetch })(lecture)
    return { r, f }
  }
  it('GET sur l’origine du site, sans corps ni en-tête d’authentification, ventes retenues', async () => {
    const { r, f } = await appeler({ maxConcurrentAuctions: 5, sellingCount: 3 })
    expect(r).toMatchObject({ classe: 'reussie', ventes: { enCours: 3, max: 5 } })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://www.wiki-masters.com/api/marketplace/mine')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(Object.keys(init.headers as Record<string, string>)).toEqual([])
  })
  it('réponse de forme inattendue : hors contrat, pas de ventes', async () => {
    const { r } = await appeler({ autre: 1 })
    expect(r.classe).toBe('inconnu')
    expect(r.ventes).toBeUndefined()
  })
})

describe('reseau : enchère avec relecture de la tendance (2026-11-21)', () => {
  const CARTE_SITE = '00000000-0000-4000-8000-000000000001'
  const enchereTendance: Action = { type: 'enchere', idCarte: 'UR|Yoga', idExemplaire: EX, prix: 5, idCarteSite: CARTE_SITE, rarete: 'UR' }
  const lundi = (): string => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10)
  }
  const historique = (avg: number, count = 6) => JSON.stringify({ by_rarity: { UR: { weekly: [{ start: lundi(), avg, min: 2, max: 480, count }], monthly: [] } } })
  const creer = (f: unknown, attendre = vi.fn(async () => undefined)) =>
    creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, fetchImpl: f as typeof fetch, attendre, gigue: () => 7 })

  it('relit price-history puis envoie l’enchère au prix de la tendance, après 0,2 s plus gigue', async () => {
    const f = vi.fn(async (url: string) => (String(url).endsWith('/price-history') ? reponse(200, historique(100)) : reponse(201, JSON.stringify({ auction_id: 'x' }))))
    const attendre = vi.fn(async () => undefined)
    const r = await creer(f, attendre)(enchereTendance)
    expect(r).toMatchObject({ classe: 'reussie', prix: 25 })
    const appels = f.mock.calls as unknown as [string, RequestInit][]
    expect(appels[0]![0]).toBe(`${ORIGINE}/api/marketplace/cards/${CARTE_SITE}/price-history`)
    expect(appels[0]![1].method).toBe('GET')
    expect(appels[0]![1].headers).toBeUndefined()
    expect(appels[0]![1].credentials).toBe('same-origin')
    expect(attendre).toHaveBeenCalledWith(207)
    expect(JSON.parse(appels[1]![1].body as string).base_amount).toBe(25)
  })

  it('garantit 0,2 s plus gigue après le départ de l’enchère avant de rendre la main', async () => {
    const f = vi.fn(async (url: string) => (String(url).endsWith('/price-history') ? reponse(200, historique(100)) : reponse(201, JSON.stringify({ auction_id: 'x' }))))
    const attendre = vi.fn(async () => undefined)
    await creer(f, attendre)(enchereTendance)
    // 1er attendre : entre la relecture et l'envoi ; 2e : après l'envoi (réponse immédiate, donc presque tout l'écart reste à attendre).
    expect(attendre).toHaveBeenCalledTimes(2)
    const reste = (attendre.mock.calls as unknown as number[][])[1]![0]!
    expect(reste).toBeGreaterThan(150)
    expect(reste).toBeLessThanOrEqual(207)
  })

  it('erreur réseau à la relecture : échec ordinaire, rien n’est envoyé', async () => {
    const f = vi.fn(async () => { throw new TypeError('réseau') })
    expect(await creer(f)(enchereTendance)).toMatchObject({ classe: 'echec', cause: 'erreur réseau' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('divise le prix relu par deux autant de fois que de non-ventes', async () => {
    const f = vi.fn(async (url: string) => (String(url).endsWith('/price-history') ? reponse(200, historique(100)) : reponse(201, JSON.stringify({ auction_id: 'x' }))))
    const r = await creer(f)({ ...enchereTendance, reductions: 2 } as Action)
    expect(r).toMatchObject({ classe: 'reussie', prix: 6 })
  })

  it('prix cible du joueur (prixFixe) ou ordre sans carte du site : aucune relecture', async () => {
    const f = vi.fn(async () => reponse(201, JSON.stringify({ auction_id: 'x' })))
    await creer(f)({ ...enchereTendance, prix: 12, prixFixe: true } as Action)
    await creer(f)({ type: 'enchere', idCarte: 'UR|Yoga', idExemplaire: EX, prix: 12 })
    expect(f).toHaveBeenCalledTimes(2)
    expect((f.mock.calls as unknown as [string][]).every(([u]) => !String(u).includes('price-history'))).toBe(true)
  })

  it('prix du marché introuvable, vide ou trop bas : enchère passée, jamais envoyée', async () => {
    for (const r of [reponse(404), reponse(200, JSON.stringify({ by_rarity: {} })), reponse(200, historique(5))]) {
      const f = vi.fn(async () => r.clone())
      const res = await creer(f)(enchereTendance)
      expect(res.classe).toBe('passee')
      expect(f).toHaveBeenCalledTimes(1)
    }
  })

  it('401, 429 et vérification anti-bot à la relecture : échec comme pour toute requête, rien n’est envoyé', async () => {
    for (const [r, cause] of [
      [reponse(401), 'action non disponible'],
      [reponse(429), 'action non disponible'],
      [reponse(403, JSON.stringify({ code: 'human_verification_required' })), CAUSE_VERIFICATION_HUMAINE],
    ] as const) {
      const f = vi.fn(async () => r.clone())
      expect(await creer(f)(enchereTendance)).toMatchObject({ classe: 'echec', cause })
      expect(f).toHaveBeenCalledTimes(1)
    }
  })

  it('autre origine que le site : aucune requête', async () => {
    const f = vi.fn()
    const e = creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: 'https://autre.example', fetchImpl: f as unknown as typeof fetch, attendre: async () => undefined })
    expect(await e(enchereTendance)).toEqual({ classe: 'echec', codeHttp: null, cause: 'action non disponible' })
    expect(f).not.toHaveBeenCalled()
  })
})
