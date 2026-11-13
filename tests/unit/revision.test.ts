import { describe, expect, it } from 'vitest'
import type { Action, Registre, ResultatAction } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import type { Config } from '../../src/lib/lot'
import { CONFIG_PRIX } from '../../src/config/prix'
import { prixDepart } from '../../src/lib/tri'
import { appliquerResultat, reverifierAction } from '../../src/lib/revision'
import { construireLot } from '../../src/lib/lot'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { TypeAction } from '../../src/lib/actions'

const config: Config = { maxVentesSimultanees: 5, longueurMaxEtiquette: null, nomsExistants: [] }

const carte = (extra: Partial<Carte> = {}): Carte => ({
  id: 'commune|Chat',
  etiquettesSite: [],
  titre: 'Chat',
  rarete: 'commune',
  description: '',
  quantite: 2,
  url: null,
  favori: false,
  idsSite: ['ex-1', 'ex-2'],
  statut: 'vendre',
  prixCible: 30,
  note: '',
  ami: null,
  valeurMarchande: 100,
  decidePar: null,
  ...extra,
})

const coll = (...cartes: Carte[]): Collection => ({ version: 3, cartes })
const reg = (couples: Registre['couples'] = [], etiquettes: Registre['etiquettes'] = {}): Registre => ({
  version: 1,
  etiquettes,
  couples,
})
const ok: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' }

const enchere: Action = { type: 'enchere', idCarte: 'commune|Chat', idExemplaire: 'ex-1', prix: 30 }
const defausse: Action = { type: 'defausse', idCarte: 'commune|Chat', idExemplaire: 'ex-1' }

describe('reverifierAction (AC1)', () => {
  it('enchère inchangée : ok', () => {
    expect(reverifierAction(enchere, coll(carte()), reg(), config)).toBe('ok')
  })

  it('enchère : carte disparue, favori, statut, prix, exemplaire absent → passée', () => {
    expect(reverifierAction(enchere, coll(), reg(), config)).toBe('passee')
    expect(reverifierAction(enchere, coll(carte({ favori: true })), reg(), config)).toBe('passee')
    expect(reverifierAction(enchere, coll(carte({ statut: 'garder' })), reg(), config)).toBe('passee')
    expect(reverifierAction(enchere, coll(carte({ prixCible: 40 })), reg(), config)).toBe('passee')
    expect(reverifierAction(enchere, coll(carte({ idsSite: ['ex-2'] })), reg(), config)).toBe('passee')
    expect(reverifierAction(enchere, coll(carte({ idsSite: null })), reg(), config)).toBe('passee')
  })

  it('enchère : sans prixCible, le prix de la matrice fait foi', () => {
    const sansCible = carte({ prixCible: null, valeurMarchande: 1_000_000 })
    expect(reverifierAction({ ...enchere, prix: 1 }, coll(sansCible), reg(), config)).toBe('passee')
  })

  it('enchère sans prixCible : « ok » quand le prix est celui de la matrice', () => {
    const valeur = Math.min(...CONFIG_PRIX.matricePrixDepart.map((t) => t.valeurMin)) * 2
    const prix = prixDepart(valeur)
    expect(prix).not.toBeNull()
    const sansCible = carte({ prixCible: null, valeurMarchande: valeur })
    expect(reverifierAction({ ...enchere, prix: prix! }, coll(sansCible), reg(), config)).toBe('ok')
  })

  it('défausse avec quantité > 1 mais un seul identifiant restant : ok pour cet identifiant', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 1, quantite: 3, idsSite: ['ex-1'] })
    expect(reverifierAction(defausse, coll(c), reg(), config)).toBe('ok')
    expect(reverifierAction({ ...defausse, idExemplaire: 'ex-2' }, coll(c), reg(), config)).toBe('passee')
  })

  it('défausse', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 1 })
    expect(reverifierAction(defausse, coll(c), reg(), config)).toBe('ok')
    expect(reverifierAction(defausse, coll(carte({ statut: 'vendre' })), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, valeurMarchande: 6 }), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, valeurMarchande: null }), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, valeurMarchande: 5 }), reg(), config)).toBe('ok')
    expect(reverifierAction(defausse, coll({ ...c, favori: true }), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, idsSite: ['ex-2'] }), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll(), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, quantite: 0 }), reg(), config)).toBe('passee')
  })

  it('défausse : le plafond réglé remplace le plafond par défaut', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 12 })
    expect(reverifierAction(defausse, coll(c), reg(), config)).toBe('passee')
    expect(reverifierAction(defausse, coll(c), reg(), { ...config, plafondDefausse: 12 })).toBe('ok')
    expect(reverifierAction(defausse, coll(c), reg(), { ...config, plafondDefausse: 11 })).toBe('passee')
    expect(reverifierAction(defausse, coll({ ...c, valeurMarchande: 4 }), reg(), { ...config, plafondDefausse: 3 })).toBe('passee')
  })

  it('pose : étiquette de statut et d’ami', () => {
    const pose: Action = { type: 'pose-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'Statut · Vendre' }
    expect(reverifierAction(pose, coll(carte()), reg(), config)).toBe('ok')
    expect(reverifierAction(pose, coll(carte({ statut: 'garder' })), reg(), config)).toBe('passee')
    expect(reverifierAction(pose, coll(carte({ favori: true })), reg(), config)).toBe('passee')
    expect(reverifierAction(pose, coll(carte({ idsSite: ['ex-2'] })), reg(), config)).toBe('passee')
    const ami: Action = { ...pose, nomEtiquette: '#À échanger Zoé' }
    expect(reverifierAction(ami, coll(carte({ statut: 'echanger', ami: 'Zoé' })), reg(), config)).toBe('ok')
    expect(reverifierAction(ami, coll(carte({ statut: 'echanger', ami: 'Léa' })), reg(), config)).toBe('passee')
  })

  it('création : l’étiquette est-elle toujours nécessaire ?', () => {
    const cr: Action = { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: 'Statut · Vendre' }
    expect(reverifierAction(cr, coll(carte()), reg(), config)).toBe('ok')
    expect(reverifierAction(cr, coll(carte({ statut: 'garder' })), reg(), config)).toBe('passee')
    expect(reverifierAction(cr, coll(), reg(), config)).toBe('passee')
  })

  it('retrait : couple encore au registre et étiquette plus attendue', () => {
    const r: Action = { type: 'retrait-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'Statut · Garder' }
    const registre = reg([{ ex: 'ex-1', nom: 'Statut · Garder' }])
    expect(reverifierAction(r, coll(carte()), registre, config)).toBe('ok')
    expect(reverifierAction(r, coll(carte()), reg(), config)).toBe('passee')
    expect(reverifierAction(r, coll(carte({ statut: 'garder' })), registre, config)).toBe('passee')
    expect(reverifierAction(r, coll(carte({ favori: true })), registre, config)).toBe('passee')
    expect(reverifierAction(r, coll(carte({ statut: 'a-trier' })), registre, config)).toBe('passee')
  })

  it('lecture : ok', () => {
    expect(reverifierAction({ type: 'lecture', idCarte: 'x' }, coll(), reg(), config)).toBe('ok')
  })
})

