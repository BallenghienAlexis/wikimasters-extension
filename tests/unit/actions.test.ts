import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  TYPES_ACTION,
  type Action,
  type CarteEcartee,
  type EntreeJournal,
  type EtatExecution,
  type Lot,
  type RaisonEcart,
  type Registre,
  type ResultatAction,
  type TypeAction,
  type TypesDisponibles,
} from '../../src/lib/actions'

/** Clés qui ne doivent jamais exister dans un type exposé (jeton, en-tête, cookie, corps brut). */
type ClesInterdites = 'jeton' | 'token' | 'headers' | 'entetes' | 'cookie' | 'corps' | 'body'

describe('actions : types partagés', () => {
  it('SC-015 : TYPES_ACTION contient exactement les 6 types', () => {
    expect([...TYPES_ACTION].sort()).toEqual(
      [
        'lecture',
        'creation-etiquette',
        'retrait-etiquette',
        'pose-etiquette',
        'enchere',
        'defausse',
        'suppression-etiquette',
      ].sort(),
    )
    expect(new Set(TYPES_ACTION).size).toBe(7)
  })

  it('SC-015 : TypeAction est l’union des 7 types', () => {
    expectTypeOf<TypeAction>().toEqualTypeOf<
      | 'lecture'
      | 'creation-etiquette'
      | 'retrait-etiquette'
      | 'pose-etiquette'
      | 'enchere'
      | 'defausse'
      | 'suppression-etiquette'
    >()
    expectTypeOf<(typeof TYPES_ACTION)[number]>().toEqualTypeOf<TypeAction>()
  })

  it('SC-015 : Action est discriminée par type et porte idCarte', () => {
    expectTypeOf<Action['type']>().toEqualTypeOf<TypeAction>()
    expectTypeOf<Action>().toHaveProperty('idCarte')
    expectTypeOf<Extract<Action, { type: 'defausse' }>>().toHaveProperty('idExemplaire')
    expectTypeOf<Extract<Action, { type: 'defausse' }>['idExemplaire']>().toEqualTypeOf<string>()
  })

  it('SC-015 : Lot, CarteEcartee, RaisonEcart et TypesDisponibles', () => {
    expectTypeOf<Lot>().toHaveProperty('actions')
    expectTypeOf<Lot>().toHaveProperty('ecartees')
    expectTypeOf<Lot['ecartees']>().items.toEqualTypeOf<CarteEcartee>()
    expectTypeOf<RaisonEcart>().toEqualTypeOf<
      | 'non-reliee'
      | 'identifiant-en-conflit'
      | 'en-attente-place'
      | 'action-non-disponible'
      | 'prix-invalide'
      | 'prix-superieur-valeur'
      | 'valeur-absente'
      | 'nom-trop-long'
      | 'homonyme'
      | 'exemplaires-non-relies'
      | 'valeur-defausse-elevee'
      | 'en-vente-sur-site'
    >()
    expectTypeOf<TypesDisponibles>().toEqualTypeOf<ReadonlySet<TypeAction>>()
    expectTypeOf<EtatExecution>().toBeObject()
  })

  it('SC-015 : ResultatAction a classe, codeHttp nullable et cause', () => {
    expectTypeOf<ResultatAction['classe']>().toEqualTypeOf<
      'reussie' | 'echec' | 'arret' | 'inconnu'
    >()
    expectTypeOf<ResultatAction['codeHttp']>().toEqualTypeOf<number | null>()
    expectTypeOf<ResultatAction>().toHaveProperty('cause')
  })

  it('SC-015 : EntreeJournal sans identifiant d’exemplaire, résultat et code HTTP nullable', () => {
    expectTypeOf<EntreeJournal['resultat']>().toEqualTypeOf<
      'reussie' | 'echouee' | 'passee' | 'interrompue' | 'inconnu' | 'en-cours'
    >()
    expectTypeOf<EntreeJournal['codeHttp']>().toEqualTypeOf<number | null>()
    expectTypeOf<EntreeJournal>().toHaveProperty('horodatage')
    expectTypeOf<EntreeJournal>().toHaveProperty('idCarte')
    expectTypeOf<EntreeJournal>().toHaveProperty('titre')
    expectTypeOf<EntreeJournal>().toHaveProperty('type')
    expectTypeOf<EntreeJournal>().toHaveProperty('idLot')
    expectTypeOf<keyof EntreeJournal & 'idExemplaire'>().toBeNever()
  })

  it('SC-015 : Registre est versionné', () => {
    expectTypeOf<Registre['version']>().toEqualTypeOf<number>()
  })

  it('SC-018 : ResultatAction n’a aucune clé pouvant porter un jeton, en-tête, cookie ou corps', () => {
    expectTypeOf<keyof ResultatAction & ClesInterdites>().toBeNever()
  })

  it('SC-018 : EntreeJournal n’a aucune clé pouvant porter un jeton, en-tête, cookie ou corps', () => {
    expectTypeOf<keyof EntreeJournal & ClesInterdites>().toBeNever()
  })

  it('SC-018 : Action, Registre et EtatExecution n’ont aucune clé interdite', () => {
    expectTypeOf<keyof Action & ClesInterdites>().toBeNever()
    expectTypeOf<keyof Registre & ClesInterdites>().toBeNever()
    expectTypeOf<keyof EtatExecution & ClesInterdites>().toBeNever()
  })
})
