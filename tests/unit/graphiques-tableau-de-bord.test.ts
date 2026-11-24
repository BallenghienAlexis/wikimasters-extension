import { describe, expect, it } from 'vitest'
import type { EntreeJournal } from '../../src/lib/actions'
import type { EvenementVente } from '../../src/lib/affluence'
import type { Carte } from '../../src/lib/collection'
import {
  calendrierActivite, cheminSecteur, compterParJour, destinationDe, evenementsActivite, fusionnerActiviteJours, niveauActivite, pourcentage,
  profilAffluence, repartitionDestinations, repartitionThemes, secteurs, totalParts, validerActiviteJours, TRANCHES,
} from '../../src/lib/graphiquesTableauDeBord'
import { exporterSynchro, fusionnerSynchro, lireSynchro, type DonneesSynchro } from '../../src/lib/sauvegardeSynchro'
import type { Verdict } from '../../src/lib/selectionLot'
import { cacheVide } from '../../src/lib/wikipedia'
import { cacheIAVide } from '../../src/lib/classificationIA'
import { etatApprisVide } from '../../src/lib/themesAppris'

const journal = (type: EntreeJournal['type'], horodatage: string, resultat: EntreeJournal['resultat'] = 'reussie'): EntreeJournal => ({
  id: horodatage + type, horodatage, idCarte: 'c', titre: 't', type, parametre: null, resultat, codeHttp: null, idLot: 'l',
})
const local = (a: number, m: number, j: number, h = 12): number => new Date(a, m, j, h).getTime()

describe('evenementsActivite', () => {
  it('compte les actions réussies par catégorie, sans lectures ni échecs', () => {
    const ev = evenementsActivite(
      [journal('enchere', '2026-11-10T10:00:00Z'), journal('defausse', '2026-11-10T11:00:00Z'), journal('pose-etiquette', '2026-11-10T12:00:00Z'), journal('favori', '2026-11-10T12:30:00Z'), journal('lecture', '2026-11-10T13:00:00Z'), journal('defausse', '2026-11-10T14:00:00Z', 'echouee')],
      [{ le: 5, source: 'auto', titre: 'x', prix: 3, resultat: 'reussie', cause: null }, { le: 6, source: 'auto', titre: 'x', prix: 3, resultat: 'echec', cause: 'c' }],
      [{ type: 'resultat', at: 7, poids: 2 }, { type: 'resultat', at: 8, poids: 0 }],
    )
    const compte = (c: string) => ev.filter((e) => e.categorie === c).length
    expect(compte('encheres')).toBe(2)
    expect(compte('defausses')).toBe(1)
    expect(compte('etiquettes')).toBe(2)
    expect(compte('ventes')).toBe(1)
  })
})

describe('calendrierActivite', () => {
  const jours = compterParJour([
    ...[0, 1, 2].map(() => ({ at: local(2026, 10, 24), categorie: 'encheres' as const })),
    { at: local(2026, 10, 24), categorie: 'defausses' },
    { at: local(2026, 10, 16), categorie: 'etiquettes' },
  ])
  const maintenant = new Date(2026, 10, 24, 15) // mardi

  it('produit des semaines de 7 jours, lundi d’abord, la semaine en cours en dernier', () => {
    const c = calendrierActivite(jours, 'tout', 4, maintenant)
    expect(c.semaines).toHaveLength(4)
    expect(c.semaines.every((s) => s.length === 7)).toBe(true)
    expect(c.semaines[3]![0]!.jour).toBe('2026-11-23')
    expect(c.semaines[0]![0]!.jour).toBe('2026-11-02')
    expect(c.semaines[3]![1]).toMatchObject({ jour: '2026-11-24', n: 4, futur: false })
    expect(c.semaines[3]![2]!.futur).toBe(true)
    expect(c.total).toBe(5)
    expect(c.maximum).toBe(4)
    expect(c.joursActifs).toBe(2)
  })

  it('filtre par catégorie et par période', () => {
    expect(calendrierActivite(jours, 'encheres', 4, maintenant).total).toBe(3)
    expect(calendrierActivite(jours, 'etiquettes', 4, maintenant).total).toBe(1)
    expect(calendrierActivite(jours, 'tout', 1, maintenant).total).toBe(4)
  })

  it('gradue l’intensité de 0 à 4', () => {
    expect(niveauActivite(0, 8)).toBe(0)
    expect(niveauActivite(1, 8)).toBe(1)
    expect(niveauActivite(8, 8)).toBe(4)
    expect(niveauActivite(5, 8)).toBe(3)
    expect(niveauActivite(3, 0)).toBe(0)
  })
})

