/**
 * .claude/agents/*.md — subagents. Same failure shape as skills: a file that
 * looks right but is silently skipped, or silently treated as something else.
 */

import { DOCS } from '../lib/docs.mjs';

const DESCRIPTION_BUDGET_TOKENS = 15000;

export const coverage = [
  'every .claude/agents/*.md file, including subfolders: a name field, a description, and a name that does not use a reserved character',
  'two subagents in the same directory tree declaring the same name, which loads only one, by filesystem read order, not a documented precedence',
  'what every subagent description adds up to at startup, against the documented 15,000-token warning threshold',
];

export function run(setup) {
  const findings = [];
  const byScope = new Map();

  for (const agent of setup.agents || []) {
    const where = setup.rel(agent.path);
    const fm = agent.front;

    if (!fm.atFirstLine) continue;

    const name = typeof fm.data.name === 'string' ? fm.data.name : '';
    const description = typeof fm.data.description === 'string' ? fm.data.description : '';

    if (!name) {
      findings.push({
        severity: 'medium',
        title: 'No name field, so this file is treated as documentation, not a subagent',
        where,
        detail: 'A .claude/agents/ file with frontmatter but no name never loads as a subagent. If this was meant to be one, add name.',
        doc: DOCS.subagentNoName,
      });
      continue;
    }

    if (name.startsWith('-') || name.includes(':')) {
      findings.push({
        severity: 'high',
        title: `The name "${name}" starts with - or contains :, so the file never loads`,
        where,
        detail: 'A colon is reserved for plugin-scoped identifiers like my-plugin:reviewer; a leading hyphen is rejected outright. Claude Code logs this to the debug log and moves on — nothing in the transcript says the subagent is missing.',
        doc: DOCS.subagentInvalidName,
      });
      continue;
    }

    if (!description) {
      findings.push({
        severity: 'high',
        title: 'A name with no description, so the file is skipped',
        where,
        detail: 'The description is what Claude uses to decide whether to delegate to this subagent. Without one the whole file is skipped, and the reason goes only to the debug log.',
        doc: DOCS.subagentNoDescription,
      });
      continue;
    }

    const list = byScope.get(agent.scope) || [];
    list.push({ name, description, path: agent.path });
    byScope.set(agent.scope, list);
  }

  for (const list of byScope.values()) {
    const seen = new Map();
    for (const a of list) {
      if (seen.has(a.name)) {
        findings.push({
          severity: 'high',
          title: `Two subagents are both named "${a.name}"`,
          where: `${setup.rel(seen.get(a.name))} and ${setup.rel(a.path)}`,
          detail: 'Claude Code loads only one, chosen by filesystem read order — not a documented precedence. Rename one.',
          doc: DOCS.subagentNameCollision,
        });
      } else {
        seen.set(a.name, a.path);
      }
    }
  }

  const loaded = [...byScope.values()].flat();
  const chars = loaded.reduce((n, a) => n + a.description.length, 0);
  const estimatedTokens = Math.round(chars / 4);

  if (estimatedTokens > DESCRIPTION_BUDGET_TOKENS) {
    findings.push({
      severity: 'medium',
      title: `Subagent descriptions add up to roughly ${estimatedTokens.toLocaleString()} tokens, over the documented 15,000`,
      where: '.claude/agents/',
      detail: 'Past this point Claude Code itself shows a startup warning with the total. Every description here loads at launch whether or not that subagent is ever delegated to.',
      doc: DOCS.subagentDescriptionBudget,
    });
  }

  return {
    findings,
    facts: { count: loaded.length, chars, estimatedTokens },
  };
}
