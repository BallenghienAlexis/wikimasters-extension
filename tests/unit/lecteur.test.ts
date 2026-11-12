import { describe, expect, it } from 'vitest';
import { analyserFenetreEnchere, analyserTexteCarte, descriptionProvisoire, identifiantCarte, regrouperCartes } from '../../src/lib/lecteur';

const AJOUTER = 'Ajouter aux favoris (verrouille la carte : ni défausse, ni vente, ni échange)';
const RETIRER = 'Retirer des favoris (déverrouille la carte)';

describe('analyserTexteCarte', () => {
  it('lit rareté et titre d’une carte avec description', () => {
    expect(analyserTexteCarte('UR\nLoutre fictive\nmammifère\n8 885\n9 526', AJOUTER)).toEqual({
      rarete: 'UR',
      titre: 'Loutre fictive',
      description: 'mammifère',
      favori: false,
    });
  });

  it('lit une carte sans description', () => {
    expect(analyserTexteCarte('C\nNashi fictif\n6 987\n3 800', AJOUTER)?.titre).toBe('Nashi fictif');
  });

  it('accepte les espaces insécables des nombres', () => {
    expect(analyserTexteCarte('R\nA\n8 885\n9 526', AJOUTER)).not.toBeNull();
  });

  it('repère un favori à son libellé', () => {
    expect(analyserTexteCarte('L\nA\n10 000\n9 252', RETIRER)?.favori).toBe(true);
  });

  it.each([
    ['une rareté inconnue', 'XX\nA\n1\n2'],
    ['des statistiques non numériques', 'R\nA\nun\ndeux'],
    ['trop peu de lignes', 'R\nA\n1'],
    ['trop de lignes', 'R\nA\nb\nc\n1\n2'],
    ['un texte vide', ''],
  ])('ignore %s', (_nom, texte) => {
    expect(analyserTexteCarte(texte, AJOUTER)).toBeNull();
  });

  it('ignore un titre trop long', () => {
    expect(analyserTexteCarte(`R\n${'a'.repeat(301)}\n1\n2`, AJOUTER)).toBeNull();
  });
});

describe('analyserFenetreEnchere', () => {
  const FENETRE = [
    'Mettre aux enchères',
    'Enchères actives : 0/5',
    'UR',
    'Loutre fictive',
    'mammifère',
    '8 885',
    '9 526',
    'Loutre fictive',
    'MARCHÉ · ULTRA RARE',
    'MOYENNE',
    '19',
    'MISE DE DÉPART',
  ];

  it('relève la carte et sa moyenne', () => {
    expect(analyserFenetreEnchere(FENETRE.join('\n'))).toEqual({ id: 'UR|Loutre fictive', valeur: 19 });
  });

  it('lit une moyenne à plusieurs chiffres', () => {
    const lignes = FENETRE.map((l) => (l === '19' ? '1 250' : l));
    expect(analyserFenetreEnchere(lignes.join('\n'))?.valeur).toBe(1250);
  });

  it.each([
    ['sans moyenne', FENETRE.filter((l) => l !== 'MOYENNE' && l !== '19')],
    ['avec une moyenne non numérique', FENETRE.map((l) => (l === '19' ? '—' : l))],
    ['avec une rareté inconnue', FENETRE.map((l) => (l === 'UR' ? 'XX' : l))],
    ['sans ligne de marché', FENETRE.filter((l) => !l.startsWith('MARCHÉ'))],
  ])('ignore une fenêtre %s', (_nom, lignes) => {
    expect(analyserFenetreEnchere(lignes.join('\n'))).toBeNull();
  });
});

describe('regrouperCartes', () => {
  it('compte les exemplaires d’une même carte', () => {
    const r = regrouperCartes([
      { rarete: 'C', titre: 'A', description: 'd', favori: false },
      { rarete: 'C', titre: 'A', description: 'd', favori: false },
      { rarete: 'R', titre: 'A', description: '', favori: true },
    ]);
    expect(r).toEqual([
      { id: identifiantCarte('C', 'A'), titre: 'A', rarete: 'C', description: 'd', quantite: 2, url: null, favori: false },
      { id: identifiantCarte('R', 'A'), titre: 'A', rarete: 'R', description: '', quantite: 1, url: null, favori: true },
    ]);
  });

  it('ne fournit aucune édition, pour préserver celle de l’utilisateur', () => {
    const [carte] = regrouperCartes([{ rarete: 'C', titre: 'A', description: '', favori: false }]);
    expect(carte).not.toHaveProperty('statut');
    expect(carte).not.toHaveProperty('prixCible');
    expect(carte).not.toHaveProperty('note');
  });
});

describe('descriptionProvisoire', () => {
  it('repère une description vide ou tronquée', () => {
    expect(descriptionProvisoire('')).toBe(true);
    expect(descriptionProvisoire('Un grand barrage…')).toBe(true);
    expect(descriptionProvisoire('Un grand barrage...')).toBe(true);
    expect(descriptionProvisoire('Un grand barrage.')).toBe(false);
  });
});
