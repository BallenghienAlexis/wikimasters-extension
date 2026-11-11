import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/lib/actions'
import { ENTREES_ETIQUETTES } from '../../src/lib/contrat/etiquettes'

// Identifiants fictifs.
const EX = '11111111-1111-4111-8111-111111111111'
const ET = '22222222-2222-4222-8222-222222222222'
const CTX = { idJoueur: '33333333-3333-4333-8333-333333333333', couleurEtiquette: '#112233' }

const pose: Action = { type: 'pose-etiquette', idCarte: 'R|T', idExemplaire: EX, nomEtiquette: 'Garder', idEtiquette: ET }
const retrait: Action = { type: 'retrait-etiquette', idCarte: 'R|T', idExemplaire: EX, nomEtiquette: 'Garder', idEtiquette: ET }
const creation: Action = { type: 'creation-etiquette', idCarte: 'R|T', nomEtiquette: 'Garder' }

describe('contrat des étiquettes', () => {
  it('pose : POST user_card_tags avec user_card_id et tag_id seulement, 201 attendu', () => {
    const e = ENTREES_ETIQUETTES['pose-etiquette']!
    expect(e.methode).toBe('POST')
    expect(e.construireChemin(pose)).toBe('/rest/v1/user_card_tags')
    expect(e.construireCorps(pose, CTX)).toEqual({ user_card_id: EX, tag_id: ET })
    expect(e.validerReponse(201, null)).toBe('reussie')
    expect(e.validerReponse(200, null)).toBe('hors-contrat')
  })

  it('pose sans identifiant d’étiquette valide : pas de corps', () => {
    const e = ENTREES_ETIQUETTES['pose-etiquette']!
    expect(e.construireCorps({ ...pose, idEtiquette: undefined } as Action, CTX)).toBeNull()
    expect(e.construireCorps({ ...pose, idEtiquette: 'x' } as Action, CTX)).toBeNull()
  })

  it('retrait : DELETE filtré par exemplaire et étiquette, jamais sur tags, 204 attendu', () => {
    const e = ENTREES_ETIQUETTES['retrait-etiquette']!
    expect(e.methode).toBe('DELETE')
    expect(e.construireChemin(retrait)).toBe(`/rest/v1/user_card_tags?user_card_id=eq.${EX}&tag_id=eq.${ET}`)
    expect(e.construireChemin(retrait)).not.toContain('/tags?')
    expect(e.construireCorps(retrait, CTX)).toBeNull()
    expect(e.validerReponse(204, null)).toBe('reussie')
    expect(() => e.construireChemin({ ...retrait, idEtiquette: 'a&b' } as Action)).toThrow()
  })

  it('création : corps user_id, name, color ; l’identifiant renvoyé est validé', () => {
    const e = ENTREES_ETIQUETTES['creation-etiquette']!
    expect(e.construireCorps(creation, CTX)).toEqual({ user_id: CTX.idJoueur, name: 'Garder', color: '#112233' })
    const reponse = { id: ET, user_id: CTX.idJoueur, name: 'Garder', created_at: 'x', color: '#112233' }
    expect(e.validerReponse(201, reponse)).toBe('reussie')
    expect(e.lireIdEtiquette?.(reponse)).toBe(ET)
    expect(e.lireIdEtiquette?.([reponse])).toBe(ET)
    expect(e.validerReponse(201, { id: 'pas-un-uuid' })).toBe('hors-contrat')
    expect(e.validerReponse(201, null)).toBe('hors-contrat')
    expect(e.validerReponse(200, reponse)).toBe('hors-contrat')
  })

  it('le source ne contient ni jeton, ni décodage de jeton, ni valeur de joueur', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/config/synchro.ts', import.meta.url)), 'utf8')
    for (const interdit of ['atob', 'JSON.parse', 'user_id']) expect(source).not.toContain(interdit)
    expect(source).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })
})
