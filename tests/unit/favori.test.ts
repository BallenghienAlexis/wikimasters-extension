import { describe, expect, it, vi } from 'vitest'
import type { Action, TypeAction, TypesDisponibles } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { TABLE_CONTRAT } from '../../src/lib/contrat'
import { ENTREES_FAVORI } from '../../src/lib/contrat/favori'
import { familleDe } from '../../src/lib/familles'
import { construireLot, type Config } from '../../src/lib/lot'
import { validerOrdre } from '../../src/lib/messages'
import { creerEmetteur } from '../../src/lib/reseau'
import { registreVide } from '../../src/lib/registre'
import { appliquerResultat, reverifierAction } from '../../src/lib/revision'

// Données fictives.
const EX = '11111111-1111-4111-8111-111111111111'
const CTX = { idJoueur: '33333333-3333-4333-8333-333333333333', couleurEtiquette: '#112233' }
const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }
const TOUS: TypesDisponibles = new Set<TypeAction>(TYPES_ACTION)

const carte = (extra: Partial<Carte> = {}): Carte => ({
  id: 'commune|Berger allemand',
  titre: 'Berger allemand',
  rarete: 'commune',
  description: 'race de chien',
  quantite: 2,
  url: null,
  favori: false,
  idsSite: ['ex-1', 'ex-2'],
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: 10,
  ...extra,
})
const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: null, nomsExistants: [], mesThemes: ['chien'], ...extra })
const favoris = (c: Collection, cfg: Config, dispo = TOUS) => construireLot(c, registreVide(), cfg, dispo).actions.filter((a) => a.type === 'favori')

const action: Action = { type: 'favori', idCarte: 'R|T', idExemplaire: EX }

describe('contrat : mise en favori', () => {
  it('PATCH user_cards filtré par exemplaire, corps starred true seulement, 204 attendu', () => {
    const e = ENTREES_FAVORI.favori!
    expect(e.methode).toBe('PATCH')
    expect(e.construireChemin(action)).toBe(`/rest/v1/user_cards?id=eq.${EX}`)
    expect(e.construireCorps(action, CTX)).toEqual({ starred: true })
    expect(e.validerReponse(204, null)).toBe('reussie')
    expect(e.validerReponse(200, null)).toBe('hors-contrat')
    expect(e.auth).toEqual({ entete: 'session' })
    expect(() => e.construireChemin({ ...action, idExemplaire: 'a&b' } as Action)).toThrow()
    expect(e.construireCorps({ ...action, idExemplaire: 'x' } as Action, CTX)).toBeNull()
  })

  it('est dans la table, famille « favoris », validé par le protocole page ↔ content script', () => {
    expect(TABLE_CONTRAT.favori).toBeDefined()
    expect(familleDe(action)).toBe('favoris')
    expect(validerOrdre({ message: 'ordre', ordre: { ...action } })).toEqual(action)
    expect(validerOrdre({ message: 'ordre', ordre: { ...action, extra: 1 } })).toBeNull()
    expect(validerOrdre({ message: 'ordre', ordre: { type: 'favori', idCarte: 'R|T' } })).toBeNull()
  })
})

describe('reseau : mise en favori', () => {
  it('envoie un PATCH vers l’hôte REST avec le jeton en mémoire, sans cookie, et ne le renvoie jamais', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }))
    const e = creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: 'https://www.wiki-masters.com', session: () => ({ jeton: 'jeton-temoin-fictif', idJoueur: CTX.idJoueur }), fetchImpl: f as unknown as typeof fetch })
    const r = await e(action)
    expect(r).toEqual({ classe: 'reussie', codeHttp: 204, cause: 'action réussie' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://cyrxjeppjqsxxjayfrur.supabase.co/rest/v1/user_cards?id=eq.${EX}`)
    expect(init.method).toBe('PATCH')
    expect(init.credentials).toBe('omit')
    expect(JSON.parse(init.body as string)).toEqual({ starred: true })
    expect(JSON.stringify(r)).not.toContain('jeton-temoin-fictif')
  })
})

describe('lot : mise en favori des cartes de thème gardé', () => {
  it('une action par carte, sur le premier exemplaire', () => {
    expect(favoris(coll(carte()), config())).toEqual([{ type: 'favori', idCarte: 'commune|Berger allemand', idExemplaire: 'ex-1' }])
  })
  it('rien sans thème gardé, ou si le thème ne correspond pas', () => {
    expect(favoris(coll(carte()), config({ mesThemes: [] }))).toHaveLength(0)
    expect(favoris(coll(carte()), config({ mesThemes: undefined }))).toHaveLength(0)
    expect(favoris(coll(carte()), config({ mesThemes: ['voiture'] }))).toHaveLength(0)
  })
  it('jamais pour une carte déjà favorite, à classer, non reliée ou choisie pour la vente', () => {
    expect(favoris(coll(carte({ favori: true })), config())).toHaveLength(0)
    expect(favoris(coll(carte({ titre: 'Zzz', description: 'zzz', etiquettesSite: ['#À classer'] })), config())).toHaveLength(0)
    expect(favoris(coll(carte({ idsSite: null })), config())).toHaveLength(0)
    expect(favoris(coll(carte()), config({ selection: { vendre: ['commune|Berger allemand'], defausser: {} } }))).toHaveLength(0)
  })
  it('rien si l’écriture n’est pas disponible', () => {
    const sans = new Set<TypeAction>(TYPES_ACTION.filter((t) => t !== 'favori'))
    expect(favoris(coll(carte()), config(), sans)).toHaveLength(0)
  })
  it('stable : une fois la carte favorite, un nouveau lot ne redemande rien', () => {
    const apres = appliquerResultat(coll(carte()), registreVide(), { type: 'favori', idCarte: 'commune|Berger allemand', idExemplaire: 'ex-1' }, { classe: 'reussie', codeHttp: 204, cause: 'x' })
    expect(favoris(apres.collection, config())).toHaveLength(0)
  })
})

describe('revision : mise en favori', () => {
  const a: Action = { type: 'favori', idCarte: 'commune|Berger allemand', idExemplaire: 'ex-1' }
  it('revérifiée : ok si non favorite, reliée et de thème gardé ; sinon passée', () => {
    const verif = (c: Carte | null, cfg = config()) => reverifierAction(a, coll(...(c ? [c] : [])), registreVide(), cfg)
    expect(verif(carte())).toBe('ok')
    expect(verif(carte({ favori: true }))).toBe('passee')
    expect(verif(carte({ idsSite: ['ex-2'] }))).toBe('passee')
    expect(verif(carte(), config({ mesThemes: [] }))).toBe('passee')
    expect(verif(carte({ titre: 'Zzz', description: 'zzz' }))).toBe('passee')
    expect(verif(null)).toBe('passee')
  })
  it('succès : la carte devient favorite ; 404 : exemplaire indisponible', () => {
    const ok = appliquerResultat(coll(carte(CHIEN)), registreVide(), a, { classe: 'reussie', codeHttp: 204, cause: 'x' })
    expect(ok.collection.cartes[0]!.favori).toBe(true)
    const ko = appliquerResultat(coll(carte(CHIEN)), registreVide(), a, { classe: 'echec', codeHttp: 404, cause: 'x' })
    expect(ko.collection.cartes[0]!.quantite).toBe(1)
    expect(ko.collection.cartes[0]!.favori).toBe(false)
  })
})