describe('activité quotidienne conservée', () => {
  it('fusionne par maximum (idempotent, jamais à la baisse)', () => {
    const a = { '2026-11-10': { encheres: 3, ventes: 0, defausses: 1, etiquettes: 0 } }
    const b = { '2026-11-10': { encheres: 2, ventes: 1, defausses: 0, etiquettes: 0 }, '2026-11-11': { encheres: 1, ventes: 0, defausses: 0, etiquettes: 0 } }
    const f = fusionnerActiviteJours(a, b)
    expect(f['2026-11-10']).toEqual({ encheres: 3, ventes: 1, defausses: 1, etiquettes: 0 })
    expect(fusionnerActiviteJours(f, b)).toEqual(f)
    expect(fusionnerActiviteJours(f, f)).toEqual(f)
  })

  it('valide : jours, compteurs illisibles et jours vides ignorés, 400 jours au plus', () => {
    expect(validerActiviteJours('x')).toEqual({})
    expect(validerActiviteJours({ 'pas un jour': { encheres: 1 }, '2026-11-10': { encheres: -1, ventes: 'a' }, '2026-11-11': { ventes: 2 } })).toEqual({ '2026-11-11': { encheres: 0, ventes: 2, defausses: 0, etiquettes: 0 } })
    const beaucoup: Record<string, unknown> = {}
    for (let i = 0; i < 500; i++) beaucoup[new Date(2025, 0, 1 + i).toISOString().slice(0, 10)] = { encheres: 1 }
    expect(Object.keys(validerActiviteJours(beaucoup))).toHaveLength(400)
  })
})

const carte = (id: string, titre: string, description = ''): Carte => ({ id, titre, description, rarete: 'commune', quantite: 1, idsSite: ['s'], valeurMarchande: null, favori: false } as unknown as Carte)

describe('répartitions', () => {
  it('thèmes : un thème principal par carte, le reste regroupé, sans thème gardé visible', () => {
    const cartes = [
      carte('1', 'Chat', 'Le chat est un animal félin.'), carte('2', 'Chien', 'Le chien est un animal domestique.'),
      carte('3', 'Zzqxy'), carte('4', 'Qwwxz'),
    ]
    const parts = repartitionThemes(cartes, 6)
    expect(totalParts(parts)).toBe(4)
    expect(parts.some((p) => p.libelle === 'Sans thème fiable' && p.valeur === 2)).toBe(true)
    const peu = repartitionThemes(cartes, 2)
    expect(peu).toHaveLength(2)
    expect(totalParts(peu)).toBe(4)
  })

  const v = (code: Verdict['code'], action: Verdict['action']): Verdict => ({ action, code, motif: '', court: '', libelle: '', exemplaires: 1, amis: [] })

  it('destinations : verdict de garde regroupé, parts vides omises', () => {
    expect(destinationDe(v('favori', 'garder'))).toBe('moi')
    expect(destinationDe(v('theme-garde', 'garder'))).toBe('moi')
    expect(destinationDe(v('ami', 'garder'))).toBe('amis')
    expect(destinationDe(v('enchere', 'vendre'))).toBe('vendre')
    expect(destinationDe(v('defausse-sans-prix', 'defausser'))).toBe('defausser')
    expect(destinationDe(v('valeur-inconnue', 'garder'))).toBe('a-traiter')
    const parts = repartitionDestinations(new Map([['a', v('favori', 'garder')], ['b', v('ami', 'garder')], ['c', v('theme-garde', 'garder')]]))
    expect(parts.map((p) => [p.id, p.valeur])).toEqual([['moi', 2], ['amis', 1]])
  })

  it('secteurs et tracés', () => {
    const s = secteurs([{ id: 'a', libelle: 'a', valeur: 1 }, { id: 'b', libelle: 'b', valeur: 3 }, { id: 'c', libelle: 'c', valeur: 0 }])
    expect(s).toHaveLength(2)
    expect(s[0]!.fin).toBeCloseTo(Math.PI / 2)
    expect(s[1]!.fin).toBeCloseTo(2 * Math.PI)
    expect(pourcentage(1, 4)).toBe(25)
    expect(pourcentage(1, 0)).toBe(0)
    expect(cheminSecteur(50, 50, 40, 20, 0, Math.PI / 2)).toMatch(/^M 50 10 A 40 40 0 0 1 90 50 L 70 50 A 20 20 0 0 0 50 30 Z$/)
    expect(cheminSecteur(50, 50, 40, 0, 0, 2 * Math.PI)).not.toMatch(/NaN/)
  })
})

