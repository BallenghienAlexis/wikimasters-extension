import { describe, expect, it } from 'vitest'
import { DUREES_SITE_MINUTES, dureeEnchereMinutes, estDureeSite, libelleDuree, niveauAffluence, type EvenementVente } from '../../src/lib/affluence'
import { CONFIG_AFFLUENCE } from '../../src/config/affluence'
import { ENTREES_ENCHERE } from '../../src/lib/contrat/enchere'
import { validerOrdre } from '../../src/lib/messages'
import type { Action } from '../../src/lib/actions'

const EX = '11111111-1111-4111-8111-111111111111'
// Mercredi 2026-11-25 : 13 h est un créneau fort par défaut (12 à 14 h), 16 h un creux modéré, 4 h la nuit.
const forte = new Date(2026, 10, 25, 13, 0).getTime()
const creuse = new Date(2026, 10, 25, 16, 0).getTime()
const nuit = new Date(2026, 10, 25, 4, 0).getTime()
// 20 enchères terminées : 13 h très bien vendues, 16 h jamais vendues (2 mesures au moins par créneau).
const resultats: EvenementVente[] = [
  ...Array.from({ length: 10 }, (_, i): EvenementVente => ({ type: 'resultat', at: new Date(2026, 10, 2 + i, 13, 0).getTime(), poids: 5 })),
  ...Array.from({ length: 10 }, (_, i): EvenementVente => ({ type: 'resultat', at: new Date(2026, 10, 2 + i, 16, 0).getTime(), poids: 0 })),
]

describe('durée d’enchère selon l’affluence', () => {
  it('1 h en heure forte, 3 h en creux modéré, 12 h la nuit', () => {
    expect(dureeEnchereMinutes(forte, [])).toBe(60)
    expect(dureeEnchereMinutes(creuse, [])).toBe(180)
    expect(dureeEnchereMinutes(nuit, [])).toBe(720)
  })
  it('6 h en creux profond : créneau mesuré sans aucune vente', () => {
    expect(niveauAffluence(creuse, resultats)).toBe('creux-profond')
    expect(dureeEnchereMinutes(creuse, resultats)).toBe(360)
    expect(niveauAffluence(forte, resultats)).toBe('forte')
    // Créneau sans mesure : creux modéré, jamais profond.
    expect(niveauAffluence(new Date(2026, 10, 25, 17, 0).getTime(), resultats)).toBe('creuse')
  })
  it('suit les durées de la configuration', () => {
    const config = { ...CONFIG_AFFLUENCE, delaiHeureForte: 0.5, delaiTempsLibre: 6, delaiNuit: 6 }
    expect(dureeEnchereMinutes(forte, [], config)).toBe(30)
    expect(dureeEnchereMinutes(creuse, [], config)).toBe(360)
    expect(dureeEnchereMinutes(nuit, [], config)).toBe(360)
  })
  it('une valeur que le site n’accepte pas retombe sur 1 h', () => {
    expect(dureeEnchereMinutes(creuse, [], { ...CONFIG_AFFLUENCE, delaiTempsLibre: 2 })).toBe(60)
    expect(dureeEnchereMinutes(creuse, [], { ...CONFIG_AFFLUENCE, delaiTempsLibre: Number.NaN })).toBe(60)
  })
  it('la configuration livrée ne propose que des durées du site', () => {
    expect(estDureeSite(CONFIG_AFFLUENCE.delaiHeureForte * 60)).toBe(true)
    expect(estDureeSite(CONFIG_AFFLUENCE.delaiTempsLibre * 60)).toBe(true)
    expect(estDureeSite(CONFIG_AFFLUENCE.delaiCreuxProfond * 60)).toBe(true)
    expect(estDureeSite(CONFIG_AFFLUENCE.delaiNuit * 60)).toBe(true)
    expect(DUREES_SITE_MINUTES).toEqual([10, 30, 60, 180, 360, 720])
  })
  it('libellé lisible', () => {
    expect(libelleDuree(180)).toBe('3 h')
    expect(libelleDuree(30)).toBe('30 min')
  })
})

describe('contrat d’enchère : duration_minutes', () => {
  const corps = (a: Partial<Extract<Action, { type: 'enchere' }>>) =>
    ENTREES_ENCHERE.enchere!.construireCorps({ type: 'enchere', idCarte: 'C|x', idExemplaire: EX, prix: 25, ...a } as Action, { idJoueur: EX, couleurEtiquette: '#112233' })
  it('envoie la durée choisie, 60 par défaut', () => {
    expect(corps({ dureeMinutes: 180 })).toEqual({ card_id: EX, base_amount: 25, duration_minutes: 180 })
    expect(corps({})).toEqual({ card_id: EX, base_amount: 25, duration_minutes: 60 })
  })
  it('n’envoie jamais une durée inconnue du site', () => {
    expect(corps({ dureeMinutes: 90 })).toEqual({ card_id: EX, base_amount: 25, duration_minutes: 60 })
  })
})

describe('message d’ordre : dureeMinutes', () => {
  const ordre = (extra: Record<string, unknown>) => ({ message: 'ordre', ordre: { type: 'enchere', idCarte: 'C|x', idExemplaire: EX, prix: 25, ...extra } })
  it('accepte une durée du site, refuse les autres', () => {
    expect(validerOrdre(ordre({ dureeMinutes: 180 }))).toMatchObject({ dureeMinutes: 180 })
    expect(validerOrdre(ordre({ dureeMinutes: 90 }))).toBeNull()
    expect(validerOrdre(ordre({ dureeMinutes: '180' }))).toBeNull()
  })
})
