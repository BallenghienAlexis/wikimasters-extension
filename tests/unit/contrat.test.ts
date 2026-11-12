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
  it('ne rend disponibles que les types relevés : étiquettes, enchère et défausse (SC-020)', () => {
    expect([...typesDisponibles()].sort()).toEqual(['creation-etiquette', 'defausse', 'enchere', 'pose-etiquette', 'retrait-etiquette', 'suppression-etiquette'])
    expect(Object.keys(ENTREES_LECTURE)).toHaveLength(0)
    expect(Object.keys(ENTREES_ENCHERE)).toEqual(['enchere'])
    expect(Object.keys(ENTREES_DEFAUSSE)).toEqual(['defausse'])
    expect(Object.keys(ENTREES_ETIQUETTES)).toHaveLength(4)
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
    const fichiers = ['contrat.ts', ...readdirSync(dossier).map((f) => `contrat/${f}`)]
    const sources = fichiers.map((f) => lireSource(`../../src/lib/${f}`))
    expect(sources.length).toBeGreaterThan(1)
    for (const [i, source] of sources.entries()) {
      // Seuls les chemins relatifs du site (enchère, défausse) contiennent « /api/ ».
      const interdits = ['contrat/enchere.ts', 'contrat/defausse.ts'].includes(fichiers[i]!) ? ['https://', 'http://', 'authorization', 'apikey'] : ['/api/', 'https://', 'http://', 'authorization', 'apikey']
      for (const interdit of interdits) {
        expect(source.toLowerCase(), interdit).not.toContain(interdit)
      }
    }
  })
})
