import { describe, expect, it } from 'vitest'
import type { Action, CarteEcartee, TypeAction } from '../../src/lib/actions'
import type { Carte } from '../../src/lib/collection'
import {
  CADENCE_TEXTE,
  detailsDuLot,
  dureeMinutes,
  libelleRaison,
  libelleType,
  pageActions,
  raisonDesactivation,
  regrouperEcartees,
  separerDisponibles,
  texteDuree,
  texteTotaux,
  titreApercu,
  totauxParType,
} from '../../src/app/Synchronisation'

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'R',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...extra,
})

const defausse = (idCarte: string, idExemplaire: string): Action => ({ type: 'defausse', idCarte, idExemplaire })
const pose = (idCarte: string, nomEtiquette: string): Action => ({ type: 'pose-etiquette', idCarte, idExemplaire: 'x', nomEtiquette })

describe('libellés', () => {
  it('écrit chaque type en toutes lettres', () => {
    expect(libelleType('enchere')).toBe('Mettre aux enchères')
    expect(libelleType('defausse')).toBe('Défausser')
    expect(libelleType('pose-etiquette')).toBe('Étiquette')
    expect(libelleType('retrait-etiquette')).toBe('Étiquette')
    expect(libelleType('creation-etiquette')).toBe('Étiquette')
    expect(libelleType('lecture')).toBe('Lecture')
  })

  it('donne une raison en français pour chaque raison d’écart', () => {
    expect(libelleRaison('non-reliee')).toBe('non reliée au site')
    expect(libelleRaison('action-non-disponible')).toBe('action non disponible')
    expect(libelleRaison('valeur-absente')).toBe('valeur marchande absente')
    expect(libelleRaison('prix-superieur-valeur')).toBe('prix de départ supérieur ou égal à la valeur marchande')
    expect(libelleRaison('nom-trop-long')).toBe('nom d’étiquette trop long')
  })

  it('titre l’aperçu', () => {
    expect(titreApercu(12)).toBe('Lot prêt : 12 actions')
    expect(titreApercu(1)).toBe('Lot prêt : 1 action')
    expect(titreApercu(0)).toBe('Aucune action à envoyer')
  })

  it('rappelle la cadence fixe', () => {
    expect(CADENCE_TEXTE).toBe('Cadence fixe : 10 actions par minute · arrêt après 3 erreurs')
  })
})

describe('détail des actions', () => {
  const cartes = new Map<string, Carte>([
    ['R|a', carte('R|a', { titre: 'Alpha', valeurMarchande: 140 })],
    ['R|b', carte('R|b', { titre: 'Bêta' })],
  ])

  it('numérote les exemplaires défaussés d’une même carte', () => {
    const actions = [defausse('R|a', '1'), pose('R|b', 'Statut · Vendre'), defausse('R|a', '2')]
    const d = detailsDuLot(actions, cartes)
    expect(d[0]).toBe('exemplaire 1 sur 2')
    expect(d[2]).toBe('exemplaire 2 sur 2')
  })

  it('donne le nom d’étiquette, avec le verbe pour un retrait ou une création', () => {
    const actions: Action[] = [
      pose('R|b', 'Ami · Léa'),
      { type: 'retrait-etiquette', idCarte: 'R|b', idExemplaire: 'x', nomEtiquette: 'Statut · Garder' },
      { type: 'creation-etiquette', idCarte: 'R|b', nomEtiquette: 'Ami · Léa' },
    ]
    const d = detailsDuLot(actions, cartes)
    expect(d[0]).toBe('Ami · Léa')
    expect(d[1]).toBe('retrait : Statut · Garder')
    expect(d[2]).toBe('création : Ami · Léa')
  })

  it('donne le prix de départ et la valeur marchande d’une enchère', () => {
    const d = detailsDuLot([{ type: 'enchere', idCarte: 'R|a', idExemplaire: '1', prix: 50 }], cartes)
    expect(d[0]).toBe('départ 50 · valeur marchande 140')
  })

  it('n’affiche pas de valeur marchande inconnue', () => {
    const d = detailsDuLot([{ type: 'enchere', idCarte: 'R|b', idExemplaire: '1', prix: 5 }], cartes)
    expect(d[0]).toBe('départ 5')
  })
})

