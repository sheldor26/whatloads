import { readFileSync } from 'node:fs';
import { expandImports } from '../lib/discover.mjs';
import { lineCount } from '../lib/markdown.mjs';
import { DOCS } from '../lib/docs.mjs';

const CLAUDE_MD_LINE_TARGET = 200;

export const coverage = [
  'the size of every instruction file loaded at launch',
  'every @path import: missing targets, depth beyond four hops, and imports that resolve outside the project',
  'what all of it costs in context on every single session',
];

export function run(setup) {
  const findings = [];
  const loaded = new Map();

  for (const entry of setup.instructions) {
    const { files, problems } = expandImports(entry.path, entry.scope === 'user' ? setup.configDir : setup.root);

    for (const [path, info] of files) {
      if (!loaded.has(path)) loaded.set(path, { ...info, path, scope: entry.scope, entry: entry.path });
    }

    for (const p of problems) {
      if (p.kind === 'missing') {
        findings.push({
          severity: 'high',
          title: 'An import points at a file that is not there',
          where: `${setup.rel(p.via)} imports ${setup.rel(p.path)}`,
          detail: 'The import is silently skipped, so the instructions you think are loaded are not. Fix the path or drop the line.',
          doc: DOCS.importsLoadAtLaunch,
        });
      }
      if (p.kind === 'too-deep') {
        findings.push({
          severity: 'high',
          title: 'An import chain is deeper than four hops',
          where: `${setup.rel(p.via)}:${p.line} -> ${setup.rel(p.path)}`,
          detail: 'Everything past the fourth hop never loads. Flatten the chain or import the deep file directly.',
          doc: DOCS.importDepth,
        });
      }
      if (p.kind === 'external' && entry.scope !== 'user') {
        findings.push({
          severity: 'medium',
          title: 'A project instruction file imports a file outside the project',
          where: `${setup.rel(p.via)}:${p.line} -> ${p.path}`,
          detail: 'This import loads only if the approval dialog was accepted. If anyone declined it once, the file has been silently absent ever since.',
          doc: DOCS.externalImports,
        });
      }
    }
  }

  for (const entry of setup.instructions) {
    const info = loaded.get(entry.path);
    if (!info) continue;
    const lines = lineCount(info.text);
    if (entry.name !== 'AGENTS.md' && lines > CLAUDE_MD_LINE_TARGET) {
      findings.push({
        severity: 'medium',
        title: `${setup.rel(entry.path)} is ${lines} lines`,
        where: setup.rel(entry.path),
        detail: `The documented target is under ${CLAUDE_MD_LINE_TARGET} lines. Past it you are paying context on every session for instructions that are followed less consistently. Path-scoped rules under .claude/rules/ load only when Claude opens a matching file.`,
        doc: DOCS.claudeMdSize,
      });
    }
  }

  const alwaysOn = [...loaded.values()];
  for (const rule of setup.rules) {
    if (!rule.scoped) alwaysOn.push({ text: rule.text, path: rule.path, scope: rule.scope, rule: true });
  }

  const chars = alwaysOn.reduce((n, f) => n + f.text.length, 0);

  return {
    findings,
    facts: {
      files: alwaysOn.map((f) => ({
        path: setup.rel(f.path || ''),
        scope: f.scope,
        chars: f.text.length,
        lines: lineCount(f.text),
        imported: f.depth ? f.depth > 0 : false,
        rule: Boolean(f.rule),
      })),
      chars,
      estimatedTokens: Math.round(chars / 4),
    },
  };
}
