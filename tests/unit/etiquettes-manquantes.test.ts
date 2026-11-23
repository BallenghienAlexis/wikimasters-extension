// Étiquettes supprimées par erreur sur le site (Alexis, 2026-11-23) : le lot les recrée et les repose.
import { describe, expect, it } from 'vitest'
import type { Action, Registre, TypeAction } from '../../src/lib/actions'
import { TYPES_ACTION } from '../../src/lib/actions'
import type { Carte, Collection } from '../../src/lib/collection'
import { collectionVide } from '../../src/lib/collection'
import { ENTREES_LECTURE } from '../../src/lib/contrat/lecture'
import { ajusterLotAuSite, construireLot, type Config } from '../../src/lib/lot'
import { validerOrdre, validerResultat } from '../../src/lib/messages'
import { reconcilierAvecSite, refuserCouple } from '../../src/lib/registre'
import { appliquerResultat } from '../../src/lib/revision'

const TOUS = new Set<TypeAction>(TYPES_ACTION)
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const U3 = '33333333-3333-4333-8333-333333333333'
const carte = (id: string, titre: string, description: string): Carte => ({
  id, titre, rarete: 'commune', description, quantite: 1, url: null, favori: false, idsSite: [`ex-${id}`], etiquettesSite: [],
  prixCible: null, note: '', ami: null, valeurMarchande: null,
})
const CARTES = [carte('a', 'Tigre', 'espèce de mammifères carnivores'), carte('b', 'Lions de Trois-Rivières', 'équipe canadienne de hockey sur glace basée au Québec')]
const coll: Collection = { ...collectionVide(), cartes: CARTES }
const config: Config = { maxVentesSimultanees: 5, longueurMaxEtiquette: 50, nomsExistants: [], amis: [], limiteParExemplaire: 10, limiteNoms: 100 }

/** Registre tel qu'après un lot complet : toutes les étiquettes attendues créées et posées. */
function registreAligne(): Registre {
  let registre: Registre = { version: 2, etiquettes: {}, couples: [] }
  const lot = construireLot(coll, registre, config, TOUS)
  let n = 0
  for (const a of lot.actions) {
    const idEtiquette = a.type === 'creation-etiquette' ? `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` : undefined
    registre = appliquerResultat(coll, registre, a, { classe: 'reussie', codeHttp: 200, cause: 'action réussie', ...(idEtiquette ? { idEtiquette } : {}) }).registre
  }
  return registre
}

