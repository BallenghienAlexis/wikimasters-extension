// Étoile manuelle et thèmes choisis (Alexis, 2026-11-17) : le choix du joueur prime sur toute règle, dans les deux sens.
// Données fictives.
import { describe, expect, it } from 'vitest'
import { TYPES_ACTION, type Action, type TypeAction, type TypesDisponibles } from '../../src/lib/actions'
import { analyserStockage, appliquerEdition, aEditionLocale, collectionVide, estFavori, estFavoriVerrouille, fusionnerCartesLues, type Carte, type Collection } from '../../src/lib/collection'
import { ENTREES_FAVORI } from '../../src/lib/contrat/favori'
import { construireLot, type Config } from '../../src/lib/lot'
import { validerOrdre } from '../../src/lib/messages'
import { registreVide } from '../../src/lib/registre'
import { appliquerResultat, reverifierAction } from '../../src/lib/revision'
import { creerSauvegarde, lireSauvegarde, serialiserSauvegarde } from '../../src/lib/sauvegarde'
import { themesChoisisValides } from '../../src/lib/themesChoisis'
import { themesDeCarte, themesPrincipaux, sansThemeLocal } from '../../src/lib/themes'
import { estProposable } from '../../src/lib/selectionLot'
import { valeurDeTri } from '../../src/app/TableauCartes'
import { themesAimesDesFavoris } from '../../src/lib/tri'

const EX = '11111111-1111-4111-8111-111111111111'
const CTX = { idJoueur: '33333333-3333-4333-8333-333333333333', couleurEtiquette: '#112233' }
const TOUS: TypesDisponibles = new Set<TypeAction>(TYPES_ACTION)
const ID = 'commune|Berger allemand'

const carte = (extra: Partial<Carte> = {}): Carte => ({
  id: ID, titre: 'Berger allemand', rarete: 'commune', description: 'race de chien', quantite: 2, url: null,
  favori: false, idsSite: ['ex-1', 'ex-2'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: 10, ...extra,
})
const coll = (...cartes: Carte[]): Collection => ({ ...collectionVide(), cartes })
const config = (extra: Partial<Config> = {}): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: null, nomsExistants: [], mesThemes: ['chien'], ...extra })
const favoris = (c: Collection, cfg = config()) => construireLot(c, registreVide(), cfg, TOUS).actions.filter((a) => a.type === 'favori')

describe('favori manuel : état effectif', () => {
  it('le choix prime sur le site, dans les deux sens', () => {
    expect(estFavori(carte({ favori: true, choixFavori: false }))).toBe(false)
    expect(estFavori(carte({ favori: false, choixFavori: true }))).toBe(true)
    expect(estFavori(carte({ favori: true }))).toBe(true)
    expect(estFavori(carte({ favori: true, choixFavori: null }))).toBe(true)
  })
  it('un choix compte comme édition locale (jamais perdu par une synchro) et survit à la lecture du site', () => {
    expect(aEditionLocale(carte({ choixFavori: false }))).toBe(true)
    expect(aEditionLocale(carte({ themesChoisis: ['chien'] }))).toBe(true)
    const edite = appliquerEdition(coll(carte()), ID, { choixFavori: false })
    const relu = fusionnerCartesLues(edite, [{ id: ID, titre: 'Berger allemand', rarete: 'commune', quantite: 2, url: null, favori: true }])
    expect(relu.cartes[0]!.choixFavori).toBe(false)
    expect(relu.cartes[0]!.favori).toBe(true)
  })
  it('stockage : valide et conserve les champs, refuse un choix invalide', () => {
    const ok = analyserStockage({ version: 4, cartes: [{ id: ID, titre: 'X', choixFavori: false, themesChoisis: ['chien'] }] })
    expect(ok.ok && ok.collection.cartes[0]!.choixFavori).toBe(false)
    expect(analyserStockage({ version: 4, cartes: [{ id: ID, titre: 'X', choixFavori: 'oui' }] }).ok).toBe(false)
    expect(analyserStockage({ version: 4, cartes: [{ id: ID, titre: 'X', themesChoisis: ['autres'] }] }).ok).toBe(false)
  })
  it('sauvegarde : le choix est sauvegardé et relu', () => {
    const s = creerSauvegarde({ collection: coll(carte({ choixFavori: false, themesChoisis: ['chien'] })), preferences: { version: 2, mesThemes: [], amis: [] }, syncAuto: true, ventes: [] }, new Date('2026-11-17T10:00:00Z'))
    const lu = lireSauvegarde(serialiserSauvegarde(s))
    expect(lu.ok && lu.sauvegarde.cartes[0]!.choixFavori).toBe(false)
    expect(lu.ok && lu.sauvegarde.cartes[0]!.themesChoisis).toEqual(['chien'])
  })
})

