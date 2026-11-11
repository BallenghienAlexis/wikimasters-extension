import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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

const lireSource = (relatif: string): string => readFileSync(fileURLToPath(new URL(relatif, import.meta.url)), 'utf8')

const entreeFictive: EntreeContrat = {
  methode: 'POST',
  modeleChemin: '/fictif/{id}',
  construireChemin: () => '/fictif/x',
  construireCorps: () => null,
  auth: null,
  validerReponse: (statut) => (statut === 200 ? 'reussie' : 'hors-contrat'),
}

describe('table du contrat', () => {
  it('ne rend disponibles que les types relevés : les trois étiquettes (SC-020)', () => {
    expect([...typesDisponibles()].sort()).toEqual(['creation-etiquette', 'pose-etiquette', 'retrait-etiquette'])
    for (const e of [ENTREES_DEFAUSSE, ENTREES_ENCHERE, ENTREES_LECTURE]) {
      expect(Object.keys(e)).toHaveLength(0)
    }
    expect(Object.keys(ENTREES_ETIQUETTES)).toHaveLength(3)
  })

  it('ne renvoie que les types présents dans une table injectée', () => {
    const table: TableContrat = { defausse: entreeFictive, enchere: entreeFictive }
    const dispo = typesDisponibles(table)
    expect([...dispo].sort()).toEqual(['defausse', 'enchere'])
    expect(dispo.has('lecture')).toBe(false)
  })

  it('ignore les entrées valant undefined', () => {
    const table: TableContrat = { defausse: entreeFictive, enchere: undefined }
    const dispo = typesDisponibles(table)
    expect([...dispo]).toEqual(['defausse'])
    expect(dispo.has('enchere')).toBe(false)
    expect(typesDisponibles({ lecture: undefined }).size).toBe(0)
  })

  it('retrouve dans TABLE_CONTRAT chaque entrée de chaque famille', () => {
    for (const famille of [ENTREES_DEFAUSSE, ENTREES_ENCHERE, ENTREES_ETIQUETTES, ENTREES_LECTURE] as TableContrat[]) {
      for (const [type, entree] of Object.entries(famille)) {
        expect(TABLE_CONTRAT[type as keyof TableContrat]).toBe(entree)
      }
    }
  })

  it('ne contient ni URL ni nom d’en-tête dans contrat.ts ni dans contrat/ (AC3)', () => {
    const dossier = fileURLToPath(new URL('../../src/lib/contrat/', import.meta.url))
    const sources = [
      lireSource('../../src/lib/contrat.ts'),
      ...readdirSync(dossier).map((f) => lireSource(`../../src/lib/contrat/${f}`)),
    ]
    expect(sources.length).toBeGreaterThan(1)
    for (const source of sources) {
      for (const interdit of ['/api/', 'https://', 'http://', 'authorization', 'apikey']) {
        expect(source.toLowerCase(), interdit).not.toContain(interdit)
      }
    }
  })
})
