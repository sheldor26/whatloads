/**
 * End to end, against fixtures written to a temp directory. No framework.
 * Every check gets a case that fires it and a case that must not.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { discover } from '../lib/discover.mjs';
import * as instructions from '../checks/instructions.mjs';
import * as skills from '../checks/skills.mjs';
import * as agents from '../checks/agents.mjs';
import * as mcp from '../checks/mcp.mjs';
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
ok('CRLF frontmatter closes correctly', readFrontmatter('---\r\nname: x\r\n---\r\n\r\nBody\r\n').unterminated !== true);
ok('CRLF frontmatter values have no trailing \\r', readFrontmatter('---\r\nname: x\r\n---\r\n').data.name === 'x');
ok('a quoted comma inside an array item survives', JSON.stringify(readFrontmatter('---\ntags: ["a, b", "c"]\n---\n').data.tags) === JSON.stringify(['a, b', 'c']));
ok('nearest finds a typo', nearest('SesionStart') === 'SessionStart');
ok('nearest gives up on nonsense', nearest('bananas') === null);

// --- fixtures --------------------------------------------------------------

write('CLAUDE.md', `# Project\n\n@docs/context.md\n@docs/missing.md\n\nMentioning \`@docs/not-an-import.md\` should not count.\n${'filler line\n'.repeat(210)}`);
write('docs/context.md', 'real content\n');
write('.claude/skills/stray.md', 'I look like a skill and am not one.\n');
write('.claude/skills/good/SKILL.md', '---\nname: good\ndescription: Use when the build fails, before touching CI config.\n---\n\n# Good\n');
write('.claude/skills/late/SKILL.md', '\n---\nname: late\ndescription: Use when something happens.\n---\n\n# Late\n');
write('.claude/skills/nodesc/SKILL.md', '---\nname: nodesc\n---\n\n# No description\n');
write('.claude/agents/no-name.md', '---\nrole: none of this matters\n---\n\nJust a note to self.\n');
write('.claude/agents/bad-name.md', '---\nname: -bad\ndescription: Use when reviewing code.\n---\n\n# Bad\n');
write('.claude/agents/colon-name.md', '---\nname: my-plugin:reviewer\ndescription: Use when reviewing code.\n---\n\n# Colon\n');
write('.claude/agents/no-desc.md', '---\nname: nodesc-agent\n---\n\n# No description\n');
write('.claude/agents/nested/dupe-a.md', '---\nname: duplicate\ndescription: Use when the first one runs.\n---\n\n# Dupe A\n');
write('.claude/agents/dupe-b.md', '---\nname: duplicate\ndescription: Use when the second one runs.\n---\n\n# Dupe B\n');
write('.claude/agents/good.md', '---\nname: good-agent\ndescription: Use when reviewing a pull request, before merging.\n---\n\n# Good\n');
write('.mcp.json', JSON.stringify({
  mcpServers: {
    'no-type': { url: 'https://example.com/mcp' },
    'leaks-cred': { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${ANTHROPIC_API_KEY}' } },
    'missing-var': { type: 'http', url: 'https://example.com/mcp?base=${WHATLOADS_TEST_UNSET_XYZ}' },
    'with-default': { type: 'http', url: 'https://example.com/${WHATLOADS_TEST_UNSET_XYZ:-fallback}/mcp' },
    good: { command: 'node', args: ['server.js'] },
  },
}, null, 2));
write('.claude/hooks/loud.sh', '#!/bin/sh\ndo-the-thing\necho done\n');
write('.claude/hooks/quiet.sh', '#!/bin/sh\nexit 0\n');
write('.claude/settings.json', JSON.stringify({
  hooks: {
    SessionStart: [{ matcher: 'startup|banana', hooks: [{ type: 'command', command: 'echo hello' }] }],
    Stop: [{ matcher: 'always', hooks: [{ type: 'command', command: 'echo bye' }] }],
    PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo noted' }] }],
    SesionStart: [{ hooks: [{ type: 'command', command: 'true' }] }],
    SubagentStop: [{ matcher: 'all', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/loud.sh"' }] }],
    SubagentStart: [{ matcher: 'all', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/quiet.sh"' }] }],
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
  ...agents.run(setup).findings,
  ...mcp.run(setup).findings,
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

ok('a subagent with no name field is not reported as broken, only as documentation', has('no-name.md') && found.some((f) => f.where.includes('no-name.md') && f.severity === 'medium'));
ok('a subagent name starting with - is reported as high', found.some((f) => f.where.includes('bad-name.md') && f.severity === 'high'));
ok('a subagent name containing : is reported as high', found.some((f) => f.where.includes('colon-name.md') && f.severity === 'high'));
ok('a subagent with no description is reported as high', found.some((f) => f.where.includes('no-desc.md') && f.title.includes('with no description')));
ok('two subagents with the same name, including a nested one, are reported', has('duplicate') && has('nested/dupe-a.md') && has('dupe-b.md'));
ok('a real subagent is not reported', !found.some((f) => f.where.includes('agents/good.md')));

ok('an mcp entry with url but no type is reported as high', found.some((f) => f.title.includes('"no-type"') && f.severity === 'high'));
ok('a credential variable in a header reads as empty and is reported as high', found.some((f) => f.title.includes('"leaks-cred"') && f.title.includes('ANTHROPIC_API_KEY') && f.severity === 'high'));
ok('an unset variable with no default is reported as medium', found.some((f) => f.title.includes('"missing-var"') && f.severity === 'medium'));
ok('an unset variable with a :-default is not reported', !found.some((f) => f.title.includes('"with-default"')));
ok('a plain stdio server is not reported', !found.some((f) => f.title.includes('"good"')));

const badMcp = mkdtempSync(join(tmpdir(), 'whatloads-badmcp-'));
mkdirSync(badMcp, { recursive: true });
writeFileSync(join(badMcp, '.mcp.json'), '{ not json');
const badMcpFindings = mcp.run(discover(badMcp)).findings;
ok('an unparseable .mcp.json is reported as high', badMcpFindings.some((f) => f.title.includes('not valid JSON') && f.severity === 'high'));
rmSync(badMcp, { recursive: true, force: true });
ok('an unknown matcher value is reported', has('"banana"'));
ok('a matcher on an event without one is reported', has('Stop does not take a matcher'));
ok('an echo on a debug-only event is reported', has('PostToolUse prints to stdout'));
ok('a misspelled event is reported with a suggestion', has('Did you mean "SessionStart"'));
ok('a hook script that is not there is reported', has('nope.sh'));
ok('unparseable settings are reported', has('not valid JSON'));
ok('a machine-specific path in a shared hook is reported', has('/Users/someone/tools/guard.mjs'));
ok('a system binary in a shared hook is not reported', !has('/usr/bin/true'));
ok('a wrapper script that echoes on a debug-only event is reported', found.some((f) => f.title.includes('runs a script that prints to stdout') && f.where.includes('loud.sh')));
ok('a wrapper script that stays quiet is not reported', !has('quiet.sh'));

const bareVar = mkdtempSync(join(tmpdir(), 'whatloads-barevar-'));
mkdirSync(join(bareVar, '.claude', 'hooks'), { recursive: true });
writeFileSync(join(bareVar, '.claude', 'hooks', 'direct.sh'), '#!/bin/sh\necho direct\n');
writeFileSync(join(bareVar, '.claude', 'settings.json'), JSON.stringify({
  hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/direct.sh"' }] }] },
}, null, 2));
const bareVarFindings = hooks.run(discover(bareVar)).findings;
ok('a script run without a bash/sh prefix is still followed', bareVarFindings.some((f) => f.title.includes('runs a script that prints to stdout') && f.where.includes('direct.sh')));
rmSync(bareVar, { recursive: true, force: true });

const symlinkRoot = mkdtempSync(join(tmpdir(), 'whatloads-symlink-'));
mkdirSync(join(symlinkRoot, '.claude', 'agents'), { recursive: true });
writeFileSync(join(symlinkRoot, '.claude', 'agents', 'real.md'), '---\nname: real\ndescription: Use when testing, before anything else.\n---\n\n# Real\n');
symlinkSync(join(symlinkRoot, '.claude', 'agents'), join(symlinkRoot, '.claude', 'agents', 'cycle'), 'dir');
let symlinkSurvived = false;
try {
  discover(symlinkRoot);
  symlinkSurvived = true;
} catch { symlinkSurvived = false; }
ok('a symlink cycle under .claude/agents/ does not crash discover()', symlinkSurvived);
rmSync(symlinkRoot, { recursive: true, force: true });

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

// A subagent under ~/.claude/agents/ should add to the --user total the same
// way a skill description does.
const cfgWithAgent = mkdtempSync(join(tmpdir(), 'whatloads-cfg-agent-'));
mkdirSync(join(cfgWithAgent, 'agents'), { recursive: true });
writeFileSync(join(cfgWithAgent, 'agents', 'reviewer.md'), `---\nname: reviewer\ndescription: ${'d'.repeat(40)}\n---\n\n# Reviewer\n`);
const emptyProject = mkdtempSync(join(tmpdir(), 'whatloads-emptyproj-'));
const prevCfgDir2 = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cfgWithAgent;
const agentUserFacts = userScope.run(discover(emptyProject)).facts;
if (prevCfgDir2 === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDir2;
ok('a user-scope subagent description is counted', agentUserFacts.agentsChars === 40);
ok('the total includes the subagent description cost', agentUserFacts.totalChars === agentUserFacts.chars + agentUserFacts.skillsChars + agentUserFacts.agentsChars && agentUserFacts.agentsChars > 0);
rmSync(cfgWithAgent, { recursive: true, force: true });
rmSync(emptyProject, { recursive: true, force: true });

// A file physically under ~/.claude, reached via a project-scope import,
// should still be tagged user scope — not the scope of the importing file.
const cfgTarget = mkdtempSync(join(tmpdir(), 'whatloads-cfg-target-'));
writeFileSync(join(cfgTarget, 'CLAUDE.md'), 'user memory\n');
const projectImportsUser = mkdtempSync(join(tmpdir(), 'whatloads-proj-imports-user-'));
writeFileSync(join(projectImportsUser, 'notes.md'), 'shared notes\n');
writeFileSync(join(cfgTarget, 'shared.md'), 'shared notes\n');
writeFileSync(join(projectImportsUser, 'CLAUDE.md'), `# Project\n\n@${join(cfgTarget, 'shared.md')}\n`);
const prevCfgDir3 = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cfgTarget;
const importSetup = discover(projectImportsUser);
const importFacts = instructions.run(importSetup).facts;
if (prevCfgDir3 === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDir3;
ok('a file physically under ~/.claude is tagged user scope even when a project file imports it', importFacts.files.find((f) => f.path.includes('shared.md'))?.scope === 'user');
rmSync(cfgTarget, { recursive: true, force: true });
rmSync(projectImportsUser, { recursive: true, force: true });

// The global CLAUDE.md importing something outside ~/.claude carries the same
// approval-dialog risk as a project file doing it — it should not be exempt.
const cfgExternal = mkdtempSync(join(tmpdir(), 'whatloads-cfg-external-'));
const outsideDir = mkdtempSync(join(tmpdir(), 'whatloads-outside-'));
writeFileSync(join(outsideDir, 'notes.md'), 'outside\n');
writeFileSync(join(cfgExternal, 'CLAUDE.md'), `# Me\n\n@${join(outsideDir, 'notes.md')}\n`);
const externalProject = mkdtempSync(join(tmpdir(), 'whatloads-externalproj-'));
const prevCfgDir4 = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cfgExternal;
const externalFindings = instructions.run(discover(externalProject)).findings;
if (prevCfgDir4 === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDir4;
ok('the global CLAUDE.md importing a file outside ~/.claude is reported', externalFindings.some((f) => f.title.includes('global CLAUDE.md imports a file outside')));
rmSync(cfgExternal, { recursive: true, force: true });
rmSync(outsideDir, { recursive: true, force: true });
rmSync(externalProject, { recursive: true, force: true });

// --- clean fixture ---------------------------------------------------------

const clean = mkdtempSync(join(tmpdir(), 'whatloads-clean-'));
mkdirSync(join(clean, '.claude', 'skills', 'fine'), { recursive: true });
writeFileSync(join(clean, 'CLAUDE.md'), '# Small\n\nA few lines.\n');
writeFileSync(join(clean, '.claude', 'skills', 'fine', 'SKILL.md'), '---\nname: fine\ndescription: Use when releasing, before tagging.\n---\n\n# Fine\n');
mkdirSync(join(clean, '.claude', 'agents'), { recursive: true });
writeFileSync(join(clean, '.claude', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Use when reviewing a diff, before it merges.\n---\n\n# Reviewer\n');

// Isolated from this machine's real ~/.claude, so the assertion below holds
// regardless of what is actually installed globally when the suite runs.
const cleanCfg = mkdtempSync(join(tmpdir(), 'whatloads-clean-cfg-'));
const prevCfgDirForClean = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = cleanCfg;

const cleanSetup = discover(clean);
const cleanFindings = [
  ...instructions.run(cleanSetup).findings,
  ...skills.run(cleanSetup).findings,
  ...agents.run(cleanSetup).findings,
  ...mcp.run(cleanSetup).findings,
  ...hooks.run(cleanSetup).findings,
].filter((f) => f.severity !== 'note');
ok('a tidy project produces no findings', cleanFindings.length === 0);

// --- subagent description budget --------------------------------------------

const budget = mkdtempSync(join(tmpdir(), 'whatloads-budget-'));
mkdirSync(join(budget, '.claude', 'agents'), { recursive: true });
for (let i = 0; i < 20; i++) {
  writeFileSync(
    join(budget, '.claude', 'agents', `agent-${i}.md`),
    `---\nname: agent-${i}\ndescription: ${'x'.repeat(3200)}\n---\n\n# Agent ${i}\n`,
  );
}
const budgetSetup = discover(budget);
const budgetFacts = agents.run(budgetSetup).facts;
const budgetFindings = agents.run(budgetSetup).findings;
ok('the description budget check sums every subagent description', budgetFacts.estimatedTokens > 15000);
ok('over 15,000 tokens of descriptions is reported', budgetFindings.some((f) => f.title.includes('over the documented 15,000')));
rmSync(budget, { recursive: true, force: true });

if (prevCfgDirForClean === undefined) delete process.env.CLAUDE_CONFIG_DIR;
else process.env.CLAUDE_CONFIG_DIR = prevCfgDirForClean;

rmSync(root, { recursive: true, force: true });
rmSync(clean, { recursive: true, force: true });
rmSync(cleanCfg, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