describe('favori manuel : le lot', () => {
  it('cocher envoie le premier exemplaire seulement, avec valeur true', () => {
    expect(favoris(coll(carte({ choixFavori: true })), config({ mesThemes: [] }))).toEqual([{ type: 'favori', idCarte: ID, idExemplaire: 'ex-1', valeur: true }])
  })
  it('décocher envoie tous les exemplaires, avec valeur false', () => {
    expect(favoris(coll(carte({ favori: true, choixFavori: false })), config({ mesThemes: [] }))).toEqual([
      { type: 'favori', idCarte: ID, idExemplaire: 'ex-1', valeur: false },
      { type: 'favori', idCarte: ID, idExemplaire: 'ex-2', valeur: false },
    ])
  })
  it('une carte décochée à la main n’est jamais remise en favori par la règle des thèmes gardés', () => {
    expect(favoris(coll(carte({ favori: false, choixFavori: false })))).toHaveLength(0)
    expect(favoris(coll(carte({ favori: true, choixFavori: false })))).not.toContainEqual(expect.objectContaining({ valeur: true }))
  })
  it('une carte cochée à la main n’est jamais décochée par une règle (aucune action sans choix)', () => {
    expect(favoris(coll(carte({ favori: true, choixFavori: true })))).toHaveLength(0)
    // Sans choix, aucune règle ne produit jamais de retrait.
    for (const c of [carte({ favori: true }), carte({ favori: true, mesThemes: [] } as Partial<Carte>)]) {
      expect(favoris(coll(c)).some((a) => a.type === 'favori' && a.valeur === false)).toBe(false)
    }
  })
  it('déjà synchronisé : rien à envoyer', () => {
    expect(favoris(coll(carte({ favori: true, choixFavori: true })))).toHaveLength(0)
    expect(favoris(coll(carte({ favori: false, choixFavori: false })), config({ mesThemes: [] }))).toHaveLength(0)
  })
  it('un favori voulu à la main est verrouillé pour la vente et la défausse', () => {
    expect(estFavoriVerrouille(carte({ choixFavori: true }))).toBe(true)
    expect(estProposable(carte({ choixFavori: true }))).toBe(false)
    expect(estProposable(carte({ favori: true, choixFavori: false }))).toBe(false) // le site la verrouille encore tant que le lot n'est pas passé
    expect(estProposable(carte({ favori: false, choixFavori: false }))).toBe(true)
  })
})

describe('favori manuel : revérification et application', () => {
  const cocher: Action = { type: 'favori', idCarte: ID, idExemplaire: 'ex-1', valeur: true }
  const decocher: Action = { type: 'favori', idCarte: ID, idExemplaire: 'ex-2', valeur: false }
  const verif = (a: Action, c: Carte) => reverifierAction(a, coll(c), registreVide(), config())
  it('ok seulement tant que le choix du joueur est le même', () => {
    expect(verif(cocher, carte({ choixFavori: true }))).toBe('ok')
    expect(verif(cocher, carte({ choixFavori: false }))).toBe('passee')
    expect(verif(cocher, carte())).toBe('passee')
    expect(verif(cocher, carte({ choixFavori: true, favori: true }))).toBe('passee')
    expect(verif(decocher, carte({ choixFavori: false, favori: true }))).toBe('ok')
    // Deuxième exemplaire après un premier succès (favori déjà remis à false) : toujours envoyé.
    expect(verif(decocher, carte({ choixFavori: false, favori: false }))).toBe('ok')
    expect(verif(decocher, carte({ choixFavori: true }))).toBe('passee')
  })
  it('la règle des thèmes gardés est passée dès qu’un choix existe', () => {
    const regle: Action = { type: 'favori', idCarte: ID, idExemplaire: 'ex-1' }
    expect(verif(regle, carte())).toBe('ok')
    expect(verif(regle, carte({ choixFavori: false }))).toBe('passee')
  })
  it('succès : met favori à la valeur envoyée', () => {
    const ok = { classe: 'reussie', codeHttp: 204, cause: 'x' } as const
    expect(appliquerResultat(coll(carte()), registreVide(), cocher, ok).collection.cartes[0]!.favori).toBe(true)
    expect(appliquerResultat(coll(carte({ favori: true })), registreVide(), decocher, ok).collection.cartes[0]!.favori).toBe(false)
  })
})

