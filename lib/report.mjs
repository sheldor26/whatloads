const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  b: paint(1), dim: paint(2), red: paint(31), yellow: paint(33),
  blue: paint(34), green: paint(32),
};

const LABEL = {
  high: c.red('high  '),
  medium: c.yellow('medium'),
  low: c.blue('low   '),
  note: c.dim('note  '),
};

const ORDER = { high: 0, medium: 1, low: 2, note: 3 };

export function printFindings(findings, { showDocs }) {
  const sorted = [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  for (const f of sorted) {
    const tag = f.inferred ? c.dim(' (inferred, not a documented rule)') : '';
    console.log(`${LABEL[f.severity]} ${c.b(f.title)}${tag}`);
    console.log(`       ${c.dim(f.where)}`);
    for (const line of wrap(f.detail, 72)) console.log(`       ${line}`);
    if (showDocs && f.doc) {
      for (const line of wrap(`"${f.doc.quote}"`, 72)) console.log(`       ${c.dim(line)}`);
      console.log(`       ${c.dim(f.doc.url)}`);
    }
    console.log('');
  }
}

export function printContextCost(facts) {
  const { files, chars, estimatedTokens } = facts;
  console.log(c.b('Loaded on every session in this project'));
  const widest = files.reduce((n, f) => Math.max(n, f.path.length), 0);
  for (const f of [...files].sort((a, b) => b.chars - a.chars)) {
    const pad = ' '.repeat(widest - f.path.length);
    const note = [f.scope === 'user' ? 'user scope' : null, f.imported ? 'imported' : null, f.rule ? 'rule' : null]
      .filter(Boolean).join(', ');
    console.log(`  ${f.path}${pad}  ${String(f.lines).padStart(5)} lines  ${c.dim(note)}`);
  }
  console.log('');
  console.log(`  ${c.b(`${chars.toLocaleString()} characters`)}, roughly ${c.b(`${estimatedTokens.toLocaleString()} tokens`)} ${c.dim('(estimated at 4 characters per token, not a tokenizer)')}`);
  console.log(`  ${c.dim('Paid once per session, before you have typed anything.')}`);
  console.log('');
}

export function printUserScopeCost(facts, projectDirs) {
  console.log(c.b('What ~/.claude costs on every single session, in any project'));

  if (facts.files.length) {
    const widest = facts.files.reduce((n, f) => Math.max(n, f.path.length), 0);
    for (const f of [...facts.files].sort((a, b) => b.chars - a.chars)) {
      const pad = ' '.repeat(widest - f.path.length);
      console.log(`  ${f.path}${pad}  ${String(f.lines).padStart(5)} lines  ${c.dim(f.rule ? 'rule' : '')}`);
    }
    console.log('');
  }
  console.log(`  ${c.b(`${facts.chars.toLocaleString()} characters`)} from the global CLAUDE.md and unscoped rules, roughly ${c.b(`${facts.estimatedTokens.toLocaleString()} tokens`)}`);
  console.log('');

  if (facts.skills.length) {
    console.log(`  ${facts.skills.length} skill description${facts.skills.length === 1 ? '' : 's'} under ~/.claude/skills/, loaded at launch whether or not the skill fires:`);
    for (const s of [...facts.skills].sort((a, b) => b.chars - a.chars)) {
      const truncated = s.rawChars > s.chars ? c.dim(` (cut off from ${s.rawChars})`) : '';
      console.log(`    ${s.name}  ${s.chars} chars${truncated}`);
    }
  } else {
    console.log(c.dim('  No skills under ~/.claude/skills/.'));
  }
  console.log('');

  console.log(`  ${c.b(`${facts.totalChars.toLocaleString()} characters total`)}, roughly ${c.b(`${facts.totalEstimatedTokens.toLocaleString()} tokens`)} ${c.dim('(estimated at 4 characters per token, not a tokenizer)')}`);
  console.log(`  ${c.dim('Paid again at the start of every session, in every project — this is the fixed part of the bill.')}`);
  console.log('');

  if (projectDirs && projectDirs.valid.length) {
    const n = projectDirs.valid.length;
    const totalChars = facts.totalChars * n;
    console.log(`  × ${n} project${n === 1 ? '' : 's'} you listed with --projects = ${c.b(`${totalChars.toLocaleString()} characters`)}, roughly ${c.b(`${Math.round(totalChars / 4).toLocaleString()} tokens`)}`);
    if (projectDirs.invalid.length) {
      console.log(c.dim(`  Not a directory, skipped: ${projectDirs.invalid.join(', ')}`));
    }
  } else {
    console.log(c.dim('  Not multiplied: nothing under ~/.claude documents a list of your projects, and'));
    console.log(c.dim('  whatloads does not crawl your filesystem to find one. Pass --projects a,b,c to'));
    console.log(c.dim('  see this across specific project directories.'));
    if (projectDirs && projectDirs.invalid.length) {
      console.log(c.dim(`  Not a directory, skipped: ${projectDirs.invalid.join(', ')}`));
    }
  }
  console.log('');
}

export function printCoverage(sections) {
  console.log(c.b('What was checked'));
  for (const [name, items] of sections) {
    console.log(`  ${c.dim(name)}`);
    for (const i of items) console.log(`    - ${i}`);
  }
  console.log('');
  console.log(c.dim('  Not checked: whether your instructions are good, whether a skill does what it'));
  console.log(c.dim('  says, anything about your application code. whatloads reads configuration.'));
  console.log('');
}

function wrap(text, width) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) { out.push(line.trim()); line = word; }
    else line = `${line} ${word}`;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