describe('reconcilierAvecSite', () => {
  it('rend le registre tel quel sans liste fiable ou si tout existe', () => {
    const r = registreAligne()
    expect(reconcilierAvecSite(r, null).registre).toBe(r)
    const site = Object.values(r.etiquettes).map((id) => ({ id, nom: 'x' }))
    const rec = reconcilierAvecSite(r, site)
    expect(rec.registre).toBe(r)
    expect(rec.perdus).toEqual([])
  })
  it('oublie une étiquette disparue du site, avec ses couples, et les rend', () => {
    const r = registreAligne()
    const [nom, id] = Object.entries(r.etiquettes)[0]!
    const site = Object.entries(r.etiquettes).filter(([n]) => n !== nom).map(([n, i]) => ({ id: i, nom: n }))
    const rec = reconcilierAvecSite(r, site)
    expect(rec.manquantes).toEqual([nom])
    expect(rec.registre.etiquettes[nom]).toBeUndefined()
    expect(rec.registre.couples.some((c) => c.nom === nom)).toBe(false)
    expect(rec.perdus.length).toBeGreaterThan(0)
    expect(rec.perdus.every((c) => c.nom === nom)).toBe(true)
    expect(id).toBeTruthy()
  })
  it('une liste vide ne prouve rien : registre inchangé, aucun doublon à recréer', () => {
    const r = registreAligne()
    expect(reconcilierAvecSite(r, []).registre).toBe(r)
  })
  it('reprend l’identifiant d’une étiquette recréée à la main sous le même nom, et repose ses couples', () => {
    const r = registreAligne()
    const [nom] = Object.entries(r.etiquettes)[0]!
    const site = Object.entries(r.etiquettes).map(([n, i]) => ({ id: n === nom ? U3 : i, nom: n }))
    const rec = reconcilierAvecSite(r, site)
    expect(rec.registre.etiquettes[nom]).toBe(U3)
    expect(rec.manquantes).toEqual([])
    expect(rec.perdus.length).toBeGreaterThan(0)
  })
  it('un registre réconcilié fait recréer puis reposer l’étiquette par le lot, jamais « À classer »', () => {
    const r = registreAligne()
    const nom = Object.keys(r.etiquettes)[0]!
    const rec = reconcilierAvecSite(r, Object.entries(r.etiquettes).filter(([n]) => n !== nom).map(([n, i]) => ({ id: i, nom: n })))
    const lot = construireLot(coll, rec.registre, config, TOUS)
    expect(lot.actions.filter((a) => a.type === 'creation-etiquette').map((a) => 'nomEtiquette' in a && a.nomEtiquette)).toEqual([nom])
    expect(lot.actions.some((a) => a.type === 'pose-etiquette' && a.nomEtiquette === nom)).toBe(true)
    expect(lot.actions.every((a) => !('nomEtiquette' in a) || (a.nomEtiquette !== '#À classer' && a.nomEtiquette !== '#Autres'))).toBe(true)
  })
})

describe('ajusterLotAuSite', () => {
  it('lot vide + étiquette disparue : création en tête puis repose des couples perdus', () => {
    const r = registreAligne()
    const nom = Object.keys(r.etiquettes)[0]!
    const rec = reconcilierAvecSite(r, Object.entries(r.etiquettes).filter(([n]) => n !== nom).map(([n, i]) => ({ id: i, nom: n })))
    const actions = ajusterLotAuSite([], rec.registre, rec.perdus, coll, config, TOUS)
    expect(actions[0]).toMatchObject({ type: 'creation-etiquette', nomEtiquette: nom })
    expect(actions.slice(1).every((a) => a.type === 'pose-etiquette' && a.nomEtiquette === nom)).toBe(true)
    expect(actions.length - 1).toBe(rec.perdus.length)
  })
  it('retire du lot un retrait dont l’étiquette n’existe plus', () => {
    const r = registreAligne()
    const couple = r.couples[0]!
    const retrait: Action = { type: 'retrait-etiquette', idCarte: 'a', idExemplaire: couple.ex, nomEtiquette: couple.nom }
    const rec = reconcilierAvecSite(r, [{ id: U1, nom: '#Autre-site' }])
    expect(ajusterLotAuSite([retrait], rec.registre, rec.perdus, coll, config, TOUS).some((a) => a.type === 'retrait-etiquette')).toBe(false)
  })
  it('ajoute une création devant une pose dont le nom est inconnu, une seule par nom', () => {
    const pose = (ex: string): Action => ({ type: 'pose-etiquette', idCarte: 'a', idExemplaire: ex, nomEtiquette: '#Animaux' })
    const actions = ajusterLotAuSite([pose('e1'), pose('e2')], { version: 2, etiquettes: {}, couples: [] }, [], coll, config, TOUS)
    expect(actions.map((a) => a.type)).toEqual(['creation-etiquette', 'pose-etiquette', 'pose-etiquette'])
  })
  it('ne recrée ni ne repose « À classer » ni « Autres »', () => {
    const pose = (nom: string): Action => ({ type: 'pose-etiquette', idCarte: 'a', idExemplaire: 'ex-a', nomEtiquette: nom })
    const actions = ajusterLotAuSite([pose('#À classer'), pose('#Autres')], { version: 2, etiquettes: {}, couples: [] }, [{ ex: 'ex-a', nom: '#Autres' }], coll, config, TOUS)
    expect(actions.some((a) => a.type === 'creation-etiquette')).toBe(false)
    expect(actions.some((a) => a.type === 'pose-etiquette')).toBe(false)
  })
  it('respecte un retrait voulu par le joueur et le mode « suspendre »', () => {
    let r = registreAligne()
    const nom = Object.keys(r.etiquettes)[0]!
    const couple = r.couples.find((c) => c.nom === nom)!
    r = refuserCouple(r, couple.ex, nom)
    const rec = reconcilierAvecSite(r, [{ id: U1, nom: '#Autre-site' }])
    const avecRefus = ajusterLotAuSite([], rec.registre, rec.perdus, coll, config, TOUS)
    expect(avecRefus.some((a) => a.type === 'pose-etiquette' && a.idExemplaire === couple.ex && a.nomEtiquette === nom)).toBe(false)
    expect(ajusterLotAuSite([], rec.registre, rec.perdus, coll, { ...config, modeEtiquettes: 'suspendre' }, TOUS)).toEqual([])
  })
})

