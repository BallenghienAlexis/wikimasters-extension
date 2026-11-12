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
