import { describe, expect, it } from 'vitest'
import type { Carte } from '../../src/lib/collection'
import { registreVide, enregistrerEtiquette } from '../../src/lib/registre'
import { trierEtiquettes } from '../../src/lib/etiquettesPreexistantes'

// Données fictives uniquement.
const carte = (id: string, etiquettesSite: string[], extra: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: 'commune', description: '', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${id}`], etiquettesSite, statut: 'garder', prixCible: null, note: '', ami: null,
  valeurMarchande: null, decidePar: null, ...extra,
})

describe('trierEtiquettes', () => {
  it('sépare les étiquettes de l’extension des préexistantes', () => {
    const r = enregistrerEtiquette(registreVide(), 'Chiens', '11111111-1111-1111-1111-111111111111')
    const t = trierEtiquettes([carte('a', ['Statut · À garder', 'Chiens', 'Vieille', '#À échanger Tom']), carte('b', ['Vieille', 'Autre'])], r)
    expect(t.preexistantes).toEqual([{ nom: 'Autre', nbCartes: 1 }, { nom: 'Vieille', nbCartes: 2 }])
    expect(t.extension.map((e) => e.nom).sort()).toEqual(['#À échanger Tom', 'Chiens', 'Statut · À garder'])
  })

  it('ignore les cartes non reliées au site', () => {
    const t = trierEtiquettes([carte('a', ['Vieille'], { idsSite: null })], registreVide())
    expect(t.preexistantes).toEqual([])
  })

  it('ne confond pas un nom hérité du prototype avec le registre', () => {
    const t = trierEtiquettes([carte('a', ['constructor'])], registreVide())
    expect(t.preexistantes).toEqual([{ nom: 'constructor', nbCartes: 1 }])
  })
})

import { trierEtiquettesSite, validerEtiquettesSite } from '../../src/lib/etiquettesPreexistantes'
import { supprimerEtiquetteDuRegistre, poserCouple } from '../../src/lib/registre'
import { ENTREE_SUPPRESSION } from '../../src/lib/contrat/etiquettes'
import { validerOrdre } from '../../src/lib/messages'
import { ID_CARTE_ETIQUETTES, type Action } from '../../src/lib/actions'

const ID1 = '11111111-1111-4111-8111-111111111111'
const ID2 = '22222222-2222-4222-8222-222222222222'
const ID3 = '33333333-3333-4333-8333-333333333333'

describe('trierEtiquettesSite', () => {
  it('garde les étiquettes sans carte et reconnaît celles de l’extension par id, préfixe ou nom', () => {
    const r = enregistrerEtiquette(registreVide(), 'Chiens', ID1)
    const t = trierEtiquettesSite(
      [
        { id: ID1, nom: 'Renommée', nbCartes: 0 },
        { id: ID2, nom: 'Statut · À garder', nbCartes: 3 },
        { id: ID3, nom: 'Ancienne', nbCartes: 0 },
      ],
      [],
      r,
    )
    expect(t.filter((e) => e.origine === 'preexistante').map((e) => e.nom)).toEqual(['Ancienne'])
    expect(t).toHaveLength(3)
  })
})

describe('validerEtiquettesSite', () => {
  it('rejette une forme inattendue ou un doublon', () => {
    expect(validerEtiquettesSite([{ id: ID1, nom: 'A', nbCartes: 1 }])).toEqual([{ id: ID1, nom: 'A', nbCartes: 1 }])
    expect(validerEtiquettesSite([{ id: 'x', nom: 'A', nbCartes: 1 }])).toBeNull()
    expect(validerEtiquettesSite([{ id: ID1, nom: 'A', nbCartes: 1 }, { id: ID1, nom: 'B', nbCartes: 1 }])).toBeNull()
    expect(validerEtiquettesSite('x')).toBeNull()
  })
})

describe('suppression d’une étiquette', () => {
  const action: Action = { type: 'suppression-etiquette', idCarte: ID_CARTE_ETIQUETTES, nomEtiquette: 'Ancienne', idEtiquette: ID3 }

  it('contrat : POST rpc/delete_tag avec p_tag_id seul, 204 attendu', () => {
    expect(ENTREE_SUPPRESSION.methode).toBe('POST')
    expect(ENTREE_SUPPRESSION.construireChemin(action)).toBe('/rest/v1/rpc/delete_tag')
    expect(ENTREE_SUPPRESSION.construireCorps(action, { idJoueur: '', couleurEtiquette: '' })).toEqual({ p_tag_id: ID3 })
    expect(ENTREE_SUPPRESSION.construireCorps({ ...action, idEtiquette: 'x' } as Action, { idJoueur: '', couleurEtiquette: '' })).toBeNull()
    expect(ENTREE_SUPPRESSION.validerReponse(204, null)).toBe('reussie')
    expect(ENTREE_SUPPRESSION.validerReponse(200, null)).toBe('hors-contrat')
  })

  it('protocole : ordre valide, champ en trop ou id invalide rejetés', () => {
    expect(validerOrdre({ message: 'ordre', ordre: action })).toEqual(action)
    expect(validerOrdre({ message: 'ordre', ordre: { ...action, idEtiquette: 'x' } })).toBeNull()
    expect(validerOrdre({ message: 'ordre', ordre: { ...action, extra: 1 } })).toBeNull()
    expect(validerOrdre({ message: 'ordre', ordre: { ...action, idCarte: 'R|T' } })).toBeNull()
  })

  it('registre : oublie le nom et ses couples', () => {
    let r = enregistrerEtiquette(registreVide(), 'Ancienne', ID3)
    r = poserCouple(r, 'ex1', 'Ancienne')
    r = poserCouple(r, 'ex1', 'Autre')
    const apres = supprimerEtiquetteDuRegistre(r, 'Ancienne')
    expect(Object.keys(apres.etiquettes)).toEqual([])
    expect(apres.couples).toEqual([{ ex: 'ex1', nom: 'Autre' }])
  })
})

import { aSupprimer, annulerConfirmation, basculerSelection, demanderConfirmation, selectionVide } from '../../src/lib/etiquettesPreexistantes'

describe('sélection de suppression', () => {
  const sup = new Set(['a', 'b'])

  it('rien à envoyer sans confirmation', () => {
    const s = basculerSelection(selectionVide(), 'a')
    expect(aSupprimer(s, sup, false)).toEqual([])
  })

  it('pas de confirmation sans étiquette supprimable cochée', () => {
    expect(demanderConfirmation(selectionVide(), sup).confirmation).toBe(false)
    expect(demanderConfirmation(basculerSelection(selectionVide(), 'zz'), sup).confirmation).toBe(false)
  })

  it('envoie les seules étiquettes supprimables cochées, après confirmation', () => {
    let s = basculerSelection(basculerSelection(selectionVide(), 'a'), 'zz')
    s = demanderConfirmation(s, sup)
    expect(aSupprimer(s, sup, false)).toEqual(['a'])
  })

  it('annuler ou cocher/décocher retire la confirmation ; occupé : rien', () => {
    let s = demanderConfirmation(basculerSelection(selectionVide(), 'a'), sup)
    expect(aSupprimer(annulerConfirmation(s), sup, false)).toEqual([])
    expect(aSupprimer(basculerSelection(s, 'b'), sup, false)).toEqual([])
    expect(aSupprimer(s, sup, true)).toEqual([])
    s = basculerSelection(s, 'a')
    expect(s.cochees.size).toBe(0)
  })
})