describe('totaux et durée', () => {
  const actions: Action[] = [
    pose('R|a', 'n'),
    pose('R|a', 'm'),
    { type: 'creation-etiquette', idCarte: 'R|a', nomEtiquette: 'n' },
    { type: 'enchere', idCarte: 'R|a', idExemplaire: '1', prix: 1 },
    defausse('R|b', '2'),
    defausse('R|b', '3'),
  ]

  it('compte par famille d’action', () => {
    expect(totauxParType(actions)).toEqual({ etiquettes: 3, encheres: 1, defausses: 2, lectures: 0 })
  })

  it('écrit les totaux avec accords', () => {
    expect(texteTotaux({ etiquettes: 6, encheres: 3, defausses: 3, lectures: 0 })).toBe('6 étiquettes · 3 enchères · 3 défausses')
    expect(texteTotaux({ etiquettes: 1, encheres: 1, defausses: 1, lectures: 0 })).toBe('1 étiquette · 1 enchère · 1 défausse')
    expect(texteTotaux({ etiquettes: 0, encheres: 2, defausses: 0, lectures: 0 })).toBe('2 enchères')
  })

  it('arrondit la durée à la minute supérieure (6 s par requête)', () => {
    expect(dureeMinutes(0)).toBe(0)
    expect(dureeMinutes(1)).toBe(1)
    expect(dureeMinutes(6)).toBe(1)
    expect(dureeMinutes(10)).toBe(1)
    expect(dureeMinutes(11)).toBe(2)
    expect(texteDuree(11)).toBe('Durée estimée : 2 min')
  })
})

describe('disponibilité', () => {
  const dispo = new Set<TypeAction>(['defausse'])
  it('sépare les actions disponibles des autres', () => {
    const r = separerDisponibles([defausse('a', '1'), pose('a', 'n')], dispo)
    expect(r.disponibles).toHaveLength(1)
    expect(r.indisponibles).toHaveLength(1)
  })
})

describe('raison de désactivation de « Lancer »', () => {
  const base = { nbOnglets: 1, executionEnCours: false, nbDisponibles: 3 }
  it('est nulle quand tout est prêt', () => {
    expect(raisonDesactivation(base)).toBeNull()
  })
  it('signale l’absence d’onglet', () => {
    expect(raisonDesactivation({ ...base, nbOnglets: 0 })).toBe('Aucun onglet WikiMasters ouvert.')
  })
  it('signale plusieurs onglets', () => {
    expect(raisonDesactivation({ ...base, nbOnglets: 2 })).toBe('Plusieurs onglets WikiMasters sont ouverts : gardez-en un seul.')
  })
  it('signale une exécution en cours', () => {
    expect(raisonDesactivation({ ...base, executionEnCours: true })).toBe('Une exécution est déjà en cours.')
  })
  it('signale l’absence d’action disponible', () => {
    expect(raisonDesactivation({ ...base, nbDisponibles: 0 })).toBe('Aucune action n’est disponible pour le moment.')
  })
})

describe('pagination et regroupement', () => {
  const beaucoup = Array.from({ length: 250 }, (_, i) => defausse('a', String(i)))
  it('n’affiche que les 100 premières actions', () => {
    const p = pageActions(beaucoup)
    expect(p.visibles).toHaveLength(100)
    expect(p.restantes).toBe(150)
  })
  it('affiche tout un petit lot', () => {
    const p = pageActions(beaucoup.slice(0, 3))
    expect(p.visibles).toHaveLength(3)
    expect(p.restantes).toBe(0)
  })
  it('garde les écartées telles quelles jusqu’à 50, puis regroupe par raison', () => {
    const e = (n: number, raison: CarteEcartee['raison']): CarteEcartee[] =>
      Array.from({ length: n }, (_, i) => ({ idCarte: `${raison}${i}`, titre: `T${i}`, raison }))
    expect(regrouperEcartees(e(3, 'non-reliee'))).toEqual({ type: 'liste', lignes: e(3, 'non-reliee') })
    const g = regrouperEcartees([...e(40, 'non-reliee'), ...e(20, 'homonyme')])
    expect(g).toEqual({
      type: 'groupes',
      groupes: [
        { raison: 'non-reliee', nombre: 40 },
        { raison: 'homonyme', nombre: 20 },
      ],
    })
  })
})
