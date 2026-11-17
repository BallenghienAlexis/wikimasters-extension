import { describe, expect, it } from 'vitest'
import { creerVerrouRequete, type EtatVerrouRequete } from '../../src/lib/verrouRequete'

function banc(depart = 1_000_000) {
  let t = depart
  let stock: EtatVerrouRequete | null = null
  const attendre = async (ms: number): Promise<void> => void (t += ms)
  const creer = (nom: string) =>
    creerVerrouRequete({ now: () => t, attendre, gigue: () => 0, intervalle: 200, lire: async () => stock, ecrire: async (e) => void (stock = e), identifiant: () => nom })
  return { creer, now: () => t, stock: () => stock, poser: (e: EtatVerrouRequete) => void (stock = e) }
}

describe('verrou de requête', () => {
  it('espace deux débuts de requête d’au moins 0,2 s, tous appelants confondus', async () => {
    const b = banc()
    const a = b.creer('a')
    const c = b.creer('c')
    const debuts: number[] = []
    await a(async () => void debuts.push(b.now()))
    await c(async () => void debuts.push(b.now()))
    expect(debuts[1]! - debuts[0]!).toBeGreaterThanOrEqual(200)
  })
  it('libère le verrou, même si la requête échoue', async () => {
    const b = banc()
    await expect(b.creer('a')(async () => { throw new Error('x') })).rejects.toThrow()
    expect(b.stock()?.proprio).toBeNull()
  })
  it('attend un verrou tenu ailleurs puis passe (il expire de lui-même)', async () => {
    const b = banc()
    b.poser({ proprio: 'autre', jusqua: b.now() + 5_000, derniere: b.now() })
    const debut = b.now()
    let parti = 0
    await b.creer('a')(async () => void (parti = b.now()))
    expect(parti - debut).toBeGreaterThanOrEqual(5_000)
  })
  it('deux appels du même onglet ne se chevauchent pas', async () => {
    const b = banc()
    const a = b.creer('a')
    let enVol = 0
    let max = 0
    const tache = async (): Promise<void> => {
      enVol += 1
      max = Math.max(max, enVol)
      await Promise.resolve()
      enVol -= 1
    }
    await Promise.all([a(tache), a(tache), a(tache)])
    expect(max).toBe(1)
  })
})
