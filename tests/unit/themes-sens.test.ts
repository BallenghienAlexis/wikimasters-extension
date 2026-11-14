// Jeu d’essai de l’extraction des étiquettes par le sens : descriptions courtes du site, résumés et catégories Wikipédia
// reconstitués (aucune donnée du compte). Chaque cas dit ce qui doit sortir et ce qui ne doit surtout pas sortir.
import { afterEach, describe, expect, it } from 'vitest';
import { definition, genreDe } from '../../src/lib/sens';
import { definirSignauxWikipedia, MAX_THEMES_PAR_CARTE, themesPrincipaux } from '../../src/lib/themes';
import { signauxWikipedia } from '../../src/lib/wikipedia';

interface Cas {
  titre: string;
  site: string;
  resume?: string;
  categories?: string[];
  attendus: string[];
  interdits: string[];
}

const CAS: Cas[] = [
  {
    titre: 'Élisabeth en Bavière (1876-1965)',
    site: 'reine consort des Belges',
    resume: 'Élisabeth Gabrielle Valérie Marie de Wittelsbach, duchesse en Bavière, née le 25 juillet 1876 à Possenhofen en Bavière (Allemagne) et morte le 23 novembre 1965 à Laeken (Bruxelles, Belgique), est la troisième reine des Belges de 1909 à 1934. Issue de la branche cadette de la maison de Wittelsbach, elle épouse en 1900 le prince Albert de Belgique.',
    categories: ['Reine des Belges', 'Naissance en 1876', 'Décès en 1965', 'Maison de Wittelsbach', 'Première Guerre mondiale', 'Médecin militaire', 'Lion d’or', 'Étoile polaire'],
    attendus: ['royaute'],
    interdits: ['nature', 'sciences', 'felin', 'animaux', 'espace', 'geographie', 'ville'],
  },
  {
    titre: 'Mookie',
    site: 'film de Hervé Palud, sorti en 1998',
    resume: 'Mookie est un film français réalisé par Hervé Palud, sorti en 1998. Un enfant se lie d’amitié avec un singe, un chimpanzé nommé Mookie, qui vit dans la nature.',
    categories: ['Film français sorti en 1998', 'Comédie française', 'Film mettant en scène un singe'],
    attendus: ['cinema'],
    interdits: ['nature', 'animaux', 'singe'],
  },
  {
    titre: 'Lions de Trois-Rivières',
    site: 'équipe canadienne de la East Coast Hockey League basée au Québec',
    resume: 'Les Lions de Trois-Rivières sont une franchise de hockey sur glace de l’ECHL basée à Trois-Rivières dans la province de Québec au Canada. Elle est affiliée aux Canadiens de Montréal. L’équipe évolue au Colisée Vidéotron, au bord du fleuve Saint-Laurent.',
    categories: ['Club de hockey sur glace au Québec', 'Trois-Rivières', 'Lion dans la culture'],
    attendus: ['hockey'],
    interdits: ['felin', 'nature', 'animaux', 'fleuve'],
  },
  {
    titre: 'Ebrahim Raïssi',
    site: 'religieux chiite et homme d’État iranien',
    resume: 'Ebrahim Raïssi, né le 14 décembre 1960 à Machhad et mort accidentellement le 19 mai 2024 à Khunirud, est un religieux chiite et homme d’État iranien. Il est président de la république islamique d’Iran de 2021 à sa mort, dans un accident d’hélicoptère.',
    categories: ['Président de la République islamique d’Iran', 'Mort dans un accident d’avion', 'Accident d’hélicoptère'],
    attendus: ['politique', 'religion'],
    interdits: ['avion', 'vehicule', 'geographie', 'societe'],
  },
  {
    titre: 'Noir (anime)',
    site: 'anime japonais',
    resume: 'Noir (ノワール, Nowāru) est un anime réalisé par Kōichi Mashimo et produit par le studio Bee Train. Il est diffusé pour la première fois au Japon en 2001. La série tourne autour de deux tueuses à gages et de leur voyage pour trouver des réponses.',
    categories: ['Série télévisée d’animation japonaise', 'Série télévisée japonaise des années 2000'],
    attendus: ['bd'],
    interdits: ['train', 'vehicule'],
  },
  {
    titre: 'Tigre',
    site: 'espèce de mammifères carnivores',
    resume: 'Le tigre est une espèce de mammifères carnivores de la famille des félidés.',
    categories: ['Espèce de félins', 'Faune d’Asie'],
    attendus: ['felin'], // « Animaux » est l’ancêtre de « Félin » : le thème précis suffit (#144)
    interdits: ['cinema', 'sport'],
  },
  {
    titre: 'Pont du Gard',
    site: 'pont romain en France',
    attendus: ['pont'],
    interdits: ['felin', 'animaux'],
  },
  {
    titre: 'Jupiter',
    site: 'planète du Système solaire',
    attendus: ['planete'],
    interdits: ['mythologie'],
  },
  {
    titre: 'Daft Punk',
    site: 'duo français de musique électronique',
    resume: 'Daft Punk est un groupe de musique électronique français, formé à Paris en 1993.',
    attendus: ['techno'],
    interdits: ['vehicule', 'espace'],
  },
];

