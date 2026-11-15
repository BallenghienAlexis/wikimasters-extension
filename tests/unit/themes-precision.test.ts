// Précision des thèmes : le thème le plus précis du catalogue, relevé sur de vraies pages Wikipédia (données publiques,
// 2026-11-15) : résumé, catégories visibles et classes Wikidata. Les parents ne sont pas posés mais restent donnés aux amis.
import { afterEach, describe, expect, it } from 'vitest';
import { definirSignauxWikipedia, themesDeTexte, themesPrincipaux } from '../../src/lib/themes';
import { signauxWikipedia } from '../../src/lib/wikipedia';

interface Cas { titre: string; resume: string; categories: string[]; wd: string[]; classes: string[]; humain?: boolean }

const CAS: Record<string, Cas> = {
  novelists: {
    titre: 'Novelists',
    resume: 'Novelists est un groupe français de metalcore, originaire de Paris et Marseille. Leur style musical allie des éléments propres au heavy metal (riff, growl, double grosse caisse) ainsi qu’un côté mélodieux (voix, solos, mélodie).',
    categories: ['Groupe de djent', 'Groupe français de metal progressif', 'Groupe français de metalcore', 'Groupe musical de Paris', 'Groupe musical français des années 2010'],
    wd: ['groupe de metalcore français'], classes: ['groupe de musique', 'metalcore'],
  },
  morcilla: {
    titre: 'Morcilla',
    resume: 'La morcilla est une charcuterie espagnole à base de sang de porc cuit dans un boyau. Il en existe une multitude de variétés. Son équivalent français est le boudin noir.',
    categories: ['Boudin noir', 'Charcuterie en Espagne'], wd: ['boudin noir espagnol'], classes: [],
  },
  tesla: {
    titre: 'Tesla Semi',
    resume: 'Le Tesla Semi est un camion électrique tracteur de semi-remorque (principe du véhicule articulé) présenté le 16 novembre 2017 et Pepsi a reçu en octobre 2022 les premiers exemplaires afin de les tester sur le terrain.',
    categories: ['Camion électrique', 'Concept-truck', 'Modèle de camion', 'Poids lourd des années 2020', 'Tesla (automobile)'],
    wd: ['semi-remorque électrique produit par Tesla'], classes: ['modèle de camion'],
  },
  hydravion: {
    titre: 'Hydravion',
    resume: 'Un hydravion (composé de hydro-, eau) est un avion ayant la capacité de se poser (amerrir) ou de décoller (déjauger) sur l’eau. Il en existe plusieurs types : hydravion à flotteurs, hydravion à coque, aéronef amphibie ou avion à effet de sol.',
    categories: ['Construction aéronautique', 'Hydravion', 'Invention française'], wd: ['avion qui décolle et atterrit sur l’eau'], classes: ['classe de puissance d’avion'],
  },
  planck: {
    titre: 'Longueur de Planck',
    resume: 'La longueur de Planck ou échelle de Planck est une unité de longueur qui fait partie du système d’unités naturelles dites unités de Planck et vaut 1,616 255(18)×10−35 m. Notée ℓP, elle est déterminée uniquement en termes des constantes fondamentales de la relativité, de la gravitation et de la mécanique quantique.',
    categories: ['Unité de Planck', 'Unité de longueur'], wd: ['unité de longueur'], classes: ['unité de longueur', 'constante physique', 'unités de Planck'],
  },
  houten: {
    titre: 'Leslie Van Houten',
    resume: 'Leslie Louise Van Houten (née le 23 août 1949) est une ancienne membre de la « famille » de Charles Manson condamnée pour les meurtres de Leno et Rosemary LaBianca à Los Angeles en 1969.',
    categories: ['Naissance en août 1949', 'Naissance à Altadena', 'Personnalité américaine condamnée pour crime'], wd: ['membre de la « famille » de Charles Manson'], classes: ['être humain', 'meurtrier ou meurtrière'], humain: true,
  },
  honda: {
    titre: 'Honda CB 900 F Bol d’Or',
    resume: 'La CB 900 F Bol d’Or est un modèle de moto sportive du constructeur japonais Honda. Son nom fait référence aux victoires de la marque dans cette épreuve d’endurance.',
    categories: [], wd: [], classes: [],
  },
  laurin: {
    titre: 'Camille-Laurin (circonscription provinciale)',
    resume: 'Camille-Laurin (appelée Bourget jusqu’en 2022) est une circonscription électorale provinciale du Québec située dans la région de Montréal. Elle a été créée en 1960.',
    categories: [], wd: [], classes: [],
  },
};

