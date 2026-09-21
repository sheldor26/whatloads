#!/usr/bin/env node
/**
 * agentdoctor — audit the agent setup in a repository.
 *
 * npx agentdoctor
 *
 * Zero dependencies. Reads; never writes.
 */

import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discover } from '../lib/discover.mjs';
import { printFindings, printContextCost, printCoverage, c } from '../lib/report.mjs';
import * as instructions from '../checks/instructions.mjs';
import * as skills from '../checks/skills.mjs';
import * as hooks from '../checks/hooks.mjs';

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
  console.log(`agentdoctor — what your agent setup actually costs, and what silently does nothing

  npx agentdoctor                  audit the current directory
  npx agentdoctor --dir ./app      audit somewhere else
  npx agentdoctor --json           machine-readable output
  npx agentdoctor --quiet          findings only, no context breakdown
  npx agentdoctor --no-docs        omit the quoted documentation
  npx agentdoctor --strict         exit non-zero on medium findings too

Exit code is 1 when something high-severity was found, so it can gate CI.
It reads configuration and never writes anything.
`);
  process.exit(0);
}

const root = resolve(process.cwd(), opt('dir', '.'));
const setup = discover(root);

const results = [
  ['instructions', instructions],
  ['skills', skills],
  ['hooks and settings', hooks],
].map(([name, mod]) => [name, mod, mod.run(setup)]);

const findings = results.flatMap(([, , r]) => r.findings);
const contextFacts = results.find(([name]) => name === 'instructions')[2].facts;

if (flag('json')) {
  console.log(JSON.stringify({
    root,
    findings,
    context: contextFacts,
    checked: Object.fromEntries(results.map(([name, mod]) => [name, mod.coverage])),
  }, null, 2));
} else {
  console.log('');
  if (!flag('quiet')) printContextCost(contextFacts);

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
