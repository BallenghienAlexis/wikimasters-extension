// POC A : lecture de la page Wikipédia COMPLÈTE (wikitexte de `action=parse`) en canaux distincts.
// Pur et sans réseau : le collecteur (collecter.mjs) produit la réponse brute, ce module la découpe.
export interface PageComplete {
  titre: string;
  /** Modèle d’infobox (ex. « Infobox Musique (artiste) ») ; vide si absente. */
  infoboxModele: string;
  /** Valeurs textuelles des champs d’infobox utiles (genre, profession, sport…), sans balisage. */
  infoboxValeurs: string[];
  /** Première phrase de l’introduction (la définition « X est un… »). */
  definition: string;
  /** Reste de l’introduction. */
  intro: string;
  /** Titres de sections (hors « Notes et références », « Liens externes »…). */
  sections: string[];
  /** Texte brut des sections, tronqué. */
  corps: string;
  /** Catégories visibles (sans « Catégorie: »). */
  categories: string[];
  /** Titres des pages liées (espace principal), 150 au plus. */
  liens: string[];
  homonymie: boolean;
}

const CHAMPS_UTILES = /^(genre|genres|genre musical|style|profession|activit[eé]s?|fonction|occupation|sport|discipline|type|nature|domaine|sp[eé]cialit[eé]|cat[eé]gorie|classification|ordre|famille|r[eè]gne|embranchement|forme|mati[eè]re|usage)$/i;
const SECTIONS_IGNOREES = /^(notes?( et r[eé]f[eé]rences?)?|r[eé]f[eé]rences?|voir aussi|liens? externes?|bibliographie|annexes?|articles? connexes?|sources?)$/i;
const MAX_CORPS = 6000;

const retirerModeles = (t: string): string => {
  let texte = t;
  for (let i = 0; i < 6 && texte.includes('{{'); i += 1) texte = texte.replace(/\{\{[^{}]*\}\}/g, ' ');
  return texte;
};

/** Wikitexte → texte brut approximatif (liens, balises, modèles, gras et italique retirés). */
export function enTexteBrut(wikitexte: string): string {
  return retirerModeles(wikitexte)
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\[(?:Fichier|File|Image|Cat[eé]gorie):[^\]]*\]\]/gi, ' ')
    .replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:[^\s\]]+\s*([^\]]*)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extrait l’infobox principale : nom du modèle et valeurs des champs utiles (profondeur 1 seulement). */
export function lireInfobox(wikitexte: string): { modele: string; valeurs: string[] } {
  const debut = /\{\{\s*(Infobox[^|{}\n]*|Taxobox[^|{}\n]*)/i.exec(wikitexte);
  if (!debut) return { modele: '', valeurs: [] };
  const modele = (debut[1] ?? '').trim();
  let profondeur = 0;
  let fin = wikitexte.length;
  for (let i = debut.index; i < wikitexte.length; i += 1) {
    const deux = wikitexte.slice(i, i + 2);
    if (deux === '{{') { profondeur += 1; i += 1; }
    else if (deux === '}}') { profondeur -= 1; i += 1; if (profondeur === 0) { fin = i + 1; break; } }
  }
  const corps = wikitexte.slice(debut.index + debut[0].length, fin - 2);
  // Découpe aux « | » de profondeur 0 du corps (hors modèles et liens imbriqués).
  const champs: string[] = [];
  let niveau = 0;
  let courant = '';
  for (let i = 0; i < corps.length; i += 1) {
    const deux = corps.slice(i, i + 2);
    if (deux === '{{' || deux === '[[') { niveau += 1; courant += deux; i += 1; }
    else if (deux === '}}' || deux === ']]') { niveau -= 1; courant += deux; i += 1; }
    else if (corps[i] === '|' && niveau === 0) { champs.push(courant); courant = ''; }
    else courant += corps[i];
  }
  champs.push(courant);
  const valeurs: string[] = [];
  for (const champ of champs) {
    const egal = champ.indexOf('=');
    if (egal < 0) continue;
    const cle = champ.slice(0, egal).trim();
    if (!CHAMPS_UTILES.test(cle)) continue;
    const valeur = enTexteBrut(champ.slice(egal + 1)).replace(/\s+/g, ' ').trim();
    if (valeur.length > 0 && valeur.length < 200) valeurs.push(valeur);
  }
  return { modele, valeurs: valeurs.slice(0, 12) };
}

const premierePhrase = (texte: string): string => {
  const m = /^[\s\S]*?[.!?](?=\s+[A-ZÀ-ÖØ-Þ«"(]|\s*$)/.exec(texte);
  return (m ? m[0] : texte).slice(0, 400).trim();
};

/** Réponse brute de `action=parse` (formatversion 2, prop=wikitext|categories|sections|links|properties) → page découpée. */
export function analyserReponseParse(brut: unknown, titre: string): PageComplete | null {
  const parse = typeof brut === 'object' && brut !== null ? (brut as { parse?: unknown }).parse : null;
  if (typeof parse !== 'object' || parse === null) return null;
  const p = parse as Record<string, unknown>;
  const wikitexte = typeof p.wikitext === 'string' ? p.wikitext : '';
  if (wikitexte.length === 0) return null;
  const infobox = lireInfobox(wikitexte);
  const coupe = wikitexte.search(/\n==[^=]/);
  const tete = coupe < 0 ? wikitexte : wikitexte.slice(0, coupe);
  const reste = coupe < 0 ? '' : wikitexte.slice(coupe);
  const introBrute = enTexteBrut(tete).replace(/^(Cet article|Pour les articles).*\n/gim, '').trim();
  const definition = premierePhrase(introBrute);
  const categories = Array.isArray(p.categories)
    ? p.categories.flatMap((c) => (typeof c === 'object' && c !== null && typeof (c as { category?: unknown }).category === 'string' && (c as { hidden?: unknown }).hidden !== true ? [String((c as { category: string }).category).replaceAll('_', ' ')] : []))
    : [];
  const sections = Array.isArray(p.sections)
    ? p.sections.flatMap((s) => (typeof s === 'object' && s !== null && typeof (s as { line?: unknown }).line === 'string' ? [enTexteBrut((s as { line: string }).line)] : [])).filter((s) => !SECTIONS_IGNOREES.test(s))
    : [];
  const liens = Array.isArray(p.links)
    ? [...new Set(p.links.flatMap((l) => (typeof l === 'object' && l !== null && (l as { ns?: unknown }).ns === 0 && typeof (l as { title?: unknown }).title === 'string' ? [(l as { title: string }).title] : [])))].slice(0, 150)
    : [];
  const props = Array.isArray(p.properties) ? p.properties : [];
  const homonymie = props.some((x) => typeof x === 'object' && x !== null && (x as { name?: unknown }).name === 'disambiguation');
  return {
    titre,
    infoboxModele: infobox.modele,
    infoboxValeurs: infobox.valeurs,
    definition,
    intro: introBrute.slice(definition.length).trim(),
    sections,
    corps: enTexteBrut(reste.replace(/\n==+\s*(Notes?( et r[eé]f[eé]rences?)?|Liens? externes?|Voir aussi|Bibliographie)\s*==+[\s\S]*$/i, '')).slice(0, MAX_CORPS),
    categories,
    liens,
    homonymie,
  };
}
