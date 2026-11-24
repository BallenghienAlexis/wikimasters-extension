import { describe, expect, it } from 'vitest'
import { correspondAuFiltreGarde, filtreGardeAmi, FILTRE_GARDE_MOI } from '../../src/lib/selectionLot'
import type { Verdict } from '../../src/lib/selectionLot'

const v = (action: Verdict['action'], code: Verdict['code'], amis: string[] = []): Verdict => ({ action, code, motif: '', court: '', libelle: '', exemplaires: 1, amis })

describe('filtre « cartes gardées »', () => {
  it('« Mes cartes » : favori et thème gardé seulement', () => {
    expect(correspondAuFiltreGarde(v('garder', 'favori'), FILTRE_GARDE_MOI)).toBe(true)
    expect(correspondAuFiltreGarde(v('garder', 'theme-garde'), FILTRE_GARDE_MOI)).toBe(true)
    expect(correspondAuFiltreGarde(v('garder', 'ami', ['Quentin']), FILTRE_GARDE_MOI)).toBe(false)
    expect(correspondAuFiltreGarde(v('garder', 'valeur-inconnue'), FILTRE_GARDE_MOI)).toBe(false)
    expect(correspondAuFiltreGarde(v('vendre', 'enchere'), FILTRE_GARDE_MOI)).toBe(false)
    expect(correspondAuFiltreGarde(undefined, FILTRE_GARDE_MOI)).toBe(false)
  })
  it('un ami : cartes gardées pour cet ami', () => {
    const x = v('garder', 'ami', ['Quentin', 'Anatole'])
    expect(correspondAuFiltreGarde(x, filtreGardeAmi('Quentin'))).toBe(true)
    expect(correspondAuFiltreGarde(x, filtreGardeAmi('Anatole'))).toBe(true)
    expect(correspondAuFiltreGarde(x, filtreGardeAmi('Benjamin'))).toBe(false)
    expect(correspondAuFiltreGarde(v('garder', 'theme-garde'), filtreGardeAmi('Quentin'))).toBe(false)
  })
})
