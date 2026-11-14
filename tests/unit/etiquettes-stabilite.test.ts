// Stabilité des étiquettes : relancer la synchro redonne les mêmes étiquettes (demande d’Alexis, 2026-11-14).
// Les écarts du début (cache Wikipédia qui se remplit, étiquettes existantes) sont attendus ; une fois alignées, plus rien ne bouge.
import { describe, expect, it } from 'vitest'
import type { Action, Registre, TypeAction } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { calculerEcarts } from '../../src/lib/ecarts'
import { construireLot, etiquettesDeCarte, type Config } from '../../src/lib/lot'
import { refuserCouple, registreVide, validerRegistre } from '../../src/lib/registre'
import { appliquerResultat } from '../../src/lib/revision'
import { definirSignauxWikipedia, themesPrincipaux } from '../../src/lib/themes'
import { signauxWikipedia } from '../../src/lib/wikipedia'

const TOUS = new Set<TypeAction>(TYPES_ACTION)
const carte = (id: string, titre: string, description: string, extra: Partial<Carte> = {}): Carte => ({
  id, titre, rarete: 'commune', description, quantite: 1, url: null, favori: false, idsSite: [`ex-${id}`], etiquettesSite: [],
  prixCible: null, note: '', ami: null, valeurMarchande: null, ...extra,
})
const CARTES = [
  carte('a', 'Mookie', 'film de Hervé Palud, sorti en 1998'),
  carte('b', 'Lions de Trois-Rivières', 'équipe canadienne de la East Coast Hockey League basée au Québec'),
  carte('c', 'Ebrahim Raïssi', 'religieux chiite et homme d’État iranien'),
  carte('d', 'Noir (anime)', 'anime japonais', { favori: true }),
  carte('e', 'Tigre', 'espèce de mammifères carnivores'),
]
const coll = (cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config: Config = { maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], amis: [{ nom: 'Léa', themes: ['hockey'] }], limiteParExemplaire: 10, limiteNoms: 100 }

/** Envoie le lot : chaque action réussit, le registre est mis à jour comme le fait l’exécuteur. */
function appliquer(c: Collection, r: Registre, actions: readonly Action[]): Registre {
  let registre = r
  for (const a of actions) {
    const idEtiquette = a.type === 'creation-etiquette' ? `id-${a.nomEtiquette}` : undefined
    registre = appliquerResultat(c, registre, a, { classe: 'reussie', codeHttp: 200, cause: null, ...(idEtiquette ? { idEtiquette } : {}) } as never).registre
  }
  return registre
}

describe('relancer la synchro 100 fois', () => {
  it('le premier lot aligne tout, les 99 suivants ne produisent rien', () => {
    const c = coll(CARTES)
    let registre = registreVide()
    const premier = construireLot(c, registre, config, TOUS)
    expect(premier.actions.length).toBeGreaterThan(0)
    registre = appliquer(c, registre, premier.actions)
    const figee = JSON.stringify(registre)
    for (let i = 0; i < 99; i++) {
      const lot = construireLot(c, registre, config, TOUS)
      expect(lot.actions).toEqual([])
      expect(JSON.stringify(registre)).toBe(figee)
    }
  })
  it('l’ordre des cartes ou des catégories ne change pas les étiquettes', () => {
    const a = CARTES.map((x) => etiquettesDeCarte(x, config).retenues)
    const inverse = [...CARTES].reverse().map((x) => etiquettesDeCarte({ ...x }, config).retenues).reverse()
    expect(inverse).toEqual(a)
    const cats = ['Série télévisée d’animation japonaise', 'Série télévisée japonaise des années 2000', 'Manga']
    definirSignauxWikipedia(new Map([['Noir (anime)', signauxWikipedia(cats, 'Noir est un anime réalisé par Kōichi Mashimo.')]]))
    const un = themesPrincipaux({ titre: 'Noir (anime)', description: 'anime japonais' })
    definirSignauxWikipedia(new Map([['Noir (anime)', signauxWikipedia([...cats].reverse(), 'Noir est un anime réalisé par Kōichi Mashimo.')]]))
    expect(themesPrincipaux({ titre: 'Noir (anime)', description: 'anime japonais' })).toEqual(un)
    definirSignauxWikipedia(new Map())
  })
  it('un thème n’est jamais calculé deux fois différemment pour les mêmes données', () => {
    for (let i = 0; i < 100; i++) expect(themesPrincipaux({ titre: 'Mookie', description: 'film de Hervé Palud, sorti en 1998' })).toEqual(themesPrincipaux({ titre: 'Mookie', description: 'film de Hervé Palud, sorti en 1998' }))
  })
})

describe('retraits voulus par le joueur', () => {
  it('une étiquette retirée sur le site à la main n’est pas reposée (le registre fait foi de ce qui a été posé)', () => {
    const c = coll(CARTES)
    const registre = appliquer(c, registreVide(), construireLot(c, registreVide(), config, TOUS).actions)
    const retiree = coll(CARTES.map((x) => ({ ...x, etiquettesSite: [] })))
    for (let i = 0; i < 10; i++) expect(construireLot(retiree, registre, config, TOUS).actions).toEqual([])
  })
  it('une étiquette retirée par le joueur avec le bouton « Retirer » n’est jamais reposée', () => {
    const c = coll(CARTES)
    const r0 = appliquer(c, registreVide(), construireLot(c, registreVide(), config, TOUS).actions)
    const retrait: Action = { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: '#Cinéma' }
    let r = appliquer(c, r0, [retrait])
    // Sans mémoire du refus, la synchro reposerait l’étiquette.
    expect(construireLot(c, r, config, TOUS).actions.some((x) => x.type === 'pose-etiquette' && x.nomEtiquette === '#Cinéma')).toBe(true)
    r = refuserCouple(r, 'ex-a', '#Cinéma')
    for (let i = 0; i < 100; i++) expect(construireLot(c, r, config, TOUS).actions).toEqual([])
  })
  it('le refus survit à l’enregistrement et à la lecture du registre', () => {
    const r = refuserCouple(registreVide(), 'ex-a', '#Cinéma')
    expect(validerRegistre(JSON.parse(JSON.stringify(r)))?.refus).toEqual([{ ex: 'ex-a', nom: '#Cinéma' }])
    expect(validerRegistre({ ...r, refus: [42, { ex: 'x' }] })?.refus).toBeUndefined()
  })
})

describe('écarts', () => {
  it('une étiquette refusée n’est plus « manquante »', () => {
    const c = CARTES[0] as Carte
    const sans = calculerEcarts([c], config, registreVide())
    expect(sans[0]?.manquantes).toContain('#Cinéma')
    const avec = calculerEcarts([c], config, refuserCouple(registreVide(), 'ex-a', '#Cinéma'))
    expect(avec[0]?.manquantes ?? []).not.toContain('#Cinéma')
  })
})

describe('transition', () => {
  it('une ancienne étiquette posée mais plus attendue est retirée une fois, puis plus rien', () => {
    const c = coll(CARTES)
    const ancien: Registre = { ...registreVide(), etiquettes: { '#Félin': 'id-f' }, couples: [{ ex: 'ex-a', nom: '#Félin' }] }
    const lot = construireLot(c, ancien, config, TOUS)
    expect(lot.actions.filter((x) => x.type === 'retrait-etiquette')).toHaveLength(1)
    const r = appliquer(c, ancien, lot.actions)
    expect(construireLot(c, r, config, TOUS).actions).toEqual([])
  })
})
