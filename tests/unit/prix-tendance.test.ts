import { describe, expect, it } from 'vitest'
import { prixDepartSelonTendance } from '../../src/lib/prixTendance'
import type { TendancePrix } from '../../src/lib/lectureApi'

const t = (surcharge: Partial<TendancePrix> = {}): TendancePrix => ({ variationPct: 0, min4: 10, max4: 400, ventes4: 10, ...surcharge })

describe('prixDepartSelonTendance', () => {
  it('règle de base : 25 % du prix moyen de la semaine, sans tendance ou tendance stable', () => {
    expect(prixDepartSelonTendance(100, null)).toEqual({ prix: 25, motif: 'normal' })
    expect(prixDepartSelonTendance(100, t({ variationPct: 10 }))).toEqual({ prix: 25, motif: 'normal' })
    expect(prixDepartSelonTendance(100, t({ variationPct: null }))).toEqual({ prix: 25, motif: 'normal' })
  })
  it('hausse de 25 % ou plus : on ne poursuit pas la hausse (référence à mi-chemin avec la semaine d’avant)', () => {
    // 100 pour +100 % : semaine d’avant = 50, référence 75, départ 18 (au lieu de 25)
    expect(prixDepartSelonTendance(100, t({ variationPct: 100 }))).toEqual({ prix: 18, motif: 'hausse' })
    expect(prixDepartSelonTendance(100, t({ variationPct: 24 }))?.motif).toBe('normal')
  })
  it('baisse de 25 % ou plus : départ plus bas (15 %)', () => {
    expect(prixDepartSelonTendance(100, t({ variationPct: -30 }))).toEqual({ prix: 15, motif: 'baisse' })
    expect(prixDepartSelonTendance(100, t({ variationPct: -24 }))?.motif).toBe('normal')
  })
  it('peu de ventes : la référence est à mi-chemin entre le plus bas de la fourchette et la moyenne', () => {
    expect(prixDepartSelonTendance(100, t({ ventes4: 2, min4: 20 }))).toEqual({ prix: 15, motif: 'peu-de-ventes' })
  })
  it('jamais sous 1, jamais au niveau de la valeur du marché, rien sous la valeur minimale de vente', () => {
    expect(prixDepartSelonTendance(6, null)).toEqual({ prix: 1, motif: 'normal' })
    expect(prixDepartSelonTendance(5, null)).toBeNull()
    expect(prixDepartSelonTendance(Number.NaN, null)).toBeNull()
  })
})
