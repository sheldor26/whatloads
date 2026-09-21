/**
 * What ~/.claude costs on every single session, in every project — not just
 * the one whatloads was pointed at. Off by default: it only runs when asked
 * with --user or --projects (DECISIONS.md D-0003, D-0006).
 */

import * as instructions from './instructions.mjs';
import { DOCS } from '../lib/docs.mjs';

const DESCRIPTION_LIMIT = 1536;

export const coverage = [
  'what the global CLAUDE.md and unscoped rules under ~/.claude/rules/ cost on every session, in any project',
  'every skill description under ~/.claude/skills/, truncated at the same 1,536 characters Claude Code truncates at, since that is what loads at launch — not the body of the skill',
  'that cost multiplied across the project directories passed with --projects, never a project count whatloads found on its own',
];

export function run(setup) {
  const { facts: instructionFacts } = instructions.run(setup);
  const files = instructionFacts.files.filter((f) => f.scope === 'user');
  const chars = files.reduce((n, f) => n + f.chars, 0);

  const skills = setup.skills
    .filter((s) => s.scope === 'user')
    .map((s) => {
      const fm = s.front;
      const description = typeof fm.data.description === 'string' ? fm.data.description : '';
      const whenToUse = typeof fm.data.when_to_use === 'string' ? fm.data.when_to_use : '';
      const rawChars = description.length + whenToUse.length;
      return {
        name: s.dirName,
        path: setup.rel(s.path),
        rawChars,
        chars: Math.min(rawChars, DESCRIPTION_LIMIT),
      };
    });
  const skillsChars = skills.reduce((n, s) => n + s.chars, 0);
  const totalChars = chars + skillsChars;

  return {
    findings: [],
    facts: {
      files,
      chars,
      estimatedTokens: Math.round(chars / 4),
      skills,
      skillsChars,
      skillsEstimatedTokens: Math.round(skillsChars / 4),
      totalChars,
      totalEstimatedTokens: Math.round(totalChars / 4),
      doc: DOCS.skillDescriptionsAtLaunch,
    },
  };
}
