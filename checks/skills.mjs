import { lineCount } from '../lib/markdown.mjs';
import { DOCS } from '../lib/docs.mjs';

const DESCRIPTION_LIMIT = 1536;
const BODY_LINE_LIMIT = 500;

export const coverage = [
  'every SKILL.md: whether its frontmatter is where Claude Code looks for it',
  'whether each skill has a description at all, and whether it fits before the truncation point',
  'skills that can never be invoked by the model',
  'markdown files in the skills directory that are not skills at all',
];

export function run(setup) {
  const findings = [];

  for (const stray of setup.straySkills || []) {
    findings.push({
      severity: 'high',
      title: 'A markdown file sitting directly in the skills directory is not a skill',
      where: setup.rel(stray.path),
      detail: 'A skill is a directory containing a file named SKILL.md. A loose .md file beside those directories is never discovered, so whatever it says has no effect at all. Move it to <name>/SKILL.md.',
      doc: DOCS.skillsLayout,
    });
  }

  for (const skill of setup.skills) {
    const where = setup.rel(skill.path);
    const fm = skill.front;

    if (!fm.atFirstLine) {
      findings.push({
        severity: 'high',
        title: 'Frontmatter is not on the first line, so the whole file is treated as content',
        where,
        detail: fm.looksLikeFrontmatter
          ? 'There is a --- block further down. Claude Code only reads it when the opening --- is line 1 — a blank line or a comment above it is enough to break this.'
          : 'This file has no frontmatter block at line 1, so it has no description and the name falls back to the directory name.',
        doc: DOCS.frontmatterFirstLine,
      });
      continue;
    }

    if (fm.unterminated) {
      findings.push({
        severity: 'high',
        title: 'The frontmatter block is never closed',
        where,
        detail: 'The opening --- has no matching ---, so nothing in it is read as metadata.',
        doc: DOCS.frontmatterFirstLine,
      });
      continue;
    }

    const description = typeof fm.data.description === 'string' ? fm.data.description : '';
    const whenToUse = typeof fm.data.when_to_use === 'string' ? fm.data.when_to_use : '';

    if (!description) {
      findings.push({
        severity: 'high',
        title: 'No description, so the first line of the body decides when the skill fires',
        where,
        detail: 'The description is what Claude matches against the task at hand. Falling back to the first line of markdown — usually a heading — means the skill fires on almost nothing.',
        doc: DOCS.descriptionDecides,
      });
    } else {
      const combined = description.length + whenToUse.length;
      if (combined > DESCRIPTION_LIMIT) {
        findings.push({
          severity: 'medium',
          title: `Description is ${combined} characters and is cut off at ${DESCRIPTION_LIMIT}`,
          where,
          detail: 'Everything past the limit never reaches the listing Claude reads. Put the trigger case first.',
          doc: DOCS.descriptionTruncated,
        });
      }
      if (!/\b(use|when|trigger|before|after|invoke)\b/i.test(description)) {
        findings.push({
          severity: 'low',
          inferred: true,
          title: 'The description says what the skill is, not when to use it',
          where,
          detail: 'Descriptions that never name a trigger tend not to fire. This one is our judgement, not a documented rule: it looks for words like "use when", "before", "trigger".',
          doc: DOCS.descriptionDecides,
        });
      }
    }

    if (fm.data['disable-model-invocation'] === true) {
      findings.push({
        severity: 'note',
        title: 'This skill can only be invoked by you, never by the model',
        where,
        detail: 'disable-model-invocation is set, so the description is kept out of context entirely. Intentional for a slash command; a surprise if you expected it to fire on its own.',
        doc: DOCS.disableModelInvocation,
      });
    }

    const lines = lineCount(skill.text);
    if (lines > BODY_LINE_LIMIT) {
      findings.push({
        severity: 'low',
        title: `SKILL.md is ${lines} lines`,
        where,
        detail: `The documented guidance is under ${BODY_LINE_LIMIT}. Move reference material into separate files the skill points at, so it loads only when needed.`,
        doc: DOCS.skillLength,
      });
    }
  }

  return { findings, facts: { count: setup.skills.length } };
}
