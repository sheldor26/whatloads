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
import * as userScope from '../checks/user-scope.mjs';
import { withoutCode, imports } from '../lib/markdown.mjs';
import { readFrontmatter } from '../lib/frontmatter.mjs';
import { nearest } from '../lib/hook-events.mjs';
import { resolveProjectDirs } from '../lib/projects.mjs';

let passed = 0;
const failures = [];
const ok = (label, cond) => { if (cond) passed++; else failures.push(label); };

const root = mkdtempSync(join(tmpdir(), 'whatloads-'));
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
    PreToolUse: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/nope.sh"' }] },
    { matcher: 'Write', hooks: [{ type: 'command', command: '"/Users/someone/tools/guard.mjs" hook || true' }] },
    { matcher: 'Edit', hooks: [{ type: 'command', command: '/usr/bin/true' }] },
  ],
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
ok('a machine-specific path in a shared hook is reported', has('/Users/someone/tools/guard.mjs'));
ok('a system binary in a shared hook is not reported', !has('/usr/bin/true'));

const facts = instructions.run(setup).facts;
ok('context cost counts the imported file', facts.files.some((f) => f.path.includes('context.md')));
ok('context cost never counts a missing file', !facts.files.some((f) => f.path.includes('missing.md')));
ok('context cost estimates tokens', facts.estimatedTokens > 0);

// --- user scope, against a fake CLAUDE_CONFIG_DIR ---------------------------

ok('resolveProjectDirs returns nothing for no input', resolveProjectDirs(null, root).valid.length === 0);

const cfgRoot = mkdtempSync(join(tmpdir(), 'whatloads-cfg-'));
const writeCfg = (rel, text) => {
  const p = join(cfgRoot, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
  return p;
};
const userProjectRoot = mkdtempSync(join(tmpdir(), 'whatloads-userproj-'));

const globalClaudeMd = '# Me\n\nGlobal instructions.\n';
writeCfg('CLAUDE.md', globalClaudeMd);
writeCfg('skills/short/SKILL.md', `---\nname: short\ndescription: ${'a'.repeat(10)}\nwhen_to_use: ${'b'.repeat(5)}\n---\n\n# Short\n`);
writeCfg('skills/long/SKILL.md', `---\nname: long\ndescription: ${'c'.repeat(2000)}\n---\n\n# Long\n`);

const prevCfgDir = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cfgRoot;

const userSetup = discover(userProjectRoot);
const userFacts = userScope.run(userSetup).facts;

if (prevCfgDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDir;

const shortSkill = userFacts.skills.find((s) => s.name === 'short');
const longSkill = userFacts.skills.find((s) => s.name === 'long');
ok('a short skill description is counted in full', shortSkill?.rawChars === 15 && shortSkill?.chars === 15);
ok('a long skill description is cut off at 1,536', longSkill?.rawChars === 2000 && longSkill?.chars === 1536);
ok('the global CLAUDE.md is counted in the flat per-session cost', userFacts.chars === globalClaudeMd.length);
ok('the total is the flat cost plus every skill description', userFacts.totalChars === userFacts.chars + userFacts.skillsChars);

const dirs = resolveProjectDirs(`${userProjectRoot},${join(userProjectRoot, 'does-not-exist')}`, root);
ok('resolveProjectDirs keeps a real directory', dirs.valid.includes(userProjectRoot));
ok('resolveProjectDirs rejects a path that is not a directory', dirs.invalid.length === 1);

rmSync(cfgRoot, { recursive: true, force: true });
rmSync(userProjectRoot, { recursive: true, force: true });

// --- clean fixture ---------------------------------------------------------

const clean = mkdtempSync(join(tmpdir(), 'whatloads-clean-'));
mkdirSync(join(clean, '.claude', 'skills', 'fine'), { recursive: true });
writeFileSync(join(clean, 'CLAUDE.md'), '# Small\n\nA few lines.\n');
writeFileSync(join(clean, '.claude', 'skills', 'fine', 'SKILL.md'), '---\nname: fine\ndescription: Use when releasing, before tagging.\n---\n\n# Fine\n');

// Isolated from this machine's real ~/.claude, so the assertion below holds
// regardless of what is actually installed globally when the suite runs.
const cleanCfg = mkdtempSync(join(tmpdir(), 'whatloads-clean-cfg-'));
const prevCfgDirForClean = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cleanCfg;

const cleanSetup = discover(clean);
const cleanFindings = [
  ...instructions.run(cleanSetup).findings,
  ...skills.run(cleanSetup).findings,
  ...hooks.run(cleanSetup).findings,
].filter((f) => f.severity !== 'note');
ok('a tidy project produces no findings', cleanFindings.length === 0);

if (prevCfgDirForClean === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDirForClean;

rmSync(root, { recursive: true, force: true });
rmSync(clean, { recursive: true, force: true });
rmSync(cleanCfg, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
