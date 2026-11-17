// Choix carte par carte des favoris dans l’aperçu (Alexis, 2026-11-17). Données fictives.
import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/lib/actions'
import { basculesApresTout, favorisDecoches, type ActionFavori, cleFavori, propositionsFavori, sansFavorisDecoches } from '../../src/lib/selectionFavoris'

const fav = (idCarte: string, idExemplaire: string, valeur?: boolean): ActionFavori => ({ type: 'favori', idCarte, idExemplaire, ...(valeur === undefined ? {} : { valeur }) }) as ActionFavori
const pose: Action = { type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'x', nomEtiquette: '#Chien' } as Action

const actions: Action[] = [pose, fav('a', 'a1'), fav('b', 'b1', true), fav('c', 'c1', false), fav('c', 'c2', false)]

describe('propositions de favori', () => {
  it('une ligne par carte, avec le sens et l’origine', () => {
    const l = propositionsFavori(actions)
    expect(l.map((p) => [p.idCarte, p.sens, p.origine, p.nbActions])).toEqual([
      ['a', 'pose', 'regle', 1],
      ['b', 'pose', 'choix', 1],
      ['c', 'retrait', 'choix', 2],
    ])
  })
  it('ignore les actions qui ne sont pas des favoris', () => {
    expect(propositionsFavori([pose])).toEqual([])
  })
})

describe('décocher une proposition', () => {
  it('retire seulement les actions décochées (tous les exemplaires de la ligne)', () => {
    const d = new Set([cleFavori(fav('c', 'c1', false))])
    const reste = sansFavorisDecoches(actions, d)
    expect(reste).toHaveLength(3)
    expect(reste.filter((a) => a.type === 'favori').map((a) => a.idCarte)).toEqual(['a', 'b'])
    expect(reste).toContain(pose)
  })
  it('rien décoché : le lot est inchangé', () => {
    expect(sansFavorisDecoches(actions, new Set())).toEqual(actions)
  })
})

describe('état coché par défaut', () => {
  const props = propositionsFavori(actions)
  const [regle, choix, retrait] = props.map((p) => p.cle) as [string, string, string]
  it('la règle est décochée, les choix manuels cochés', () => {
    expect([...favorisDecoches(props, new Set(), new Set())]).toEqual([regle])
  })
  it('une bascule inverse l’état par défaut', () => {
    expect([...favorisDecoches(props, new Set([regle, choix]), new Set())]).toEqual([choix])
  })
  it('une carte « Ne plus proposer » reste décochée même basculée', () => {
    expect([...favorisDecoches(props, new Set([regle]), new Set(['a']))]).toEqual([regle])
  })
  it('tout cocher / tout décocher tient compte de l’état par défaut', () => {
    const tous = props.map((p) => p.cle)
    expect(favorisDecoches(props, basculesApresTout(props, new Set(), tous, true), new Set()).size).toBe(0)
    expect(favorisDecoches(props, basculesApresTout(props, new Set(), tous, false), new Set()).size).toBe(3)
    expect(retrait).toBeDefined()
  })
  it('un lot sans favori décoché envoie la règle seulement une fois cochée', () => {
    expect(sansFavorisDecoches(actions, favorisDecoches(props, new Set(), new Set())).some((a) => a.type === 'favori' && a.idCarte === 'a')).toBe(false)
    expect(sansFavorisDecoches(actions, favorisDecoches(props, new Set([regle]), new Set())).some((a) => a.type === 'favori' && a.idCarte === 'a')).toBe(true)
  })
})
