import { describe, expect, it, vi } from 'vitest'
import type { Action } from '../../src/lib/actions'
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
    expect((await e({ type: 'lecture' } as unknown as Action)).cause).toBe('action non disponible')
    expect((await e({ ...pose, idEtiquette: undefined } as Action)).cause).toBe('action non disponible')
    expect(f).not.toHaveBeenCalled()
  })

  it('401, 403, 429 : échec avec le code (la file s’arrête) ; 500 : échec ordinaire', async () => {
    for (const code of [401, 403, 429, 500]) {
      const r = await emetteur((async () => reponse(code, 'secret-du-serveur')) as unknown as typeof fetch)(pose)
      expect(r.classe).toBe('echec')
      expect(r.codeHttp).toBe(code)
      expect(JSON.stringify(r)).not.toContain('secret-du-serveur')
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
    await e(ORIGINE)({ type: 'lecture' } as unknown as Action)
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
  const CARD = '44444444-4444-4444-8444-444444444444'
  const enchere: Action = { type: 'enchere', idCarte: 'R|T', idExemplaire: EX, prix: 25, idCardSite: CARD }
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
    expect(JSON.parse(init.body as string)).toEqual({ card_id: CARD, base_amount: 25, duration_minutes: 60 })
    expect(sessionLue).not.toHaveBeenCalled()
  })

  it('enchère sans card_id : action non disponible, aucune requête', async () => {
    const f = vi.fn()
    const { idCardSite: _omis, ...sans } = enchere as Extract<Action, { type: 'enchere' }>
    void _omis
    const r = await emetteur(f as unknown as typeof fetch)(sans)
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
      expect(r).toEqual({ classe: 'echec', codeHttp: code, cause: 'action non disponible' })
      expect(f).toHaveBeenCalledTimes(1)
    }
  })
})

describe('reseau : conflit 409 de l’enchère', () => {
  const CARD = '44444444-4444-4444-8444-444444444444'
  const enchere: Action = { type: 'enchere', idCarte: 'R|T', idExemplaire: EX, prix: 25, idCardSite: CARD }
  it('classe le conflit en libellé fixe, sans recopier le corps', async () => {
    const limite = vi.fn(async () => reponse(409, JSON.stringify({ message: 'Maximum de 5 enchères actives atteint', secret: 'zzz' })))
    const r1 = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, fetchImpl: limite as unknown as typeof fetch })(enchere)
    expect(r1).toEqual({ classe: 'echec', codeHttp: 409, cause: 'limite d’enchères atteinte' })
    const autre = vi.fn(async () => reponse(409, 'oups'))
    const r2 = await creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: ORIGINE, fetchImpl: autre as unknown as typeof fetch })(enchere)
    expect(r2).toEqual({ classe: 'echec', codeHttp: 409, cause: 'conflit signalé par le site' })
  })
  it('classerConflit tolère toute forme de corps', () => {
    for (const j of [null, undefined, 3, 'x', [], {}, { message: 4 }]) expect(classerConflit(j)).toBe('conflit signalé par le site')
  })
})