describe('reverifierAction : thèmes et échanges (T-105, SC-012, H12)', () => {
  const chien = { titre: 'Berger allemand', description: 'race de chien' }
  const amisCfg: Config = { ...config, amis: [{ nom: 'Léa', themes: ['animaux'] }] }
  const poseAmi: Action = { type: 'pose-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: '#À échanger Léa' }
  const poseTheme: Action = { ...poseAmi, nomEtiquette: '#Chien' }

  it('pose d’échange : ok tant que l’ami suit un thème de la carte, passée sinon', () => {
    const c = carte({ ...chien, statut: 'echanger' })
    expect(reverifierAction(poseAmi, coll(c), reg(), amisCfg)).toBe('ok')
    expect(reverifierAction(poseAmi, coll(c), reg(), config)).toBe('passee')
    expect(reverifierAction(poseAmi, coll(c), reg(), { ...config, amis: [{ nom: 'Léa', themes: ['pont'] }] })).toBe('passee')
    expect(reverifierAction(poseAmi, coll(carte({ ...chien, statut: 'vendre' })), reg(), amisCfg)).toBe('passee')
  })

  it('pose de thème : indépendante des amis, passée quand la carte n’a plus le thème', () => {
    const c = carte({ ...chien })
    expect(reverifierAction(poseTheme, coll(c), reg(), config)).toBe('ok')
    expect(reverifierAction(poseTheme, coll(carte({ titre: 'Zzz', description: '' })), reg(), config)).toBe('passee')
  })

  it('pose de thème écartée par la limite par exemplaire : passée', () => {
    const c = carte({ ...chien, statut: 'echanger' })
    expect(reverifierAction(poseTheme, coll(c), reg(), { ...amisCfg, limiteParExemplaire: 2 })).toBe('passee')
  })

  it('retrait : passé si l’étiquette est de nouveau attendue ou si le couple a disparu', () => {
    const c = carte({ ...chien, statut: 'echanger' })
    const retrait: Action = { ...poseAmi, type: 'retrait-etiquette' }
    const registre = reg([{ ex: 'ex-1', nom: '#À échanger Léa' }])
    expect(reverifierAction(retrait, coll(c), registre, config)).toBe('ok')
    expect(reverifierAction(retrait, coll(c), registre, amisCfg)).toBe('passee')
    expect(reverifierAction(retrait, coll(c), reg(), config)).toBe('passee')
  })

  it('création : ok tant qu’un exemplaire attend le nom', () => {
    const cr: Action = { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: '#À échanger Léa' }
    expect(reverifierAction(cr, coll(carte({ ...chien, statut: 'echanger' })), reg(), amisCfg)).toBe('ok')
    expect(reverifierAction(cr, coll(carte({ ...chien, statut: 'echanger' })), reg(), config)).toBe('passee')
  })

  it('test croisé : tout nom produit par construireLot est jugé ok', () => {
    const tous = new Set<TypeAction>(TYPES_ACTION)
    const cartes = [
      carte({ ...chien, statut: 'echanger', ami: 'Hugo' }),
      carte({ id: 'commune|Pont', titre: 'Pont suspendu', description: 'un pont', rarete: 'commune', idsSite: ['ex-9'], statut: 'garder' }),
    ]
    for (const cfg of [amisCfg, { ...amisCfg, limiteParExemplaire: 3 }]) {
      const lot = construireLot(coll(...cartes), reg(), cfg, tous)
      const etiquettes = lot.actions.filter((a) => a.type === 'pose-etiquette' || a.type === 'creation-etiquette')
      expect(etiquettes.length).toBeGreaterThan(0)
      for (const a of lot.actions) {
        if (a.type === 'pose-etiquette' || a.type === 'creation-etiquette') expect(reverifierAction(a, coll(...cartes), reg(), cfg)).toBe('ok')
      }
    }
  })
})

describe('appliquerResultat (AC2)', () => {
  it('enchère réussie : statut en-vente, quantité et idsSite inchangés', () => {
    const { collection } = appliquerResultat(coll(carte()), reg(), enchere, ok)
    const c = collection.cartes[0]!
    expect(c.statut).toBe('en-vente')
    expect(c.quantite).toBe(2)
    expect(c.idsSite).toEqual(['ex-1', 'ex-2'])
  })

  it('défausse réussie : identifiant retiré, couples purgés, quantité −1', () => {
    const registre = reg([
      { ex: 'ex-1', nom: 'A' },
      { ex: 'ex-2', nom: 'A' },
    ])
    const r = appliquerResultat(coll(carte({ statut: 'defausser', valeurMarchande: 1 })), registre, defausse, ok)
    expect(r.collection.cartes[0]?.idsSite).toEqual(['ex-2'])
    expect(r.collection.cartes[0]?.quantite).toBe(1)
    expect(r.registre.couples).toEqual([{ ex: 'ex-2', nom: 'A' }])
  })

  it('dernière défausse : carte retirée et registre purgé', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 1, quantite: 1, idsSite: ['ex-1'] })
    const registre = reg([
      { ex: 'ex-1', nom: 'A' },
      { ex: 'ex-9', nom: 'B' },
    ])
    const r = appliquerResultat(coll(c), registre, defausse, ok)
    expect(r.collection.cartes).toEqual([])
    expect(r.registre.couples).toEqual([{ ex: 'ex-9', nom: 'B' }])
  })

  it('quantité 0 atteinte avec des identifiants restants : tout le registre de la carte purgé', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 1, quantite: 1, idsSite: ['ex-1', 'ex-2'] })
    const registre = reg([{ ex: 'ex-2', nom: 'A' }])
    const r = appliquerResultat(coll(c), registre, defausse, ok)
    expect(r.collection.cartes).toEqual([])
    expect(r.registre.couples).toEqual([])
  })

  it('la quantité ne descend jamais sous 0', () => {
    const c = carte({ statut: 'defausser', valeurMarchande: 1, quantite: 0, idsSite: ['ex-1', 'ex-2'] })
    const r = appliquerResultat(coll(c), reg(), defausse, ok)
    expect(r.collection.cartes.every((x) => x.quantite >= 0)).toBe(true)
  })

  it('création réussie : identifiant au registre', () => {
    const a: Action = { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: 'Statut · Vendre' }
    const r = appliquerResultat(coll(carte()), reg(), a, { ...ok, idEtiquette: 'et-7' })
    expect(r.registre.etiquettes).toEqual({ 'Statut · Vendre': 'et-7' })
  })

  it('création réussie sans identifiant : registre inchangé', () => {
    const a: Action = { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: 'N' }
    const registre = reg()
    expect(appliquerResultat(coll(carte()), registre, a, ok).registre).toBe(registre)
  })

  it('pose et retrait : couple ajouté puis retiré', () => {
    const pose: Action = { type: 'pose-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'N' }
    const retrait: Action = { type: 'retrait-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'N' }
    const p = appliquerResultat(coll(carte()), reg(), pose, ok)
    expect(p.registre.couples).toEqual([{ ex: 'ex-1', nom: 'N' }])
    const r = appliquerResultat(p.collection, p.registre, retrait, ok)
    expect(r.registre.couples).toEqual([])
  })
})

