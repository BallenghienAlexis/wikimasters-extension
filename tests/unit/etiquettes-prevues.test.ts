import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Registre } from '../../src/lib/actions'
import { regrouperEtiquettes, type ApercuEtiquettes } from '../../src/lib/apercuEtiquettes'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import type { Config } from '../../src/lib/lot'
import { registreVide } from '../../src/lib/registre'
import EtiquettesPrevues from '../../src/app/EtiquettesPrevues'

const NB = ' '

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${id}`],
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...extra,
})
const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], ...extra })
const registre = (etiquettes: Registre['etiquettes'] = {}): Registre => ({ ...registreVide(), etiquettes })

const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }
const AMIS = [{ nom: 'Léa', themes: ['animaux'] }]

const rendre = (collection: Collection, apercu: ApercuEtiquettes): string =>
  renderToStaticMarkup(
    React.createElement(EtiquettesPrevues, { apercu, cartes: new Map(collection.cartes.map((c) => [c.id, c])) }),
  )

const cas = (): { c: Collection; apercu: ApercuEtiquettes } => {
  const c = coll(carte('a', { ...CHIEN, statut: 'echanger', idsSite: ['e1', 'e2'], quantite: 2 }))
  return { c, apercu: regrouperEtiquettes(c, registre({ 'Statut · Échanger': 'et-1' }), config({ amis: AMIS })) }
}

describe('EtiquettesPrevues : lignes (AC1)', () => {
  it('liste chaque nom avec cartes, exemplaires et état', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    expect(html).toContain('Étiquettes prévues (envoi pas encore possible)')
    expect(html).toContain('Statut · Échanger')
    expect(html).toContain('#À échanger Léa')
    expect(html).toContain('nouvelle · non disponible')
    expect(html).toContain('>non disponible<')
  })

  it('tableau avec en-têtes de colonne et libellés visibles en liste empilée', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    for (const t of ['Étiquette', 'Cartes', 'Exemplaires', 'État']) expect(html).toContain(`<th scope="col" class="px-2 py-2 font-semibold">${t}</th>`)
    expect(html).toContain('<caption')
    expect(html).toContain(`Exemplaires${NB}: `)
    expect(html).toContain(`État${NB}: `)
  })

  it('ordre : Statut, échanges, puis thèmes', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    expect(html.indexOf('Statut · Échanger')).toBeLessThan(html.indexOf('#À échanger Léa'))
    expect(html.indexOf('#À échanger Léa')).toBeLessThan(html.indexOf('#Chien'))
  })

  it('section absente sans étiquette attendue', () => {
    const c = coll(carte('a', { favori: true }))
    const html = rendre(c, regrouperEtiquettes(c, registre(), config()))
    expect(html).toBe('')
  })

  it('mention « … et N autres étiquettes » au-delà de la limite', () => {
    const { c, apercu } = cas()
    const html = rendre(c, { ...apercu, restantes: 7 })
    expect(html).toContain('… et 7 autres étiquettes')
  })
})

describe('EtiquettesPrevues : total et non posées (AC2)', () => {
  it('affiche le total prévu avec durée une fois disponible', () => {
    const { c, apercu } = cas()
    const t = apercu.totaux
    const html = rendre(c, apercu)
    expect(html).toContain(`Total prévu${NB}: ${t.poses} poses dont ${t.themes} de thème et ${t.echanges} d’échange`)
    expect(html).toContain(`${t.nomsNouveaux} noms nouveaux`)
    expect(html).toContain(`durée estimée une fois disponible${NB}: `)
  })

  it('details « Étiquettes non posées (N) » avec raisons en toutes lettres', () => {
    const c = coll(carte('commune|a', { titre: 'Titre <b>x</b>', rarete: 'commune' }))
    const apercu: ApercuEtiquettes = {
      ...cas().apercu,
      nonPosees: [
        { idCarte: 'commune|a', titre: 'Titre <b>x</b>', nomEtiquette: '#Chien', raison: 'homonyme' },
        { idCarte: 'commune|a', titre: 'Titre <b>x</b>', nomEtiquette: '#Long', raison: 'nom-trop-long' },
        { idCarte: 'commune|a', titre: 'Titre <b>x</b>', nomEtiquette: '#Zut', raison: 'au-dela-limite' },
      ],
    }
    const html = rendre(c, apercu)
    expect(html).toContain('Étiquettes non posées (3)')
    expect(html).toContain('<summary class="min-h-11')
    expect(html).toContain('homonyme d’une étiquette à vous')
    expect(html).toContain('nom trop long')
    expect(html).toContain('au-delà de la limite du site')
    expect(html).toContain('[commune]')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('pas de details sans étiquette non posée', () => {
    expect(rendre(cas().c, cas().apercu)).not.toContain('Étiquettes non posées')
  })
})

describe('EtiquettesPrevues : avertissement de visibilité (AC3)', () => {
  const TEXTE = `Visibilité non vérifiée${NB}: les étiquettes de thème, de statut et d’échange, dont les prénoms de vos amis, sont peut-être visibles par les autres joueurs.`

  it('présent avec le texte exact dès qu’une étiquette est attendue', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    const texte = html.replace(/<[^>]+>/g, '')
    expect(texte).toContain(TEXTE)
    expect(html).toContain('border-l-vendre')
    expect(html).toContain('text-vendre')
  })

  it('précède les non posées dans l’ordre du document', () => {
    const { c, apercu } = cas()
    const html = rendre(c, {
      ...apercu,
      nonPosees: [{ idCarte: 'a', titre: 'Carte a', nomEtiquette: '#X', raison: 'homonyme' }],
    })
    expect(html.indexOf('Visibilité non vérifiée')).toBeGreaterThan(-1)
    expect(html.indexOf('Visibilité non vérifiée')).toBeGreaterThan(html.indexOf('Total prévu'))
  })

  it('absent sans étiquette attendue', () => {
    const c = coll(carte('a', { favori: true }))
    expect(rendre(c, regrouperEtiquettes(c, registre(), config()))).not.toContain('Visibilité')
  })
})

describe('EtiquettesPrevues : rendu sûr et responsive (AC6)', () => {
  it('nom d’ami de 300 caractères rendu en texte, avec retour à la ligne', () => {
    const nom = 'Z'.repeat(300)
    const c = coll(carte('a', { ...CHIEN, statut: 'echanger' }))
    const apercu = regrouperEtiquettes(c, registre(), config({ amis: [{ nom: `${nom}<img src=x>`, themes: ['animaux'] }], longueurMaxEtiquette: null }))
    const html = rendre(c, apercu)
    expect(html).toContain(nom)
    expect(html).not.toContain('<img')
    expect(html).toContain('break-words')
  })

  it('aucune classe de couleur hors tokens, jamais text-muted sur bg-line', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(/\s+/))
    const couleurs = classes.filter((k) => /^(text|bg|border|border-l)-/.test(k))
    const permises = /^(text-(sm|xs|base|paper|muted|vendre|echanger|garder|defausser|left)|bg-(ink|ink-2|line)|border(-l)?-(line|vendre|\d|b|l)|border-l-4|border-b|border)$/
    for (const k of couleurs) expect(k, k).toMatch(permises)
    for (const el of html.match(/class="[^"]*"/g) ?? []) expect(el.includes('text-muted') && el.includes('bg-line')).toBe(false)
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
  })

  it('liste empilée sur petit écran (grid-cols-1) et tableau à partir de md', () => {
    const { c, apercu } = cas()
    const html = rendre(c, apercu)
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('md:grid-cols-4')
    expect(html).toMatch(/<table[^>]*class="[^"]*hidden md:table|<ul[^>]*md:hidden/)
  })
})
