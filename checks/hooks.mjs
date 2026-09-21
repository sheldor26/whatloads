import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EVENTS, nearest } from '../lib/hook-events.mjs';
import { DOCS } from '../lib/docs.mjs';

export const coverage = [
  'every settings file parses as JSON',
  'every hook event name is one Claude Code actually fires',
  'matchers on events that do not take one, and matcher values outside the documented set',
  'hooks whose output goes somewhere the model never reads',
  'hook commands pointing at scripts that are not in the repository',
  'shared hooks naming a path that exists on only one machine',
];

const SHELL_ECHO = /(^|[;&|]\s*)(echo|printf|cat|print)\b/;

export function run(setup) {
  const findings = [];
  let hookCount = 0;

  for (const file of setup.settings) {
    const where = setup.rel(file.path);

    if (file.data === null) {
      findings.push({
        severity: 'high',
        title: 'This settings file is not valid JSON',
        where,
        detail: `Claude Code cannot read it, so every setting in it — hooks included — is absent. Parser said: ${file.error}`,
        doc: DOCS.settingsPrecedence,
      });
      continue;
    }

    const hooks = file.data.hooks;
    if (!hooks || typeof hooks !== 'object') continue;

    for (const [event, groups] of Object.entries(hooks)) {
      const spec = EVENTS[event];
      if (!spec) {
        const guess = nearest(event);
        findings.push({
          severity: 'high',
          title: `"${event}" is not a hook event Claude Code fires`,
          where,
          detail: guess
            ? `Nothing is wired up; the entry is inert. Did you mean "${guess}"?`
            : 'Nothing is wired up; the entry is inert.',
          doc: DOCS.stdoutExceptions,
        });
        continue;
      }

      for (const group of Array.isArray(groups) ? groups : []) {
        const entries = Array.isArray(group && group.hooks) ? group.hooks : [];
        hookCount += entries.length;

        if (group && group.matcher !== undefined && spec.matcher === false) {
          findings.push({
            severity: 'medium',
            title: `${event} does not take a matcher`,
            where,
            detail: `The matcher "${group.matcher}" is ignored, so this fires on every ${event} — which may be what you wanted, but it is not what the file says.`,
            doc: DOCS.stdoutExceptions,
          });
        }

        if (group && typeof group.matcher === 'string' && Array.isArray(spec.matcher)) {
          const parts = group.matcher.split('|').map((s) => s.trim()).filter(Boolean);
          const unknown = parts.filter((p) => !spec.matcher.includes(p));
          if (unknown.length && parts.length) {
            findings.push({
              severity: 'medium',
              title: `${event} has no matcher value ${unknown.map((u) => `"${u}"`).join(', ')}`,
              where,
              detail: `Documented values: ${spec.matcher.join(', ')}. A value outside that list never matches, so that branch never runs.`,
              doc: DOCS.stdoutExceptions,
            });
          }
        }

        for (const hook of entries) {
          const command = hook && typeof hook.command === 'string' ? hook.command : '';

          if (command && (spec.stdout === 'debug' || spec.stdout === 'discarded' || spec.stdout === 'ambiguous') && SHELL_ECHO.test(command)) {
            findings.push({
              severity: spec.stdout === 'ambiguous' ? 'medium' : 'high',
              title: spec.stdout === 'ambiguous'
                ? `${event} prints to stdout, and the reference contradicts itself about where that goes`
                : `${event} prints to stdout, which the model never reads`,
              where,
              detail: spec.stdout === 'ambiguous'
                ? 'The events list excludes this event from the ones whose stdout becomes context; the section for the event itself says the opposite. Print JSON with a "systemMessage" field instead — that path is documented either way.'
                : 'Plain stdout on this event goes to the debug log. If the point is to tell the model something, print JSON with a "systemMessage" field and exit 0.',
              doc: spec.stdout === 'ambiguous' ? DOCS.stopSection : DOCS.stdoutExceptions,
            });
          }

          // A shared settings file is cloned by everyone. A command naming a
          // path on one person's disk fails silently for all of them, and a
          // failed PreToolUse hook is not surfaced anywhere.
          if (command && file.scope === 'project') {
            const absolute = (command.match(/(?:^|["'\s])((?:~|\/|[A-Za-z]:\\)[^"'\s]+)/g) || [])
              .map((s) => s.trim().replace(/^["']/, ''))
              .filter((s) => !s.startsWith('/bin/') && !s.startsWith('/usr/bin/') && !s.startsWith('/usr/local/bin/'))
              .filter((s) => !resolve(s).startsWith(resolve(setup.root)));
            if (absolute.length) {
              findings.push({
                severity: 'high',
                title: 'A shared hook names a path that only exists on one machine',
                where: `${where} -> ${absolute[0]}`,
                detail: 'This file is committed, so everyone who clones the repository gets this hook — pointing at a directory they do not have. It fails on every call, and a failed hook is not shown to anyone. Move it to .claude/settings.local.json, or make the path relative to $CLAUDE_PROJECT_DIR.',
                doc: DOCS.settingsPrecedence,
              });
            }
          }

          const ref = command.match(/\$CLAUDE_PROJECT_DIR["']?\/([^"'\s]+)/);
          if (ref && !existsSync(join(setup.root, ref[1]))) {
            findings.push({
              severity: 'high',
              title: 'A hook points at a script that is not in the repository',
              where: `${where} -> ${ref[1]}`,
              detail: 'The hook fails silently on every run for anyone who clones this repo.',
              doc: DOCS.settingsPrecedence,
            });
          }
        }
      }
    }
  }

  return { findings, facts: { hooks: hookCount } };
}
