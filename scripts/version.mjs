// Versionnage de l'extension (semver MAJEUR.MINEUR.CORRECTIF, nombres non plafonnés à 9).
//   node scripts/version.mjs fix     → 1.10.15 devient 1.10.16
//   node scripts/version.mjs feat    → 1.10.15 devient 1.11.0
//   node scripts/version.mjs major   → 1.10.15 devient 2.0.0
//   node scripts/version.mjs 1.4.2   → fixe la version
//   node scripts/version.mjs check   → vérifie la cohérence (code de sortie 1 sinon)
// Source de vérité : package.json ; le manifeste Chrome et package-lock.json suivent.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MOTIF = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function versionValide(version) {
  return typeof version === 'string' && MOTIF.test(version);
}

/** Incrémente selon le type : fix (+0.0.1), feat (+0.1.0, correctif remis à 0), major (+1.0.0). */
export function incrementer(version, type) {
  const m = typeof version === 'string' ? MOTIF.exec(version) : null;
  if (!m) throw new Error(`Version illisible : ${String(version)}`);
  const [maj, min, cor] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (type === 'fix') return `${maj}.${min}.${cor + 1}`;
  if (type === 'feat') return `${maj}.${min + 1}.0`;
  if (type === 'major') return `${maj + 1}.0.0`;
  throw new Error(`Type inconnu : ${String(type)} (fix, feat ou major)`);
}

const CHEMINS = {
  paquet: new URL('../package.json', import.meta.url),
  manifeste: new URL('../public/manifest.json', import.meta.url),
  verrou: new URL('../package-lock.json', import.meta.url),
};

function lire(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function ecrire(url, objet) {
  writeFileSync(url, `${JSON.stringify(objet, null, 2)}\n`);
}

/** Réécrit seulement la ligne de version, pour ne pas reformater le manifeste. */
function remplacerVersion(url, ancienne, nouvelle) {
  const texte = readFileSync(url, 'utf8');
  const motif = new RegExp(`("version"\\s*:\\s*)"${ancienne.replaceAll('.', '\\.')}"`);
  if (!motif.test(texte)) throw new Error(`Version ${ancienne} introuvable dans ${fileURLToPath(url)}`);
  writeFileSync(url, texte.replace(motif, `$1"${nouvelle}"`));
}

export function versionsActuelles() {
  return { paquet: lire(CHEMINS.paquet).version, manifeste: lire(CHEMINS.manifeste).version, verrou: lire(CHEMINS.verrou).version };
}

function appliquer(nouvelle) {
  const { paquet, manifeste } = versionsActuelles();
  remplacerVersion(CHEMINS.manifeste, manifeste, nouvelle);
  remplacerVersion(CHEMINS.paquet, paquet, nouvelle);
  const verrou = lire(CHEMINS.verrou);
  verrou.version = nouvelle;
  if (verrou.packages?.['']) verrou.packages[''].version = nouvelle;
  ecrire(CHEMINS.verrou, verrou);
}

function principal(arg) {
  const v = versionsActuelles();
  if (arg === 'check') {
    const toutes = [v.paquet, v.manifeste, v.verrou];
    if (!toutes.every(versionValide) || new Set(toutes).size !== 1) {
      console.error(`Versions incohérentes : package.json ${v.paquet}, manifeste ${v.manifeste}, package-lock.json ${v.verrou}`);
      process.exit(1);
    }
    console.log(`Version ${v.paquet}`);
    return;
  }
  const nouvelle = versionValide(arg) ? arg : incrementer(v.paquet, arg);
  appliquer(nouvelle);
  console.log(`${v.paquet} → ${nouvelle}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    principal(process.argv[2]);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