describe('favori manuel : contrat et protocole', () => {
  const e = ENTREES_FAVORI.favori!
  it('corps starred false seulement avec valeur false', () => {
    expect(e.construireCorps({ type: 'favori', idCarte: ID, idExemplaire: EX, valeur: false }, CTX)).toEqual({ starred: false })
    expect(e.construireCorps({ type: 'favori', idCarte: ID, idExemplaire: EX, valeur: true }, CTX)).toEqual({ starred: true })
    expect(e.construireCorps({ type: 'favori', idCarte: ID, idExemplaire: EX }, CTX)).toEqual({ starred: true })
  })
  it('le protocole accepte une valeur booléenne et rejette le reste', () => {
    const ordre = { type: 'favori', idCarte: ID, idExemplaire: EX }
    expect(validerOrdre({ message: 'ordre', ordre: { ...ordre, valeur: false } })).toEqual({ ...ordre, valeur: false })
    expect(validerOrdre({ message: 'ordre', ordre: { ...ordre, valeur: 'non' } })).toBeNull()
    expect(validerOrdre({ message: 'ordre', ordre: { ...ordre, valeur: null } })).toBeNull()
  })
})

describe('favori manuel : tri et thèmes aimés', () => {
  it('tri par favori : favoris d’abord en croissant, état effectif', () => {
    expect(valeurDeTri(carte({ choixFavori: true }), 'favori')).toBe(0)
    expect(valeurDeTri(carte({ favori: true, choixFavori: false }), 'favori')).toBe(1)
    expect(valeurDeTri(carte(), 'favori')).toBe(1)
  })
  it('les thèmes aimés suivent l’état effectif', () => {
    expect(themesAimesDesFavoris([carte({ choixFavori: true })]).length).toBeGreaterThan(0)
    expect(themesAimesDesFavoris([carte({ favori: true, choixFavori: false })])).toHaveLength(0)
  })
})

describe('thèmes choisis à la main', () => {
  it('validation : 1 à 4 thèmes du catalogue, distincts, jamais « autres »', () => {
    expect(themesChoisisValides(['chien'])).toBe(true)
    expect(themesChoisisValides([])).toBe(false)
    expect(themesChoisisValides(['chien', 'chien'])).toBe(false)
    expect(themesChoisisValides(['autres'])).toBe(false)
    expect(themesChoisisValides(['inconnu-xyz'])).toBe(false)
    expect(themesChoisisValides(['chien', 'musique', 'metal', 'sport', 'voiture'])).toBe(false)
  })
  it('ils remplacent les thèmes déduits', () => {
    const c = carte({ themesChoisis: ['musique'] })
    expect(themesPrincipaux(c)).toEqual(['musique'])
    expect(themesDeCarte(c)).toContain('musique')
    expect(themesDeCarte(c)).not.toContain('chien')
  })
  it('une carte sans thème fiable en reçoit par le choix du joueur, et le lot pose son étiquette', () => {
    const sans = carte({ titre: 'Zzqx', description: '', id: 'commune|Zzqx' })
    expect(sansThemeLocal(sans)).toBe(true)
    const choisie = { ...sans, themesChoisis: ['musique'] }
    expect(sansThemeLocal(choisie)).toBe(false)
    const lot = construireLot(coll(choisie), registreVide(), config({ mesThemes: [] }), TOUS)
    expect(lot.actions.some((a) => a.type === 'pose-etiquette' && /musique/i.test(a.nomEtiquette))).toBe(true)
  })
})
