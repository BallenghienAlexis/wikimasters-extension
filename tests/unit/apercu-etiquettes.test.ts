import { describe, expect, it } from 'vitest'
import type { Registre } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import type { Config } from '../../src/lib/lot'
import { THEME_AUTRES, themesDeCarte } from '../../src/lib/themes'
import { meilleureDuree } from './duree'
import { registreVide } from '../../src/lib/registre'
import { dureeMinutes } from '../../src/app/apercuLot'
import { dureeMinutesApercu, regrouperEtiquettes, texteDureeLongue } from '../../src/lib/apercuEtiquettes'

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  etiquettesSite: [],
  titre: `Carte ${id}`,
  rarete: 'commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${id}`],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...extra,
})
const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], ...extra })
const registre = (couples: Registre['couples'] = [], etiquettes: Registre['etiquettes'] = {}): Registre => ({ ...registreVide(), couples, etiquettes })

const CHIEN = { titre: 'Berger allemand', description: 'race de chien' }
const AMIS = [
  { nom: 'Léa', themes: ['animaux'] },
  { nom: 'Hugo', themes: ['animaux'] },
]

describe('regrouperEtiquettes : lignes (AC1)', () => {
  it('regroupe par nom, avec cartes, exemplaires, nouveauté et genre', () => {
    const a = carte('a', { ...CHIEN, idsSite: ['e1', 'e2'], quantite: 2 })
    const b = carte('b', { ...CHIEN, })
    const r = regrouperEtiquettes(coll(a, b), registre([], { '#Chien': 'et-1' }), config({ amis: AMIS }))
    const chien = r.lignes.find((l) => l.nom === '#Chien')!
    expect(chien).toMatchObject({ cartes: 2, exemplaires: 3, nouvelle: false, genre: 'theme' })
    const lea = r.lignes.find((l) => l.nom === '#À échanger Léa')!
    expect(lea).toMatchObject({ cartes: 2, exemplaires: 3, nouvelle: true, genre: 'echange' })
  })

  it('ordre : échanges, puis thèmes du plus précis au plus général', () => {
    const r = regrouperEtiquettes(coll(carte('a', { ...CHIEN, })), registre(), config({ amis: AMIS }))
    const genres = r.lignes.map((l) => l.genre)
    expect(genres[0]).toBe('echange')
    expect(genres.lastIndexOf('echange')).toBeLessThan(genres.indexOf('theme'))
    const themes = r.lignes.filter((l) => l.genre === 'theme').map((l) => l.nom)
    expect(themes.indexOf('#Chien')).toBeLessThan(themes.indexOf('#Animaux'))
  })

  it('aucune ligne ni total pour une collection vide', () => {
    const r = regrouperEtiquettes(coll(), registre(), config())
    expect(r.lignes).toEqual([])
    expect(r.restantes).toBe(0)
    expect(r.totaux.poses).toBe(0)
    expect(r.totaux.minutes).toBe(0)
  })

  it('un exemplaire non relié ou en conflit n’est pas compté', () => {
    const r = regrouperEtiquettes(
      coll(carte('a', { idsSite: null }), carte('b', { idsSite: ['x'] }), carte('c', { idsSite: ['x'] })),
      registre(),
      config(),
    )
    expect(r.lignes).toEqual([])
  })
})

describe('regrouperEtiquettes : totaux et durée (AC2)', () => {
  it('compte les poses, dont thèmes et échanges, et les noms nouveaux', () => {
    const r = regrouperEtiquettes(coll(carte('a', { ...CHIEN, })), registre(), config({ amis: AMIS }))
    const poses = r.lignes.reduce((n, l) => n + l.exemplaires, 0)
    expect(r.totaux.poses).toBe(poses)
    expect(r.totaux.echanges).toBe(2)
    expect(r.totaux.themes).toBe(poses - 2)
    expect(r.totaux.nomsNouveaux).toBe(r.lignes.length)
  })

  it('un nom déjà posé par l’extension n’est pas une pose prévue', () => {
    const c = carte('a', { })
    const r = regrouperEtiquettes(coll(c), registre([{ ex: 'ex-a', nom: '#À classer' }], { '#À classer': 'et-2' }), config())
    expect(r.totaux.poses).toBe(0)
    expect(r.totaux.nomsNouveaux).toBe(0)
  })

  it('durée : ⌈requêtes × 6 s / 60⌉, identique à la synchronisation', () => {
    for (const n of [0, 1, 9, 10, 11, 100, 601]) expect(dureeMinutesApercu(n)).toBe(dureeMinutes(n))
  })

  it('durée formulée « H h M min » au-delà d’une heure', () => {
    expect(texteDureeLongue(0)).toBe('0 min')
    expect(texteDureeLongue(59)).toBe('59 min')
    expect(texteDureeLongue(60)).toBe('60 min')
    expect(texteDureeLongue(61)).toBe('1 h 1 min')
    expect(texteDureeLongue(125)).toBe('2 h 5 min')
  })

  it('même résultat quels que soient les types disponibles (calcul indépendant de la disponibilité)', () => {
    const r = regrouperEtiquettes(coll(carte('a', CHIEN)), registre(), config())
    expect(r.totaux.poses).toBeGreaterThan(0)
    expect(r.totaux.minutes).toBe(dureeMinutes(r.totaux.requetes))
  })
})

