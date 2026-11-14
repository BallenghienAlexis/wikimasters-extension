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
    expect(registreVide()).toEqual({ version: 2, etiquettes: {}, couples: [] })
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

describe('registre : plus de plafond de 2 couples (SC-013)', () => {
  it('accepte un 3e couple pour un même exemplaire', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A')
    r = poserCouple(r, 'ex-1', 'B')
    r = poserCouple(r, 'ex-1', 'C')
    expect(couplesDe(r, 'ex-1')).toHaveLength(3)
  })

  it('accepte jusqu’à 12 couples et plus', () => {
    let r = registreVide()
    for (let i = 0; i < 12; i++) r = poserCouple(r, 'ex-1', `N${i}`)
    expect(couplesDe(r, 'ex-1')).toHaveLength(12)
  })

  it('refuse un couple au-delà de la limite du site, si elle est connue', () => {
    let r = poserCouple(registreVide(), 'ex-1', 'A', 2)
    r = poserCouple(r, 'ex-1', 'B', 2)
    const apres = poserCouple(r, 'ex-1', 'C', 2)
    expect(apres).toBe(r)
    expect(poserCouple(r, 'ex-1', 'C', null)).not.toBe(r)
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
      version: 2,
      etiquettes: { A: 'et-1' },
      couples: [{ ex: 'ex-1', nom: 'A', parasite: 'x' }],
      jeton: 'secret',
    }
    const r = validerRegistre(brut)
    expect(r).toEqual({
      version: 2,
      etiquettes: { A: 'et-1' },
      couples: [{ ex: 'ex-1', nom: 'A' }],
    })
    expect(JSON.stringify(r)).not.toContain('secret')
    expect(JSON.stringify(r)).not.toContain('parasite')
    expect(brut.couples[0]).toHaveProperty('parasite')
  })

  it.each(['__proto__', 'constructor', 'prototype', 'toString'])(
    'conserve le nom d’étiquette « %s » sans l’hériter ni le perdre',
    (nom) => {
      const brut = JSON.parse(`{"version":1,"etiquettes":{"${nom}":"et-9"},"couples":[]}`)
      const r = validerRegistre(brut)
      expect(r).not.toBeNull()
      expect(Object.hasOwn(r!.etiquettes, nom)).toBe(true)
      expect(r!.etiquettes[nom]).toBe('et-9')
      expect(Object.getPrototypeOf(r!.etiquettes)).toBeNull()
    },
  )

  it.each(['__proto__', 'constructor', 'prototype'])('enregistrerEtiquette garde « %s » comme simple clé', (nom) => {
    const r = enregistrerEtiquette(registreVide(), nom, 'et-1')
    expect(Object.hasOwn(r.etiquettes, nom)).toBe(true)
    expect(r.etiquettes[nom]).toBe('et-1')
    expect(Object.getPrototypeOf(r.etiquettes)).toBeNull()
    expect(Object.getPrototypeOf(Object.prototype)).toBeNull()
  })

  it('rejette un couple { ex, nom } en double', () => {
    const doublon = {
      version: 1,
      etiquettes: {},
      couples: [
        { ex: 'e', nom: 'A' },
        { ex: 'e', nom: 'A' },
      ],
    }
    expect(validerRegistre(doublon)).toBeNull()
  })

  it.each([
    null,
    undefined,
    'texte',
    42,
    [],
    {},
    { version: 4, etiquettes: {}, couples: [] },
    { version: 0, etiquettes: {}, couples: [] },
    { version: 1, etiquettes: [], couples: [] },
    { version: 1, etiquettes: { A: 3 }, couples: [] },
    { version: 1, etiquettes: { A: '' }, couples: [] },
    { version: 1, etiquettes: {}, couples: {} },
    { version: 1, etiquettes: {}, couples: [null] },
    { version: 1, etiquettes: {}, couples: [{ ex: '', nom: 'A' }] },
    { version: 1, etiquettes: {}, couples: [{ ex: 'e', nom: 'x'.repeat(201) }] },
    {
      version: 2,
      etiquettes: {},
      couples: Array.from({ length: 257 }, (_, i) => ({ ex: 'e', nom: `N${i}` })),
    },
  ])('renvoie null pour %j', (brut) => {
    expect(validerRegistre(brut)).toBeNull()
  })
})

