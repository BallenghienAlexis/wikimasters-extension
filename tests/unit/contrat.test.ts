import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TABLE_CONTRAT,
  typesDisponibles,
  type EntreeContrat,
  type TableContrat,
} from '../../src/lib/contrat'
import { ENTREES_DEFAUSSE } from '../../src/lib/contrat/defausse'
import { ENTREES_ENCHERE } from '../../src/lib/contrat/enchere'
import { ENTREES_ETIQUETTES } from '../../src/lib/contrat/etiquettes'
import { ENTREES_LECTURE } from '../../src/lib/contrat/lecture'

const entreeFictive: EntreeContrat = {
  methode: 'POST',
  modeleChemin: '/fictif/{id}',
  construireChemin: () => '/fictif/x',
  construireCorps: () => null,
  auth: null,
  validerReponse: (statut) => (statut === 200 ? 'reussie' : 'hors-contrat'),
}

describe('table du contrat', () => {
  it('est livrée vide : aucun type disponible (SC-020)', () => {
    expect(Object.keys(TABLE_CONTRAT)).toHaveLength(0)
    expect(typesDisponibles().size).toBe(0)
    for (const e of [ENTREES_DEFAUSSE, ENTREES_ENCHERE, ENTREES_ETIQUETTES, ENTREES_LECTURE]) {
      expect(Object.keys(e)).toHaveLength(0)
    }
  })

  it('ne renvoie que les types présents dans une table injectée', () => {
    const table: TableContrat = { defausse: entreeFictive, enchere: entreeFictive }
    const dispo = typesDisponibles(table)
    expect([...dispo].sort()).toEqual(['defausse', 'enchere'])
    expect(dispo.has('lecture')).toBe(false)
  })

  it('ne contient aucune URL dans contrat.ts', () => {
    const source = readFileSync('src/lib/contrat.ts', 'utf8')
    expect(source).not.toContain('/api/')
    expect(source).not.toContain('/rest/')
  })
})
