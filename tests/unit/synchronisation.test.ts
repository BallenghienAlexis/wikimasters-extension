import { describe, expect, it } from 'vitest'
import type { Action, CarteEcartee, Registre, TypeAction } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { preferencesParDefaut } from '../../src/lib/tri'
import type { EtatFile } from '../../src/lib/file'
import {
  AVERTISSEMENT_AMIS,
  CADENCE_TEXTE,
  actionsRetrait,
  configDuLot,
  contientAmi,
  detailsDuLot,
  dureeMinutes,
  libelleCause,
  libelleErreurLancement,
  libelleLigne,
  libelleRaison,
  libelleType,
  lignesNonIncluses,
  nombreCartes,
  pourcentage,
  preparerLot,
  texteLotVide,
  pageActions,
  raisonDesactivation,
  regrouperEcartees,
  separerDisponibles,
  texteDuree,
  texteEnCours,
  texteFin,
  texteInterrompu,
  texteTotaux,
  titreApercu,
  totauxParType,
} from '../../src/app/Synchronisation'

const NB = ' '

const carte = (id: string, extra: Partial<Carte> = {}): Carte => ({
  id,
  etiquettesSite: [],
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
    expect(titreApercu(12)).toBe(`Lot prêt${NB}: 12 actions`)
    expect(titreApercu(1)).toBe(`Lot prêt${NB}: 1 action`)
    expect(titreApercu(0)).toBe('Aucune action à envoyer')
  })

  it('rappelle la cadence fixe', () => {
    expect(CADENCE_TEXTE).toBe(`Cadence variable${NB}: 2 à 3,5 s entre deux étiquettes (6 à 10 s pour une enchère ou une défausse), 30 par minute au plus · arrêt après 3 erreurs`)
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
    expect(d[0]).toBe('exemplaire 1 sur 2 · valeur marchande 140')
    expect(d[2]).toBe('exemplaire 2 sur 2 · valeur marchande 140')
  })

  it('donne le nom d’étiquette, avec le verbe pour un retrait ou une création', () => {
    const actions: Action[] = [
      pose('R|b', 'Ami · Léa'),
      { type: 'retrait-etiquette', idCarte: 'R|b', idExemplaire: 'x', nomEtiquette: 'Statut · Garder' },
      { type: 'creation-etiquette', idCarte: 'R|b', nomEtiquette: 'Ami · Léa' },
    ]
    const d = detailsDuLot(actions, cartes)
    expect(d[0]).toBe('Ami · Léa')
    expect(d[1]).toBe(`retrait${NB}: Statut · Garder`)
    expect(d[2]).toBe(`création${NB}: Ami · Léa`)
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

  it('arrondit la durée à la minute supérieure (3 s par écriture d’étiquette en moyenne)', () => {
    expect(dureeMinutes(0)).toBe(0)
    expect(dureeMinutes(1)).toBe(1)
    expect(dureeMinutes(20)).toBe(1)
    expect(dureeMinutes(21)).toBe(2)
    expect(dureeMinutes(40)).toBe(2)
    expect(texteDuree(21)).toBe(`Durée estimée${NB}: 2 min`)
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
  const base = { nbOnglets: 1, executionEnCours: false, executionIllisible: false, nbDisponibles: 3 }
  it('est nulle quand tout est prêt', () => {
    expect(raisonDesactivation(base)).toBeNull()
  })
  it('signale l’absence d’onglet', () => {
    expect(raisonDesactivation({ ...base, nbOnglets: 0 })).toBe('Aucun onglet WikiMasters ouvert.')
  })
  it('signale plusieurs onglets', () => {
    expect(raisonDesactivation({ ...base, nbOnglets: 2 })).toBe(`Plusieurs onglets WikiMasters sont ouverts${NB}: gardez-en un seul.`)
  })
  it('signale une exécution en cours', () => {
    expect(raisonDesactivation({ ...base, executionEnCours: true })).toBe('Une exécution est déjà en cours.')
  })
  it('signale un état d’exécution illisible', () => {
    expect(raisonDesactivation({ ...base, executionIllisible: true })).toBe('L’état de l’exécution est illisible : Lancer est impossible.'.replace(' :', `${NB}:`))
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

describe('lot figé et erreurs de stockage', () => {
  const coll = { version: 2, cartes: [carte('R|a')] } as unknown as Collection
  const registre: Registre = { version: 1, etiquettes: {}, couples: [] }

  it('refuse de préparer le lot si le registre est illisible', () => {
    const r = preparerLot(coll, null, new Set<TypeAction>())
    expect(r).toEqual({ erreur: 'le registre des étiquettes est illisible' })
  })

  it('prépare un lot avec une table vide', () => {
    const r = preparerLot(coll, registre, new Set<TypeAction>())
    expect('lot' in r && r.lot.actions).toEqual([])
  })

  it('convertit une exception en cause fixe', () => {
    const r = preparerLot({ version: 2 } as unknown as Collection, registre, new Set<TypeAction>())
    expect(r).toEqual({ erreur: 'calcul impossible' })
  })
})

describe('texte du lot vide', () => {
  it('distingue le lot vraiment vide du lot sans action disponible', () => {
    expect(texteLotVide(true)).toBe('Aucune action n’est disponible pour le moment.')
    expect(texteLotVide(false)).toBe('Les favoris, les cartes à trier et les cartes non reliées au site ne produisent aucune action.')
  })
})

describe('cartes non incluses', () => {
  const ecart = (idCarte: string, raison: CarteEcartee['raison']): CarteEcartee => ({ idCarte, titre: idCarte, raison })
  it('dédoublonne par carte et par raison', () => {
    const l = lignesNonIncluses([ecart('a', 'action-non-disponible'), ecart('a', 'action-non-disponible'), ecart('a', 'non-reliee')], [])
    expect(l).toHaveLength(2)
  })
  it('inclut les étiquettes obsolètes, une ligne par carte et par nom', () => {
    const o = (idExemplaire: string, nomEtiquette: string) => ({ idCarte: 'b', titre: 'b', idExemplaire, nomEtiquette })
    const l = lignesNonIncluses([], [o('1', 'Statut · Garder'), o('2', 'Statut · Garder'), o('1', 'Ami · Léa')])
    expect(l.map((x) => [x.raison, x.nomEtiquette])).toEqual([
      ['etiquette-obsolete', 'Statut · Garder'],
      ['etiquette-obsolete', 'Ami · Léa'],
    ])
  })
  it('regroupe aussi les obsolètes au-delà de 50', () => {
    const obs = Array.from({ length: 60 }, (_, i) => ({ idCarte: `c${i}`, titre: 't', idExemplaire: 'x', nomEtiquette: 'n' }))
    const g = regrouperEcartees(lignesNonIncluses([], obs))
    expect(g).toEqual({ type: 'groupes', groupes: [{ raison: 'etiquette-obsolete', nombre: 60, nomEtiquette: 'n' }] })
  })
})

describe('cartes non incluses : cartes et non lignes (D-17)', () => {
  const ecart = (idCarte: string, raison: CarteEcartee['raison']): CarteEcartee => ({ idCarte, titre: idCarte, raison })
  it('compte une carte à deux raisons une seule fois', () => {
    const l = lignesNonIncluses([ecart('a', 'non-reliee'), ecart('a', 'action-non-disponible'), ecart('b', 'non-reliee')], [])
    expect(l).toHaveLength(3)
    expect(nombreCartes(l)).toBe(2)
  })
  it('garde le nom des étiquettes obsolètes dans les groupes, un groupe par nom', () => {
    const obs = (n: number, nomEtiquette: string) =>
      Array.from({ length: n }, (_, i) => ({ idCarte: `${nomEtiquette}${i}`, titre: 't', idExemplaire: 'x', nomEtiquette }))
    const g = regrouperEcartees(lignesNonIncluses([], [...obs(30, 'favori'), ...obs(30, 'Ami · Léa')]))
    expect(g).toEqual({
      type: 'groupes',
      groupes: [
        { raison: 'etiquette-obsolete', nombre: 30, nomEtiquette: 'favori' },
        { raison: 'etiquette-obsolete', nombre: 30, nomEtiquette: 'Ami · Léa' },
      ],
    })
  })
  it('compte des cartes distinctes par groupe', () => {
    const e = Array.from({ length: 60 }, (_, i) => ecart(`c${i % 30}`, i < 30 ? 'non-reliee' : 'action-non-disponible'))
    const g = regrouperEcartees(lignesNonIncluses(e, []))
    expect(g).toEqual({
      type: 'groupes',
      groupes: [
        { raison: 'non-reliee', nombre: 30 },
        { raison: 'action-non-disponible', nombre: 30 },
      ],
    })
  })
  it('écrit la raison en toutes lettres, avec le compte de places et le nom d’étiquette', () => {
    expect(libelleLigne('en-attente-place', { places: { occupees: 5, max: 5 } })).toBe('en attente d’une place libre (5 / 5)')
    expect(libelleLigne('en-attente-place')).toBe('en attente d’une place libre')
    expect(libelleLigne('etiquette-obsolete', { nomEtiquette: 'favori' })).toBe(`étiquette obsolète conservée${NB}: favori`)
    expect(libelleLigne('non-reliee')).toBe('non reliée au site')
  })
})

describe('avertissement de visibilité des étiquettes d’amis (H34, D-13)', () => {
  it('détecte une étiquette « Ami · … » dans le lot', () => {
    expect(contientAmi([pose('a', 'Statut · Garder'), pose('b', 'Ami · Léa')])).toBe(true)
    expect(contientAmi([pose('a', 'Statut · Garder'), defausse('b', '1')])).toBe(false)
    expect(contientAmi([])).toBe(false)
  })
  it('écrit la phrase du design', () => {
    expect(AVERTISSEMENT_AMIS).toBe(`Les étiquettes sont visibles des autres joueurs${NB}: les noms d’amis y apparaîtront.`)
  })
})

describe('retrait d’étiquette', () => {
  const reg: Registre = { version: 1, etiquettes: {}, couples: [{ ex: '1', nom: 'Statut · Garder' }, { ex: '2', nom: 'Statut · Garder' }, { ex: '9', nom: 'Autre' }] }
  const col: Collection = { version: 3, cartes: [carte('a', { idsSite: ['1', '2'] })] }
  const couple = { idCarte: 'a', nomEtiquette: 'Statut · Garder' }
  it('produit un retrait par exemplaire de la carte portant ce nom', () => {
    expect(actionsRetrait(couple, col, reg, true).map((a) => [a.type, 'idExemplaire' in a ? a.idExemplaire : null])).toEqual([
      ['retrait-etiquette', '1'],
      ['retrait-etiquette', '2'],
    ])
  })
  it('ne produit rien si le retrait n’est pas disponible, même si le couple existe', () => {
    expect(actionsRetrait(couple, col, reg, false)).toEqual([])
  })
  it('ne produit rien pour une carte inconnue ou un nom absent du registre', () => {
    expect(actionsRetrait({ idCarte: 'zz', nomEtiquette: 'Statut · Garder' }, col, reg, true)).toEqual([])
    expect(actionsRetrait({ idCarte: 'a', nomEtiquette: 'Inconnu' }, col, reg, true)).toEqual([])
  })
})

describe('exécution : libellés fixes (D-22, D-41)', () => {
  const etat = (e: Partial<EtatFile>): EtatFile => ({ version: 1, idLot: 'l', etat: 'arretee', traitees: 0, total: 0, raison: null, ...e })
  const bilan = { reussies: 0, passees: 0, erreurs: 0, dernierCode: null, dernierInconnu: false }

  it('donne une cause fixe, jamais un texte du site', () => {
    expect(libelleCause(null, null)).toBe('arrêt demandé')
    expect(libelleCause('echecs', null)).toBe('3 erreurs')
    expect(libelleCause('code-http', 429)).toBe('réponse 429')
    expect(libelleCause('code-http', 500)).toBe('le site a refusé la requête')
    expect(libelleCause('code-http', null)).toBe('le site a refusé la requête')
    expect(libelleCause('echecs', null, true)).toBe('l’onglet WikiMasters s’est déconnecté')
  })
  it('écrit la progression avec accords', () => {
    expect(texteEnCours(4, 12, 0)).toBe(`En cours${NB}: 4 / 12 · 0 erreur`)
    expect(texteEnCours(4, 12, 2)).toBe(`En cours${NB}: 4 / 12 · 2 erreurs`)
  })
  it('borne le pourcentage', () => {
    expect(pourcentage(0, 0)).toBe(0)
    expect(pourcentage(1, 3)).toBe(33)
    expect(pourcentage(5, 3)).toBe(100)
  })
  it('écrit la fin d’un lot terminé en une phrase (D-22)', () => {
    const t = texteFin(etat({ etat: 'terminee', traitees: 5, total: 5 }), { ...bilan, reussies: 3, passees: 1, erreurs: 1 }, false)
    expect(t).toEqual({ titre: 'Lot terminé', detail: '3 réussies, 1 passée, 1 échouée' })
  })
  it('écrit la fin d’un lot arrêté avec le nombre d’actions non envoyées', () => {
    const t = texteFin(etat({ traitees: 2, total: 5, raison: 'echecs' }), bilan, false)
    expect(t).toEqual({ titre: `Lot arrêté${NB}: 3 erreurs`, detail: '3 actions n’ont pas été envoyées.' })
    expect(texteFin(etat({ traitees: 4, total: 5, raison: 'manuel' }), bilan, false).detail).toBe('1 action n’a pas été envoyée.')
  })
  it('écrit la phrase du lot interrompu (D-22)', () => {
    expect(texteInterrompu()).toBe(
      `Lot interrompu${NB}: la page ou l’onglet a été fermé ou rechargé. L’exécution ne reprend pas toute seule.`,
    )
  })
  it('n’affiche jamais le message d’une exception inconnue au lancement', () => {
    expect(libelleErreurLancement(new Error('<b>corps brut du site</b>'))).toBe('le lot n’a pas pu être lancé.')
    expect(libelleErreurLancement('x')).toBe('le lot n’a pas pu être lancé.')
    expect(libelleErreurLancement(new Error('Une exécution est déjà en cours.'))).toBe('Une exécution est déjà en cours.')
  })
})

describe('configDuLot', () => {
  it('relie les cartes au site (lienCardId) : c’est ce qui ouvre les enchères', () => {
    expect(configDuLot(preferencesParDefaut()).lienCardId).toBe(true)
  })
})

describe('libelleCause : conflit 409', () => {
  it('explique le conflit de l’enchère', () => {
    expect(libelleCause('code-http', 409)).toContain('réponse 409')
    expect(libelleCause('code-http', 409)).toContain('relancer la synchronisation')
    expect(libelleCause('code-http', 429)).toBe('réponse 429')
  })

  it('403 : cause lisible (exemplaire périmé, carte en vente ou session refusée)', () => {
    const texte = libelleCause('code-http', 403)
    expect(texte).toContain('réponse 403')
    expect(texte).toContain('exemplaire périmé')
    expect(texte).toContain('relancer la synchronisation')
  })
})