describe('immuabilité', () => {
  it('ne modifie jamais le registre reçu', () => {
    const r = poserCouple(enregistrerEtiquette(registreVide(), 'A', 'et'), 'ex-1', 'A')
    const copie = structuredClone(r)
    enregistrerEtiquette(r, 'B', 'et-2')
    poserCouple(r, 'ex-2', 'A')
    retirerCouple(r, 'ex-1', 'A')
    purgerExemplaire(r, 'ex-1')
    purgerCarte(r, ['ex-1'])
    expect(r).toEqual(copie)
  })

  it('validerRegistre n’altère pas son entrée (cas valide)', () => {
    const brut = { version: 1, etiquettes: { A: 'et-1' }, couples: [{ ex: 'e', nom: 'A', parasite: 1 }] }
    const copie = structuredClone(brut)
    expect(validerRegistre(brut)).not.toBeNull()
    expect(brut).toEqual(copie)
  })

  it('validerRegistre n’altère pas son entrée (cas rejeté)', () => {
    const brut = {
      version: 1,
      etiquettes: { A: 'et-1' },
      couples: [
        { ex: 'e', nom: 'A' },
        { ex: 'e', nom: 'A' },
      ],
    }
    const copie = structuredClone(brut)
    expect(validerRegistre(brut)).toBeNull()
    expect(brut).toEqual(copie)
  })
})

describe('migration v1 → v2 et bornes (SC-013, SC-018)', () => {
  const v1 = {
    version: 1,
    etiquettes: { 'Statut · Garder': 'et-1', '#Chien': 'et-2' },
    couples: [
      { ex: 'ex-1', nom: 'Statut · Garder' },
      { ex: 'ex-1', nom: '#Chien' },
      { ex: 'ex-2', nom: 'Statut · Garder' },
    ],
  }

  it('lit un registre v1 et le migre en v2 sans perte', () => {
    const r = validerRegistre(v1)
    expect(r).not.toBeNull()
    expect(r!.version).toBe(2)
    expect(r!.etiquettes).toEqual(v1.etiquettes)
    expect(r!.couples).toEqual(v1.couples)
  })

  it('est idempotente', () => {
    const une = validerRegistre(v1)!
    const deux = validerRegistre(une)!
    expect(deux).toEqual(une)
  })

  it('ne modifie pas l’entrée v1', () => {
    const copie = JSON.stringify(v1)
    validerRegistre(v1)
    expect(JSON.stringify(v1)).toBe(copie)
  })

  it('accepte 256 couples par exemplaire et rejette 257', () => {
    const faire = (n: number) => ({
      version: 2,
      etiquettes: {},
      couples: Array.from({ length: n }, (_, i) => ({ ex: 'e', nom: `N${i}` })),
    })
    expect(validerRegistre(faire(256))).not.toBeNull()
    expect(validerRegistre(faire(257))).toBeNull()
  })

  it('rejette une version inconnue sans rien écraser', () => {
    expect(validerRegistre({ ...v1, version: 4 })).toBeNull()
  })

  it('pèse au plus 5 Mo pour 5 000 exemplaires à 12 couples', () => {
    const etiquettes: Record<string, string> = {}
    const noms = Array.from({ length: 12 }, (_, i) => `#Nom d’étiquette fictif ${String(i).padStart(2, '0')}`.slice(0, 25))
    for (const nom of noms) etiquettes[nom] = 'e'.repeat(36)
    const couples = []
    for (let i = 0; i < 5000; i++) for (const nom of noms) couples.push({ ex: `${String(i).padStart(36, 'x')}`, nom })
    const taille = new TextEncoder().encode(JSON.stringify({ version: 2, etiquettes, couples })).length
    expect(taille).toBeLessThanOrEqual(5 * 1024 * 1024)
  })
})
