import { describe, expect, it } from 'vitest'
import {
  couplesDe,
  enregistrerEtiquette,
  poserCouple,
  purgerCarte,
  purgerExemplaire,
  registreVide,
  retirerCouple,
  validerRegistre,
} from '../../src/lib/registre'

describe('registre : ajout, retrait, purge', () => {
  it('démarre vide', () => {
    expect(registreVide()).toEqual({ version: 1, etiquettes: {}, couples: [] })
  })

  it('enregistre une étiquette et pose des couples', () => {
    let r = enregistrerEtiquette(registreVide(), 'Garder', 'et-1')
    r = poserCouple(r, 'ex-1', 'Garder')
    expect(r.etiquettes).toEqual({ Garder: 'et-1' })
    expect(couplesDe(r, 'ex-1')).toEqual([{ ex: 'ex-1', nom: 'Garder' }])
    expect(couplesDe(r, 'ex-2')).toEqual([])
  })

  it('ne duplique pas un couple déjà posé', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-1', 'A')
    expect(r.couples).toHaveLength(1)
  })

  it('retire un couple', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-1', 'B')
    r = retirerCouple(r, 'ex-1', 'A')
    expect(couplesDe(r, 'ex-1')).toEqual([{ ex: 'ex-1', nom: 'B' }])
  })

  it('purge un exemplaire et une carte', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-2', 'A')
    r = poserCouple(r, 'ex-3', 'A')
    expect(purgerExemplaire(r, 'ex-1').couples.map((c) => c.ex)).toEqual(['ex-2', 'ex-3'])
    expect(purgerCarte(r, ['ex-1', 'ex-3']).couples.map((c) => c.ex)).toEqual(['ex-2'])
  })
})

describe('registre : borne de 2 couples par exemplaire', () => {
  it('refuse un 3e couple pour un même exemplaire', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-1', 'B')
    const apres = poserCouple(r, 'ex-1', 'C')
    expect(apres).toBe(r)
    expect(couplesDe(apres, 'ex-1')).toHaveLength(2)
  })

  it('accepte 2 couples pour un autre exemplaire', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-1', 'B')
    r = poserCouple(r, 'ex-2', 'A')
    expect(r.couples).toHaveLength(3)
  })

  it('refuse les identifiants vides ou trop longs', () => {
    const r = registreVide()
    expect(poserCouple(r, '', 'A')).toBe(r)
    expect(poserCouple(r, 'x'.repeat(201), 'A')).toBe(r)
    expect(enregistrerEtiquette(r, 'A', '')).toBe(r)
    expect(enregistrerEtiquette(r, '', 'et')).toBe(r)
  })
})

describe('validerRegistre', () => {
  it('accepte un registre valide et reconstruit champ par champ', () => {
    const brut = {
      version: 1,
      etiquettes: { A: 'et-1' },
      couples: [{ ex: 'ex-1', nom: 'A', parasite: 'x' }],
      jeton: 'secret',
    }
    const r = validerRegistre(brut)
    expect(r).toEqual({
      version: 1,
      etiquettes: { A: 'et-1' },
      couples: [{ ex: 'ex-1', nom: 'A' }],
    })
    expect(JSON.stringify(r)).not.toContain('secret')
    expect(JSON.stringify(r)).not.toContain('parasite')
    expect(brut.couples[0]).toHaveProperty('parasite')
  })

  it.each([
    null,
    undefined,
    'texte',
    42,
    [],
    {},
    { version: 2, etiquettes: {}, couples: [] },
    { version: 1, etiquettes: [], couples: [] },
    { version: 1, etiquettes: { A: 3 }, couples: [] },
    { version: 1, etiquettes: { A: '' }, couples: [] },
    { version: 1, etiquettes: {}, couples: {} },
    { version: 1, etiquettes: {}, couples: [null] },
    { version: 1, etiquettes: {}, couples: [{ ex: '', nom: 'A' }] },
    { version: 1, etiquettes: {}, couples: [{ ex: 'e', nom: 'x'.repeat(201) }] },
    {
      version: 1,
      etiquettes: {},
      couples: [
        { ex: 'e', nom: 'A' },
        { ex: 'e', nom: 'B' },
        { ex: 'e', nom: 'C' },
      ],
    },
  ])('renvoie null pour %j', (brut) => {
    expect(validerRegistre(brut)).toBeNull()
  })
})

describe('immuabilité', () => {
  it('ne modifie jamais le registre reçu', () => {
    const r = poserCouple(enregistrerEtiquette(registreVide(), 'A', 'et'), 'ex-1', 'A')
    const copie = JSON.parse(JSON.stringify(r))
    enregistrerEtiquette(r, 'B', 'et-2')
    poserCouple(r, 'ex-2', 'A')
    retirerCouple(r, 'ex-1', 'A')
    purgerExemplaire(r, 'ex-1')
    purgerCarte(r, ['ex-1'])
    expect(r).toEqual(copie)
  })
})
