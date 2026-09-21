#!/usr/bin/env node
/**
 * whatloads — audit the agent setup in a repository.
 *
 * npx whatloads
 *
 * Zero dependencies. Reads; never writes.
 */

import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discover } from '../lib/discover.mjs';
import { resolveProjectDirs } from '../lib/projects.mjs';
import { printFindings, printContextCost, printUserScopeCost, printCoverage, c } from '../lib/report.mjs';
import * as instructions from '../checks/instructions.mjs';
import * as skills from '../checks/skills.mjs';
import * as agents from '../checks/agents.mjs';
import * as hooks from '../checks/hooks.mjs';
import * as userScope from '../checks/user-scope.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, fallback) => {
  const i = argv.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (i === -1) return fallback;
  const a = argv[i];
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

if (flag('version') || flag('v')) {
  console.log(JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version);
  process.exit(0);
}

if (flag('help') || flag('h')) {
  console.log(`whatloads — what your agent setup actually costs, and what silently does nothing

  npx whatloads                  audit the current directory
  npx whatloads --dir ./app      audit somewhere else
  npx whatloads --json           machine-readable output
  npx whatloads --quiet          findings only, no context breakdown
  npx whatloads --no-docs        omit the quoted documentation
  npx whatloads --strict         exit non-zero on medium findings too
  npx whatloads --user           add what ~/.claude costs in every project, not just this one
  npx whatloads --projects a,b   multiply that cost across the project directories listed (implies --user)

Exit code is 1 when something high-severity was found, so it can gate CI.
It reads configuration and never writes anything.
`);
  process.exit(0);
}

const root = resolve(process.cwd(), opt('dir', '.'));
const setup = discover(root);

const projectsOpt = opt('projects', null);
const showUser = flag('user') || Boolean(projectsOpt);
const projectDirs = projectsOpt ? resolveProjectDirs(projectsOpt, process.cwd()) : null;

const results = [
  ['instructions', instructions],
  ['skills', skills],
  ['subagents', agents],
  ['hooks and settings', hooks],
  ...(showUser ? [['user scope', userScope]] : []),
].map(([name, mod]) => [name, mod, mod.run(setup)]);

const findings = results.flatMap(([, , r]) => r.findings);
const contextFacts = results.find(([name]) => name === 'instructions')[2].facts;
const userScopeFacts = showUser ? results.find(([name]) => name === 'user scope')[2].facts : null;

if (flag('json')) {
  console.log(JSON.stringify({
    root,
    findings,
    context: contextFacts,
    userScope: showUser ? { ...userScopeFacts, projects: projectDirs } : null,
    checked: Object.fromEntries(results.map(([name, mod]) => [name, mod.coverage])),
  }, null, 2));
} else {
  console.log('');
  if (!flag('quiet')) printContextCost(contextFacts);
  if (showUser) printUserScopeCost(userScopeFacts, projectDirs);

  if (findings.length) {
    printFindings(findings, { showDocs: !flag('no-docs') });
  } else {
    console.log(`${c.green('No findings.')} ${c.dim('That is not the same as a good setup — here is what was looked at.')}\n`);
  }

  printCoverage(results.map(([name, mod]) => [name, mod.coverage]));

  const counts = findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});
  const summary = ['high', 'medium', 'low', 'note']
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
    .join(', ');
  console.log(summary ? `${c.b(summary)}\n` : '');
}

const high = findings.filter((f) => f.severity === 'high').length;
const medium = findings.filter((f) => f.severity === 'medium').length;
process.exit(high > 0 || (flag('strict') && medium > 0) ? 1 : 0);