describe('lecture des étiquettes avant un lot', () => {
  const entree = ENTREES_LECTURE.lecture!
  it('vise my-collection/stats seulement pour la cible « etiquettes »', () => {
    expect(entree.construireChemin({ type: 'lecture', idCarte: 'x', cible: 'etiquettes' })).toBe('/api/my-collection/stats?sort=added')
    expect(entree.construireChemin({ type: 'lecture', idCarte: 'x' })).toBe('/api/marketplace/mine')
  })
  it('lit les étiquettes, même une liste vide ; sans liste, rien', () => {
    const stats = { total: 3, totalUnique: 2, tagOptions: [{ id: U1, name: '#Animaux', color: '#fff', cardCount: 4 }] }
    expect(entree.lireEtiquettes!(stats)).toEqual([{ id: U1, nom: '#Animaux', nbCartes: 4 }])
    expect(entree.lireEtiquettes!({ total: 3, tagOptions: [] })).toEqual([])
    expect(entree.lireEtiquettes!({ total: 3 })).toBeNull()
    // Une option illisible écartée rend la liste incomplète : aucune réconciliation.
    expect(entree.lireEtiquettes!({ total: 3, tagOptions: [stats.tagOptions[0], { id: U2, name: '', cardCount: 1 }] })).toBeNull()
    expect(entree.validerReponse(200, stats, { type: 'lecture', idCarte: 'x', cible: 'etiquettes' })).toBe('reussie')
    expect(entree.validerReponse(200, stats, { type: 'lecture', idCarte: 'x' })).toBe('hors-contrat')
    expect(entree.validerReponse(200, { maxConcurrentAuctions: 5 }, { type: 'lecture', idCarte: 'x', cible: 'etiquettes' })).toBe('hors-contrat')
  })
  it('messages : ordre et résultat validés strictement', () => {
    expect(validerOrdre({ message: 'ordre', ordre: { type: 'lecture', idCarte: 'x', cible: 'etiquettes' } })).toEqual({ type: 'lecture', idCarte: 'x', cible: 'etiquettes' })
    expect(validerOrdre({ message: 'ordre', ordre: { type: 'lecture', idCarte: 'x', cible: 'autre' } })).toBeNull()
    const ok = { message: 'resultat', resultat: { classe: 'reussie', codeHttp: 200, cause: 'action réussie', etiquettes: [{ id: U2, nom: '#Cinéma', nbCartes: 1 }] } }
    expect(validerResultat(ok)?.etiquettes).toEqual([{ id: U2, nom: '#Cinéma', nbCartes: 1 }])
    expect(validerResultat({ ...ok, resultat: { ...ok.resultat, etiquettes: [{ id: 'pas-un-uuid', nom: 'x', nbCartes: 1 }] } })).toBeNull()
  })
})
