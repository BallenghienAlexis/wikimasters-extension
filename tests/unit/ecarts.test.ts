import { describe, expect, it } from 'vitest'
import type { Carte } from '../../src/lib/collection'
import { calculerEcarts } from '../../src/lib/ecarts'

// Données fictives uniquement.
const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${id}`],
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...extra,
})

const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }

describe('calculerEcarts', () => {
  it('signale une étiquette attendue absente du site', () => {
    const c = carte('a', { ...CHIEN, etiquettesSite: [] })
    const e = calculerEcarts([c])[0]!
    expect(e.idCarte).toBe('a')
    expect(e.manquantes).toEqual(['#Chien', '#Animaux', '#Nature'])
    expect(e.enTrop).toEqual([])
  })

  it('signale une étiquette présente sur le site mais non attendue', () => {
    const c = carte('b', { etiquettesSite: ['#À classer', 'Statut · Vendre'] })
    const e = calculerEcarts([c])[0]!
    expect(e.enTrop).toEqual(['Statut · Vendre'])
    expect(e.manquantes).toEqual([])
  })

  it('ne renvoie rien quand les étiquettes correspondent', () => {
    const c = carte('c', { etiquettesSite: ['#À classer'] })
    expect(calculerEcarts([c])).toEqual([])
  })

  it('traite les étiquettes d’échange avec les amis fournis', () => {
    const c = carte('d', { ...CHIEN, })
    const e = calculerEcarts([c], { amis: [{ nom: 'Léa', themes: ['animaux'] }] })[0]!
    expect(e.manquantes).toContain('#À échanger Léa')
  })

  it('ignore une carte non reliée et n’écrit rien', () => {
    const c = carte('e', { idsSite: null, etiquettesSite: ['X'] })
    const avant = JSON.stringify(c)
    expect(calculerEcarts([c])).toEqual([])
    expect(JSON.stringify(c)).toBe(avant)
  })

  it('un favori n’attend que ses thèmes : une ancienne étiquette de statut ou d’échange est en trop', () => {
    const c = carte('f', { favori: true, etiquettesSite: ['Statut · Garder', '#À échanger Léa'] })
    const e = calculerEcarts([c], { amis: [{ nom: 'Léa', themes: ['animaux'] }] })[0]!
    expect(e.enTrop).toEqual(['Statut · Garder', '#À échanger Léa'])
    expect(e.manquantes).toEqual(['#À classer'])
  })
})