describe('regrouperEtiquettes : non posées et plafond (AC3, AC4)', () => {
  it('expose les étiquettes non posées avec carte et raison', () => {
    const r = regrouperEtiquettes(
      coll(carte('a', { ami: 'x'.repeat(60) })),
      registre(),
      config({ longueurMaxEtiquette: 20 }),
    )
    expect(r.nonPosees).toEqual([expect.objectContaining({ idCarte: 'a', raison: 'nom-trop-long', titre: 'Carte a' })])
    expect(r.lignes.some((l) => l.nom.length > 20)).toBe(false)
  })

  it('au plus 100 lignes, avec le nombre restant', () => {
    const amis = Array.from({ length: 150 }, (_, i) => ({ nom: `Ami ${String(i).padStart(3, '0')}`, themes: ['animaux'] }))
    const r = regrouperEtiquettes(coll(carte('a', { ...CHIEN, })), registre(), config({ amis }))
    expect(r.lignes).toHaveLength(100)
    // 150 échanges + un thème par libellé détecté, moins les 100 lignes affichées.
    const nbThemes = themesDeCarte({ ...CHIEN }).filter((t) => t !== THEME_AUTRES).length
    expect(nbThemes).toBeGreaterThan(0)
    expect(r.restantes).toBe(150 + nbThemes - 100)
    expect(r.lignes[0]!.genre).toBe('echange')
  })
})

describe('regrouperEtiquettes : retraits (H11)', () => {
  it('expose le retrait d’une ancienne étiquette « Statut · … » de l’extension', () => {
    const c = carte('a', { })
    const r = regrouperEtiquettes(
      coll(c),
      registre([{ ex: 'ex-a', nom: 'Statut · Garder' }], { 'Statut · Garder': 'et-1' }),
      config(),
    )
    // L’étiquette de repli « #À classer » (carte sans thème) est à créer et à poser, l’ancien Statut est retiré.
    expect(r.totaux.retraits).toBe(1)
    expect(r.totaux.poses).toBe(1)
    expect(r.totaux.nomsNouveaux).toBe(1)
    expect(r.totaux.requetes).toBe(3)
  })
})

describe('regrouperEtiquettes : performance (AC5)', () => {
  it('5 000 cartes, 20 amis × 10 thèmes : moins de 500 ms', () => {
    const themes = ['animaux', 'pont', 'chien', 'chat', 'volcan', 'lac', 'tunnel', 'cheval', 'ile', 'ski']
    const amis = Array.from({ length: 20 }, (_, i) => ({ nom: `Ami ${i}`, themes }))
    const cartes = Array.from({ length: 5000 }, (_, i) =>
      carte(`c${String(i).padStart(5, '0')}`, { titre: `Carte ${i}`, description: i % 2 ? 'race de chien' : 'pont sur un lac', }),
    )
    const cfg = config({ amis })
    expect(meilleureDuree(() => void regrouperEtiquettes(coll(...cartes), registre(), cfg))).toBeLessThan(500)
  })
})

describe('regrouperEtiquettes : pureté (AC6)', () => {
  it('ne mute pas ses entrées', () => {
    const c = coll(carte('a', { ...CHIEN, }))
    const r = registre()
    const avant = JSON.stringify([c, r])
    regrouperEtiquettes(c, r, config({ amis: AMIS }))
    expect(JSON.stringify([c, r])).toBe(avant)
  })

  it('le module n’utilise ni chrome.* ni jeton', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/apercuEtiquettes.ts', 'utf8')
    expect(src).not.toMatch(/chrome\./)
    expect(src).not.toMatch(/jeton/i)
  })
})
