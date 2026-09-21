/**
 * Find the files that make up the agent setup, without reading anything the
 * agent itself would not read.
 */

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';

import { imports as findImports } from './markdown.mjs';
import { readFrontmatter } from './frontmatter.mjs';

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

export function userConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

// A plain startsWith() treats /a/proj-secrets as inside /a/proj, since the
// string "proj-secrets" starts with "proj". Every "is this path inside that
// directory" check needs the separator boundary, not just a string prefix.
export function isInside(child, parent) {
  const c = resolve(child);
  const p = resolve(parent);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/** Expand a chain of @path imports, breadth first, honouring the four-hop limit. */
export function expandImports(entryPath, root) {
  const seen = new Map();
  const problems = [];
  const queue = [{ path: entryPath, depth: 0, via: null }];

  while (queue.length) {
    const { path, depth, via } = queue.shift();
    if (seen.has(path)) continue;
    const text = read(path);
    if (text === null) {
      problems.push({ kind: 'missing', path, via, depth });
      continue;
    }
    seen.set(path, { text, depth, via });

    for (const ref of findImports(text)) {
      const spec = ref.spec.startsWith('~')
        ? join(homedir(), ref.spec.slice(1))
        : ref.spec;
      const target = isAbsolute(spec) ? spec : resolve(dirname(path), spec);
      const external = root ? !isInside(target, root) : false;
      if (depth + 1 > 4) {
        problems.push({ kind: 'too-deep', path: target, via: path, depth: depth + 1, line: ref.line });
        continue;
      }
      if (external) problems.push({ kind: 'external', path: target, via: path, depth: depth + 1, line: ref.line });
      queue.push({ path: target, depth: depth + 1, via: path });
    }
  }

  return { files: seen, problems };
}

// A directory symlink cycle (e.g. .claude/agents/self -> ..) makes isDir()
// follow it forever, since statSync follows symlinks with no visited guard.
// Track real paths already walked so a cycle stops instead of recursing until
// the stack overflows.
function walkMarkdown(dir, toEntry) {
  if (!isDir(dir)) return [];
  const out = [];
  const seen = new Set();
  const walk = (d) => {
    let real;
    try { real = realpathSync(d); } catch { return; }
    if (seen.has(real)) return;
    seen.add(real);
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (isDir(p)) walk(p);
      else if (name.endsWith('.md')) {
        const text = read(p);
        if (text === null) continue;
        out.push(toEntry(p, text));
      }
    }
  };
  walk(dir);
  return out;
}

function ruleFiles(dir) {
  return walkMarkdown(dir, (p, text) => {
    const fm = readFrontmatter(text);
    return { path: p, text, scoped: Boolean(fm.data && fm.data.paths) };
  });
}

function agentFiles(dir, scope) {
  return walkMarkdown(dir, (p, text) => ({ path: p, scope, text, front: readFrontmatter(text) }));
}

function skillFiles(dir, scope) {
  if (!isDir(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'SKILL.md');
    const text = read(file);
    if (text === null) continue;
    out.push({ path: file, dirName: name, scope, text, front: readFrontmatter(text) });
  }
  return out;
}

function strayMarkdown(dir, scope) {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => ({ path: join(dir, n), scope }));
}

function mcpFile(path) {
  const text = read(path);
  if (text === null) return null;
  try {
    return { path, data: JSON.parse(text), text };
  } catch (err) {
    return { path, data: null, text, error: err.message };
  }
}

function settingsFile(path, scope) {
  const text = read(path);
  if (text === null) return null;
  try {
    return { path, scope, data: JSON.parse(text), text };
  } catch (err) {
    return { path, scope, data: null, text, error: err.message };
  }
}

export function discover(root) {
  const cfg = userConfigDir();
  const at = (...p) => join(root, ...p);

  const instructions = [];
  for (const [name, scope] of [
    ['CLAUDE.md', 'project'],
    ['CLAUDE.local.md', 'local'],
    ['AGENTS.md', 'project'],
  ]) {
    if (existsSync(at(name))) instructions.push({ path: at(name), scope, name });
  }
  const userMemory = join(cfg, 'CLAUDE.md');
  if (existsSync(userMemory)) instructions.push({ path: userMemory, scope: 'user', name: 'CLAUDE.md' });

  return {
    root,
    configDir: cfg,
    instructions,
    rules: [
      ...ruleFiles(at('.claude', 'rules')).map((r) => ({ ...r, scope: 'project' })),
      ...ruleFiles(join(cfg, 'rules')).map((r) => ({ ...r, scope: 'user' })),
    ],
    skills: [
      ...skillFiles(at('.claude', 'skills'), 'project'),
      ...skillFiles(join(cfg, 'skills'), 'user'),
    ],
    agents: [
      ...agentFiles(at('.claude', 'agents'), 'project'),
      ...agentFiles(join(cfg, 'agents'), 'user'),
    ],
    mcp: mcpFile(at('.mcp.json')),
    straySkills: [
      ...strayMarkdown(at('.claude', 'skills'), 'project'),
      ...strayMarkdown(join(cfg, 'skills'), 'user'),
    ],
    settings: [
      settingsFile(at('.claude', 'settings.json'), 'project'),
      settingsFile(at('.claude', 'settings.local.json'), 'local'),
      settingsFile(join(cfg, 'settings.json'), 'user'),
    ].filter(Boolean),
    rel: (p) => (isInside(p, cfg) ? p.replace(cfg, '~/.claude') : relative(root, p) || p),
  };
}
