/**
 * The published sentences this tool enforces.
 *
 * Every check cites one of these (DECISIONS.md D-0006). A check with no entry
 * here must declare itself inferred, so that a reader can tell a documented
 * rule from our opinion, and so a stale rule can be found by its URL when the
 * documentation changes.
 */

export const DOCS = {
  claudeMdSize: {
    url: 'https://code.claude.com/docs/en/memory',
    quote: 'target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence.',
  },
  importsLoadAtLaunch: {
    url: 'https://code.claude.com/docs/en/memory',
    quote: 'Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them.',
  },
  importDepth: {
    url: 'https://code.claude.com/docs/en/memory',
    quote: 'Imported files can recursively import other files, with a maximum depth of four hops.',
  },
  importsSkipCode: {
    url: 'https://code.claude.com/docs/en/memory',
    quote: 'Import parsing skips Markdown code spans and fenced code blocks.',
  },
  externalImports: {
    url: 'https://code.claude.com/docs/en/memory',
    quote: 'The first time Claude Code encounters external imports in a project, it shows an approval dialog listing the files. If you decline, the imports stay disabled and the dialog doesn’t appear again.',
  },
  frontmatterFirstLine: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'Claude Code reads the frontmatter only when the opening --- is the file’s first line. Otherwise it treats the whole file, --- markers included, as skill content.',
  },
  skillsLayout: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'Personal: ~/.claude/skills/<skill-name>/SKILL.md \u2014 Project: .claude/skills/<skill-name>/SKILL.md. Where you save a skill decides which sessions load it.',
  },
  descriptionDecides: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'Claude uses this to decide when to apply the skill.',
  },
  descriptionTruncated: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'the combined description and when_to_use text is truncated at 1,536 characters in the skill listing to reduce context usage.',
  },
  skillDescriptionsAtLaunch: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'In a regular session, skill descriptions are loaded into context so Claude knows what’s available, but full skill content only loads when invoked.',
  },
  skillLength: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'Keep SKILL.md under 500 lines. Move detailed reference material to separate files.',
  },
  disableModelInvocation: {
    url: 'https://code.claude.com/docs/en/skills',
    quote: 'disable-model-invocation: true: Only you can invoke; description not in context.',
  },
  stdoutExceptions: {
    url: 'https://code.claude.com/docs/en/hooks',
    quote: 'For most events, Claude Code writes stdout to the debug log and doesn’t show it in the transcript. The exceptions are UserPromptSubmit, UserPromptExpansion, SessionStart, and PostModelSwitch, where Claude Code adds plain-text stdout as context that Claude can see and act on.',
  },
  stopSection: {
    url: 'https://code.claude.com/docs/en/hooks',
    quote: 'Stdout/stderr handling: Exit 0 with plain-text stdout adds it as context Claude can see. Stderr goes to debug log. (Stop)',
  },
  settingsPrecedence: {
    url: 'https://code.claude.com/docs/en/settings',
    quote: 'Managed settings, command line, project local, shared project, user — a key set at a higher level overrides the same key set lower down.',
  },
};