describe('appliquerResultat : état inchangé (AC3)', () => {
  const actions: Action[] = [
    enchere,
    defausse,
    { type: 'pose-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'N' },
    { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: 'N' },
    { type: 'retrait-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'N' },
    { type: 'lecture', idCarte: 'commune|Chat' },
  ]
  for (const classe of ['echec', 'inconnu', 'arret'] as const) {
    it(`classe ${classe} : mêmes références`, () => {
      const c = coll(carte())
      const r = reg()
      for (const a of actions) {
        const res = appliquerResultat(c, r, a, { classe, codeHttp: null, cause: 'x' })
        expect(res.collection).toBe(c)
        expect(res.registre).toBe(r)
      }
    })
  }

  it('succès sur une carte inconnue : mêmes références', () => {
    const c = coll()
    const r = reg()
    const res = appliquerResultat(c, r, enchere, ok)
    expect(res.collection).toBe(c)
    expect(res.registre).toBe(r)
  })
})

describe('exemplaire indisponible (403/404 sur une action par exemplaire)', () => {
  const refus = (codeHttp: number): ResultatAction => ({ classe: 'echec', codeHttp, cause: 'action non disponible' })
  const pose: Action = { type: 'pose-etiquette', idCarte: 'commune|Chat', idExemplaire: 'ex-1', nomEtiquette: 'Statut · Vendre' }

  it('retire l’exemplaire, diminue la quantité et laisse le registre intact ; la carte reste s’il en reste un', () => {
    const r = reg([{ ex: 'ex-1', nom: 'a' }, { ex: 'ex-2', nom: 'a' }])
    const { collection, registre } = appliquerResultat(coll(carte()), r, pose, refus(403))
    expect(collection.cartes[0]!.idsSite).toEqual(['ex-2'])
    expect(collection.cartes[0]!.quantite).toBe(1)
    expect(registre.couples).toHaveLength(2)
  })

  it('dernier exemplaire sans édition locale : la carte disparaît de la collection', () => {
    const seule = carte({ quantite: 1, idsSite: ['ex-1'], statut: 'a-trier', prixCible: null, valeurMarchande: null })
    expect(appliquerResultat(coll(seule), reg(), pose, refus(404)).collection.cartes).toEqual([])
  })

  it('dernier exemplaire d’une carte éditée : gardée mais déliée du site', () => {
    const seule = carte({ quantite: 1, idsSite: ['ex-1'], note: 'à garder en tête' })
    const c = appliquerResultat(coll(seule), reg(), pose, refus(403)).collection.cartes[0]!
    expect(c.quantite).toBe(0)
    expect(c.idsSite).toBeNull()
    expect(c.note).toBe('à garder en tête')
  })

  it('les actions suivantes visant cet exemplaire sont ensuite passées par la revérification', () => {
    const { collection, registre } = appliquerResultat(coll(carte()), reg(), enchere, refus(403))
    expect(reverifierAction(enchere, collection, registre, config)).toBe('passee')
    expect(reverifierAction(defausse, collection, registre, config)).toBe('passee')
  })

  it('exemplaire inconnu, 500 ou action sans exemplaire : rien ne change', () => {
    const c = coll(carte())
    const r = reg()
    expect(appliquerResultat(c, r, pose, refus(500)).collection).toBe(c)
    expect(appliquerResultat(c, r, { ...pose, idExemplaire: 'ex-9' }, refus(403)).collection).toBe(c)
    expect(appliquerResultat(c, r, { type: 'creation-etiquette', idCarte: 'commune|Chat', nomEtiquette: 'x' }, refus(403)).collection).toBe(c)
  })
})