describe('profilAffluence', () => {
  it('par défaut : 7 jours × 8 tranches de 3 h, créneaux par défaut', () => {
    const p = profilAffluence([])
    expect(p.source).toBe('defaut')
    expect(p.jours).toHaveLength(7)
    expect(p.jours.every((j) => j.length === TRANCHES)).toBe(true)
    expect(p.jours[0]![0]!.jour).toBe(1) // lundi d’abord
    expect(p.jours[0]![6]!.forte).toBe(true) // lundi 18 h–21 h contient 19 h
    expect(p.jours[0]![1]!.forte).toBe(false)
    expect(p.jours[6]![0]!.jour).toBe(0)
  })

  it('d’après les enchères terminées : rendement moyen par cellule et mention du nombre', () => {
    const ev: EvenementVente[] = []
    const mardi = (h: number) => new Date(2026, 10, 10, h).getTime()
    for (let i = 0; i < 25; i++) ev.push({ type: 'resultat', at: mardi(20), poids: i % 2 === 0 ? 4 : 2 })
    ev.push({ type: 'resultat', at: mardi(9), poids: 1 })
    const p = profilAffluence(ev)
    expect(p.source).toBe('resultats')
    expect(p.nombre).toBe(26)
    const cell = p.jours[1]![6]!
    expect(cell.nombre).toBe(25)
    expect(cell.valeur).toBeCloseTo((13 * 4 + 12 * 2) / 25)
    expect(cell.forte).toBe(true)
    expect(p.jours[1]![3]!.forte).toBe(false)
    expect(p.maximum).toBeCloseTo(cell.valeur)
  })
})

describe('sauvegarde : graphiques transmis entre PC', () => {
  const base = (): DonneesSynchro => ({ derniereSynchro: null, etat: null, wikipedia: cacheVide(), classementIA: cacheIAVide(), themesAppris: etatApprisVide(), grapheWikidata: {} })
  const j = (n: number) => ({ '2026-11-10': { encheres: n, ventes: 0, defausses: 0, etiquettes: 0 } })

  it('exporte, relit et fusionne activité et enchères terminées', () => {
    const autre: DonneesSynchro = { ...base(), activite: j(5), resultatsVentes: [{ type: 'resultat', at: 100, poids: 1 }, { type: 'resultat', at: 200, poids: 2 }] }
    const relu = lireSynchro(JSON.parse(JSON.stringify(exporterSynchro(autre))))
    expect(typeof relu).toBe('object')
    const ici: DonneesSynchro = { ...base(), activite: j(2), resultatsVentes: [{ type: 'resultat', at: 200, poids: 2 }, { type: 'resultat', at: 300, poids: 0 }] }
    const f = fusionnerSynchro(ici, relu as Exclude<typeof relu, string | undefined>, [])
    expect(f.activite).toEqual(j(5))
    expect(f.resultatsVentes!.map((e) => e.at)).toEqual([100, 200, 300])
  })

  it('un ancien fichier sans ces champs reste valide et ne touche pas aux données d’ici', () => {
    const ancien = lireSynchro(JSON.parse(JSON.stringify(exporterSynchro(base()))))
    expect(typeof ancien).toBe('object')
    const ici: DonneesSynchro = { ...base(), activite: j(2) }
    expect(fusionnerSynchro(ici, ancien as Exclude<typeof ancien, string | undefined>, []).activite).toEqual(j(2))
  })
})