afterEach(() => definirSignauxWikipedia(new Map()));

describe.each(CAS)('$titre', ({ titre, site, resume, categories, attendus, interdits }) => {
  it('garde les étiquettes principales et rien d’extrapolé', () => {
    if (resume) definirSignauxWikipedia(new Map([[titre, signauxWikipedia(categories ?? [], resume)]]));
    const themes = themesPrincipaux({ titre, description: site });
    expect(themes.length).toBeLessThanOrEqual(MAX_THEMES_PAR_CARTE);
    expect(themes.length).toBeGreaterThan(0);
    for (const t of attendus) expect(themes, `attendu ${t} dans ${themes.join(', ')}`).toContain(t);
    for (const t of interdits) expect(themes, `interdit ${t} dans ${themes.join(', ')}`).not.toContain(t);
  });
});

describe('sens des phrases', () => {
  it('extrait la définition, pas les noms propres qui suivent', () => {
    expect(definition('Noir est un anime réalisé par Kōichi Mashimo et produit par le studio Bee Train.')).toBe('anime');
    expect(definition('Les Lions de Trois-Rivières sont une franchise de hockey sur glace de l’ECHL basée à Trois-Rivières.')).toBe('franchise de hockey sur glace de l\'echl');
    expect(definition('reine consort des Belges')).toBe('reine consort des belges');
  });
  it('ne coupe pas la phrase sur une initiale et reconnaît « né » sans métier listé', () => {
    expect(definition('J. R. R. Tolkien est un écrivain britannique.')).toBe('ecrivain britannique');
    expect(genreDe('Neil Armstrong, né le 5 août 1930, est un astronaute américain.')).toBe('personne');
    expect(genreDe('Série (1994-2004) japonaise')).not.toBe('personne');
  });
  it('reconnaît la nature du sujet', () => {
    expect(genreDe('Élisabeth, née le 25 juillet 1876 à Laeken, est reine des Belges.')).toBe('personne');
    expect(genreDe('film de Hervé Palud, sorti en 1998')).toBe('oeuvre');
    expect(genreDe('équipe canadienne de hockey')).toBe('organisation');
  });
});

// Classes Wikidata relevées le 2026-11-14 (instance de, occupation, genre, sport) : sans résumé ni catégorie, elles suffisent.
describe('classes Wikidata seules', () => {
  const CLASSES: [string, string, string[], boolean, string[], string[]][] = [
    ['Mookie', 'film de Hervé Palud, sorti en 1998', ['film', 'comédie'], false, ['cinema'], ['singe', 'animaux', 'nature']],
    ['Lions de Trois-Rivières', 'équipe canadienne de la East Coast Hockey League basée au Québec', ['équipe de hockey sur glace', 'hockey sur glace'], false, ['hockey'], ['felin', 'fleuve']],
    ['Ebrahim Raïssi', 'religieux chiite et homme d’État iranien', ['personnalité politique', 'cadi', 'faqîh', 'clerc', 'juriste'], true, ['politique'], ['avion', 'vehicule']],
    ['Noir (anime)', 'anime japonais', ['série d’animation japonaise', 'néo-noir', 'manga et anime d’action', 'anime et manga à mystère'], false, ['bd'], ['train', 'vehicule']],
    ['Tigre', 'espèce de mammifères carnivores', ['taxon'], false, ['animaux'], ['cinema']],
    ['Pont du Gard', 'pont romain en France', ['pont en arc', 'aqueduc romain', 'pont romain'], false, ['pont'], ['felin']],
    ['Daft Punk', 'duo français de musique électronique', ['duo de musique électronique', 'groupe de musique', 'house', 'musique électronique', 'French touch'], false, ['techno'], ['vehicule']],
  ];
  it.each(CLASSES)('%s', (titre, site, classes, humain, attendus, interdits) => {
    definirSignauxWikipedia(new Map([[titre, signauxWikipedia([], '', [], classes, humain)]]));
    const themes = themesPrincipaux({ titre, description: site });
    expect(themes.length).toBeLessThanOrEqual(MAX_THEMES_PAR_CARTE);
    for (const t of attendus) expect(themes, themes.join(', ')).toContain(t);
    for (const t of interdits) expect(themes, themes.join(', ')).not.toContain(t);
  });
});

describe('métiers annexes Wikidata', () => {
  it('Élisabeth reste centrée sur l’essentiel malgré des occupations annexes', () => {
    const titre = 'Élisabeth en Bavière (1876-1965)';
    definirSignauxWikipedia(new Map([[titre, signauxWikipedia([], '', [], ['reine consort', 'photographe', 'infirmière', 'peintre', 'musicienne'], true)]]));
    const themes = themesPrincipaux({ titre, description: 'reine consort des Belges' });
    expect(themes.length).toBeLessThanOrEqual(MAX_THEMES_PAR_CARTE);
    expect(themes).toContain('royaute');
  });
});
