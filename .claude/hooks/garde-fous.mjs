#!/usr/bin/env node
// Garde-fous du workflow SDD (hook PreToolUse sur Bash et PowerShell).
// Bloque, quelle que soit la position des options : push vers main, push forcé,
// merge --admin, modification de la protection de branche.
// Écrit en Node : sur Windows, `python3` peut manquer et le contrôle sauterait en silence.
import { readFileSync } from 'node:fs';

function motifBlocage(commande) {
  // Chaque commande simple (séparée par ; && || | ou saut de ligne) est analysée seule :
  // le texte d'un heredoc ou d'un message de commit ne déclenche rien.
  // Les accolades isolées couvrent les blocs PowerShell (`if ($?) { git push … }`), pas `{owner}`.
  for (const segment of commande.split(/&&|\|\||;|\||\r?\n|(?<=^|\s)[{}](?=\s|$)/)) {
    if (/^\s*git(\.exe)?\s+push\b/.test(segment)) {
      if (/\s(-f|--force|--force-with-lease|--mirror)([=\s]|$)|\s\+\S+/.test(segment)) return 'push forcé interdit';
      if (/[\s:](refs\/heads\/)?main(\s|$)/.test(segment)) return 'push vers main interdit';
    }
    if (/^\s*gh(\.exe)?\s+pr\s+merge\b.*\s--admin\b/.test(segment)) return 'merge --admin interdit';
    if (
      /^\s*gh(\.exe)?\s+api\b.*branches\/\S+\/protection/.test(segment) &&
      /(-X|--method)\s*(PUT|POST|PATCH|DELETE)/.test(segment)
    ) {
      return 'modification de la protection de branche réservée à Alexis';
    }
  }
  return null;
}

let entree;
try {
  entree = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // Entrée illisible : on bloque plutôt que de laisser passer sans contrôle.
  console.error('Bloqué par .claude/hooks/garde-fous.mjs : entrée du hook illisible');
  process.exit(2);
}

const motif = motifBlocage(entree?.tool_input?.command ?? '');
if (motif) {
  console.error(`Bloqué par .claude/hooks/garde-fous.mjs : ${motif}`);
  process.exit(2);
}
process.exit(0);