const ids = (c: Cas): string[] => {
  definirSignauxWikipedia(new Map([[c.titre, signauxWikipedia(c.categories, c.resume, c.wd, c.classes, c.humain === true)]]));
  return themesPrincipaux({ titre: c.titre, description: '' });
};

afterEach(() => definirSignauxWikipedia(new Map()));

describe('thème le plus précis', () => {
  it('Novelists : Metalcore, avec Métal et Musique en parents pour les amis', () => {
    expect(ids(CAS['novelists']!)).toEqual(['metalcore']);
    expect(themesDeTexte('groupe de metalcore')).toEqual(expect.arrayContaining(['metalcore', 'metal', 'musique']));
  });
  it('Morcilla : Gastronomie', () => expect(ids(CAS['morcilla']!)).toEqual(['gastronomie']));
  it('Tesla Semi : Camion seulement (un camion tracteur n’est pas un tracteur)', () => expect(ids(CAS['tesla']!)).toEqual(['camion']));
  it('Hydravion : Avion', () => expect(ids(CAS['hydravion']!)).toEqual(['avion']));
  it('Longueur de Planck : Physique (parent Sciences)', () => {
    expect(ids(CAS['planck']!)).toEqual(['physique']);
    expect(themesDeTexte('unité de Planck')).toEqual(expect.arrayContaining(['physique', 'sciences']));
  });
  it('Leslie Van Houten : Crime', () => expect(ids(CAS['houten']!)).toEqual(['crime']));
  it('Honda CB 900 F Bol d’Or : Moto', () => expect(ids(CAS['honda']!)).toEqual(['moto']));
  it('Camille-Laurin : Politique (circonscription électorale), pas Histoire', () => {
    const t = ids(CAS['laurin']!);
    expect(t).toContain('politique');
    expect(t).not.toContain('histoire');
  });
});

// Revue de la PR #158 : les nouveaux motifs ne doivent pas déborder sur des textes courants.
describe('faux positifs des nouveaux motifs', () => {
  const themes = (texte: string): string[] => themesDeTexte(texte);
  it('« meurtrier » adjectif ne donne pas Crime', () => {
    expect(themes('séisme le plus meurtrier de l’histoire récente')).not.toContain('crime');
    expect(themes('une des batailles les plus meurtrières de la Première Guerre mondiale')).not.toContain('crime');
    expect(themes('pandémie meurtrière causée par un virus')).not.toContain('crime');
    expect(themes('un attentat meurtrier')).not.toContain('crime');
  });
  it('le meurtre nominal donne Crime', () => {
    expect(themes('condamnée pour les meurtres de deux personnes')).toContain('crime');
    expect(themes('meurtrier ou meurtrière')).toContain('crime');
  });
  it('metal-core avec trait d’union est du Metalcore', () => {
    expect(themes('un groupe de metal-core')).toContain('metalcore');
  });
  it('seule une circonscription électorale est Politique', () => {
    expect(themes('arrondissement de Brest, circonscription administrative')).not.toContain('politique');
    expect(themes('diocèse de Lyon, circonscription ecclésiastique')).not.toContain('politique');
    expect(themes('une circonscription électorale provinciale du Québec')).toContain('politique');
  });
  it('« physique » adjectif ne donne pas Physique', () => {
    expect(themes('activité physique')).not.toContain('physique');
    expect(themes('éducation physique et sportive')).not.toContain('physique');
    expect(themes('force physique, forme physique, violence physique, personnes physiques')).not.toContain('physique');
    expect(themes('la physique quantique')).toContain('physique');
    expect(themes('physicien allemand')).toContain('physique');
  });
  it('« sportive » ne donne pas Sport après un véhicule, pluriel compris', () => {
    expect(themes('les voitures sportives de la marque')).not.toContain('sport');
    expect(themes('des motos sportives')).not.toContain('sport');
    expect(themes('une athlète sportive')).toContain('sport');
  });
  it('« tracteur routier » est un camion, pas un tracteur', () => {
    expect(themes('un tracteur routier')).not.toContain('tracteur');
    expect(themes('des tracteurs routiers, un tracteur semi-remorque')).not.toContain('tracteur');
    expect(themes('un tracteur agricole')).toContain('tracteur');
  });
});

