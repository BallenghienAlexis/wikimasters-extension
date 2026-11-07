import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Action, ResultatAction } from '../../src/lib/actions'
import {
  messageArret,
  messageBonjour,
  messageOrdre,
  messageResultat,
  validerOrdre,
  validerResultat,
  type MessagePort,
} from '../../src/lib/messages'

const ordreDefausse = {
  message: 'ordre',
  ordre: { type: 'defausse', idCarte: 'rare|Carte', idExemplaire: 'ex-1' },
}
const resultatOk = {
  message: 'resultat',
  resultat: { classe: 'reussie', codeHttp: 200, cause: 'Action réussie' },
}

describe('validerOrdre', () => {
  it('accepte un ordre valide de chaque type', () => {
    const ordres: Action[] = [
      { type: 'lecture', idCarte: 'a|b' },
      { type: 'creation-etiquette', idCarte: 'a|b', nomEtiquette: 'Vente' },
      { type: 'retrait-etiquette', idCarte: 'a|b', idExemplaire: 'e1', nomEtiquette: 'Vente' },
      { type: 'pose-etiquette', idCarte: 'a|b', idExemplaire: 'e1', nomEtiquette: 'Vente' },
      { type: 'enchere', idCarte: 'a|b', idExemplaire: 'e1', prix: 120 },
      { type: 'defausse', idCarte: 'a|b', idExemplaire: 'e1' },
    ]
    for (const ordre of ordres) {
      expect(validerOrdre(messageOrdre(ordre))).toEqual(ordre)
    }
    expect(validerOrdre(ordreDefausse)).toEqual(ordreDefausse.ordre)
  })

  it('rejette un champ parasite (headers, token) dans l’ordre ou l’enveloppe', () => {
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...ordreDefausse.ordre, headers: {} } })).toBeNull()
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...ordreDefausse.ordre, token: 'x' } })).toBeNull()
    expect(validerOrdre({ ...ordreDefausse, token: 'x' })).toBeNull()
  })

  it('rejette un type inconnu', () => {
    expect(validerOrdre({ message: 'ordre', ordre: { type: 'virement', idCarte: 'a|b' } })).toBeNull()
  })

  it('rejette un champ manquant ou d’un mauvais type', () => {
    expect(validerOrdre({ message: 'ordre', ordre: { type: 'defausse', idCarte: 'a|b' } })).toBeNull()
    expect(
      validerOrdre({ message: 'ordre', ordre: { type: 'enchere', idCarte: 'a|b', idExemplaire: 'e', prix: '12' } }),
    ).toBeNull()
    expect(
      validerOrdre({ message: 'ordre', ordre: { type: 'enchere', idCarte: 'a|b', idExemplaire: 'e', prix: -1 } }),
    ).toBeNull()
    expect(
      validerOrdre({ message: 'ordre', ordre: { type: 'enchere', idCarte: 'a|b', idExemplaire: 'e', prix: NaN } }),
    ).toBeNull()
  })

  it('rejette un identifiant vide ou de plus de 200 caractères', () => {
    const base = ordreDefausse.ordre
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...base, idExemplaire: '' } })).toBeNull()
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...base, idExemplaire: 'x'.repeat(201) } })).toBeNull()
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...base, idExemplaire: 'x'.repeat(200) } })).not.toBeNull()
    expect(validerOrdre({ ...ordreDefausse, ordre: { ...base, idCarte: '' } })).toBeNull()
  })

  it('rejette ce qui n’est pas un ordre', () => {
    for (const brut of [null, undefined, 3, 'ordre', [], {}, resultatOk, { message: 'ordre' }]) {
      expect(validerOrdre(brut)).toBeNull()
    }
  })
})

describe('validerResultat', () => {
  it('accepte un résultat valide', () => {
    expect(validerResultat(resultatOk)).toEqual(resultatOk.resultat)
    const sansCode = { message: 'resultat', resultat: { classe: 'inconnu', codeHttp: null, cause: 'x' } }
    expect(validerResultat(sansCode)).toEqual(sansCode.resultat)
    for (const classe of ['reussie', 'echec', 'arret', 'inconnu']) {
      expect(validerResultat({ message: 'resultat', resultat: { ...resultatOk.resultat, classe } })).not.toBeNull()
    }
  })

  it('rejette un résultat avec corps brut ou champ parasite', () => {
    expect(validerResultat({ ...resultatOk, resultat: { ...resultatOk.resultat, corps: '{}' } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...resultatOk.resultat, headers: {} } })).toBeNull()
    expect(validerResultat({ ...resultatOk, corps: 'x' })).toBeNull()
  })

  it('rejette une classe, un code ou une cause invalides', () => {
    const r = resultatOk.resultat
    expect(validerResultat({ ...resultatOk, resultat: { ...r, classe: 'ok' } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...r, codeHttp: 200.5 } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...r, codeHttp: 42 } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...r, codeHttp: '200' } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...r, cause: '' } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { ...r, cause: 'x'.repeat(201) } })).toBeNull()
    expect(validerResultat({ ...resultatOk, resultat: { classe: 'reussie', codeHttp: 200 } })).toBeNull()
  })

  it('rejette ce qui n’est pas un résultat', () => {
    for (const brut of [null, undefined, 3, [], {}, ordreDefausse]) {
      expect(validerResultat(brut)).toBeNull()
    }
  })
})

describe('constructeurs', () => {
  it('produisent des messages que la validation relit à l’identique', () => {
    const resultat: ResultatAction = { classe: 'echec', codeHttp: 429, cause: 'Trop de requêtes' }
    expect(validerResultat(messageResultat(resultat))).toEqual(resultat)
    expect(messageBonjour()).toEqual({ message: 'bonjour' })
    expect(messageArret()).toEqual({ message: 'arret' })
  })
})

describe('types du protocole (AC3)', () => {
  it('n’a aucun champ libre', () => {
    expectTypeOf<MessagePort>().not.toBeAny()
    type Champs = MessagePort extends infer M ? (M extends object ? M[keyof M] : never) : never
    expectTypeOf<unknown>().not.toMatchTypeOf<Champs>()
    expectTypeOf<Champs>().not.toBeUnknown()
    expectTypeOf<Champs>().not.toBeAny()
    expectTypeOf<Record<string, unknown>>().not.toMatchTypeOf<MessagePort>()
  })
})
