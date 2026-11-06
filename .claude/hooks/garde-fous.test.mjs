// Usage : node .claude/hooks/garde-fous.test.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./garde-fous.mjs', import.meta.url));

const CAS = [
  [2, 'git push -u origin main'],
  [2, 'git push origin HEAD:main --dry-run'],
  [2, 'git push --force origin feat/x'],
  [2, 'git push origin +feat/x'],
  [2, 'git push -f origin x'],
  [2, 'gh pr merge 5 --squash --admin'],
  [2, 'gh api -X PUT repos/a/b/branches/main/protection'],
  [2, 'npm test && git push origin main'],
  [2, 'npm test; if ($?) { git push origin main }'],
  [2, 'gh api repos/{owner}/{repo}/branches/main/protection -X PUT'],
  [0, 'git push -u origin feat/T-002-references'],
  [0, 'git push origin --delete feat/T-001'],
  [0, 'gh pr merge 5 --squash --delete-branch'],
  [0, 'git push origin feat/maintenance'],
  [0, 'git commit -m "doc: ne jamais faire git push --force sur main ni gh pr merge --admin"'],
  [0, "cat <<'EOF' > notes.md\n- interdit : git push --force, push sur main, --admin\nEOF"],
];

let ok = 0;
for (const [attendu, command] of CAS) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' });
  const bon = r.status === attendu;
  if (bon) ok += 1;
  console.log(`${bon ? 'OK ' : 'KO '} attendu=${attendu} obtenu=${r.status} | ${command.split('\n')[0]}`);
}

const illisible = spawnSync(process.execPath, [hook], { input: 'pas du json', encoding: 'utf8' });
const bonIllisible = illisible.status === 2;
if (bonIllisible) ok += 1;
console.log(`${bonIllisible ? 'OK ' : 'KO '} attendu=2 obtenu=${illisible.status} | entrée illisible`);

console.log(`${ok}/${CAS.length + 1}`);
process.exit(ok === CAS.length + 1 ? 0 : 1);
