import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/lib/actions'
import { avecIdCardSite } from '../../src/lib/idCardSite'

const enchere: Action = { type: 'enchere', idCarte: 'commune|Chat', idExemplaire: 'ex-1', prix: 5 }

describe('avecIdCardSite', () => {
  it('ajoute le card_id connu', () => {
    expect(avecIdCardSite(enchere, { 'commune|Chat': 'card-1' })).toEqual({ ...enchere, idCardSite: 'card-1' })
  })
  it('renvoie null sans card_id (état absent, carte inconnue, valeur vide, clé héritée)', () => {
    expect(avecIdCardSite(enchere, undefined)).toBeNull()
    expect(avecIdCardSite(enchere, {})).toBeNull()
    expect(avecIdCardSite(enchere, { 'commune|Chat': '' })).toBeNull()
    expect(avecIdCardSite({ ...enchere, idCarte: 'toString' }, {})).toBeNull()
  })
  it('laisse les autres actions inchangées', () => {
    const d: Action = { type: 'defausse', idCarte: 'commune|Chat', idExemplaire: 'ex-1' }
    expect(avecIdCardSite(d, undefined)).toBe(d)
  })
})
