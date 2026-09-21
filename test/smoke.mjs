/**
 * End to end, against fixtures written to a temp directory. No framework.
 * Every check gets a case that fires it and a case that must not.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { discover } from '../lib/discover.mjs';
import * as instructions from '../checks/instructions.mjs';
import * as skills from '../checks/skills.mjs';
import * as hooks from '../checks/hooks.mjs';
import { withoutCode, imports } from '../lib/markdown.mjs';
import { readFrontmatter } from '../lib/frontmatter.mjs';
import { nearest } from '../lib/hook-events.mjs';

let passed = 0;
const failures = [];
const ok = (label, cond) => { if (cond) passed++; else failures.push(label); };

const root = mkdtempSync(join(tmpdir(), 'agentdoctor-'));
const write = (rel, text) => {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
  return p;
};

// --- unit level ------------------------------------------------------------

ok('withoutCode blanks fenced blocks', !withoutCode('a\n```\n@secret\n```\n').includes('@secret'));
ok('withoutCode blanks inline spans', !withoutCode('see `@README` here').includes('@README'));
ok('withoutCode preserves line count', withoutCode('a\n```\nx\n```\nb').split('\n').length === 5);
ok('imports finds a bare path', imports('@docs/a.md').length === 1);
ok('imports ignores a code span', imports('`@docs/a.md`').length === 0);
ok('imports strips trailing punctuation', imports('see @docs/a.md, ok')[0]?.spec === 'docs/a.md');
ok('frontmatter needs the first line', readFrontmatter('\n---\nname: x\n---\n').atFirstLine === false);
ok('frontmatter reads scalars', readFrontmatter('---\nname: x\n---\n').data.name === 'x');
ok('frontmatter reads booleans', readFrontmatter('---\ndisable-model-invocation: true\n---\n').data['disable-model-invocation'] === true);
ok('unterminated frontmatter is reported', readFrontmatter('---\nname: x\n').unterminated === true);
ok('nearest finds a typo', nearest('SesionStart') === 'SessionStart');
ok('nearest gives up on nonsense', nearest('bananas') === null);

// --- fixtures --------------------------------------------------------------

write('CLAUDE.md', `# Project\n\n@docs/context.md\n@docs/missing.md\n\nMentioning \`@docs/not-an-import.md\` should not count.\n${'filler line\n'.repeat(210)}`);
write('docs/context.md', 'real content\n');
write('.claude/skills/stray.md', 'I look like a skill and am not one.\n');
write('.claude/skills/good/SKILL.md', '---\nname: good\ndescription: Use when the build fails, before touching CI config.\n---\n\n# Good\n');
write('.claude/skills/late/SKILL.md', '\n---\nname: late\ndescription: Use when something happens.\n---\n\n# Late\n');
write('.claude/skills/nodesc/SKILL.md', '---\nname: nodesc\n---\n\n# No description\n');
write('.claude/settings.json', JSON.stringify({
  hooks: {
    SessionStart: [{ matcher: 'startup|banana', hooks: [{ type: 'command', command: 'echo hello' }] }],
    Stop: [{ matcher: 'always', hooks: [{ type: 'command', command: 'echo bye' }] }],
    PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo noted' }] }],
    SesionStart: [{ hooks: [{ type: 'command', command: 'true' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/nope.sh"' }] }],
  },
}, null, 2));
write('.claude/settings.local.json', '{ not json');

const setup = discover(root);
const found = [
  ...instructions.run(setup).findings,
  ...skills.run(setup).findings,
  ...hooks.run(setup).findings,
];
const has = (needle) => found.some((f) => `${f.title} ${f.where} ${f.detail}`.includes(needle));

ok('a missing import is high', found.some((f) => f.title.includes('not there') && f.severity === 'high'));
ok('a code-span mention is not treated as an import', !has('not-an-import.md'));
ok('an oversized CLAUDE.md is reported', has('CLAUDE.md is 2'));
ok('a stray markdown file in skills/ is reported', has('.claude/skills/stray.md'));
ok('a real skill is not reported', !found.some((f) => f.where.includes('skills/good/')));
ok('frontmatter below line one is reported', found.some((f) => f.where.includes('late/') && f.severity === 'high'));
ok('a missing description is reported', found.some((f) => f.where.includes('nodesc/') && f.title.includes('No description')));
ok('an unknown matcher value is reported', has('"banana"'));
ok('a matcher on an event without one is reported', has('Stop does not take a matcher'));
ok('an echo on a debug-only event is reported', has('PostToolUse prints to stdout'));
ok('a misspelled event is reported with a suggestion', has('Did you mean "SessionStart"'));
ok('a hook script that is not there is reported', has('nope.sh'));
ok('unparseable settings are reported', has('not valid JSON'));

const facts = instructions.run(setup).facts;
ok('context cost counts the imported file', facts.files.some((f) => f.path.includes('context.md')));
ok('context cost never counts a missing file', !facts.files.some((f) => f.path.includes('missing.md')));
ok('context cost estimates tokens', facts.estimatedTokens > 0);

// --- clean fixture ---------------------------------------------------------

const clean = mkdtempSync(join(tmpdir(), 'agentdoctor-clean-'));
mkdirSync(join(clean, '.claude', 'skills', 'fine'), { recursive: true });
writeFileSync(join(clean, 'CLAUDE.md'), '# Small\n\nA few lines.\n');
writeFileSync(join(clean, '.claude', 'skills', 'fine', 'SKILL.md'), '---\nname: fine\ndescription: Use when releasing, before tagging.\n---\n\n# Fine\n');
const cleanSetup = discover(clean);
const cleanFindings = [
  ...instructions.run(cleanSetup).findings,
  ...skills.run(cleanSetup).findings,
  ...hooks.run(cleanSetup).findings,
].filter((f) => f.severity !== 'note');
ok('a tidy project produces no findings', cleanFindings.length === 0);

rmSync(root, { recursive: true, force: true });
rmSync(clean, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
