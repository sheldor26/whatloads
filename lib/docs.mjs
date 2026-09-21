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
  subagentNoName: {
    url: 'https://code.claude.com/docs/en/sub-agents',
    quote: 'Claude Code treats the file as documentation kept beside your agents.',
  },
  subagentNoDescription: {
    url: 'https://code.claude.com/docs/en/sub-agents',
    quote: 'Claude Code skips the file and writes the reason to the debug log.',
  },
  subagentInvalidName: {
    url: 'https://code.claude.com/docs/en/sub-agents',
    quote: 'Names can’t contain :, which is reserved for plugin-scoped identifiers such as my-plugin:reviewer. Claude Code doesn’t load a file whose name contains one and logs an error to the debug log.',
  },
  subagentNameCollision: {
    url: 'https://code.claude.com/docs/en/sub-agents',
    quote: 'Keep name values unique across the whole tree: if two files under the same .claude/agents/ directory, including its subfolders, declare the same name, Claude Code loads only one of them, chosen by filesystem read order rather than a documented precedence.',
  },
  subagentDescriptionBudget: {
    url: 'https://code.claude.com/docs/en/sub-agents',
    quote: 'Those descriptions take up context, so keep them short. When the combined descriptions of your subagents, except the built-in ones, exceed 15,000 tokens, Claude Code shows a warning at startup with the total token count.',
  },
  mcpConfigFormat: {
    url: 'https://code.claude.com/docs/en/mcp',
    quote: 'The resulting .mcp.json file follows a standardized format.',
  },
  mcpUrlNeedsType: {
    url: 'https://code.claude.com/docs/en/mcp',
    quote: 'A JSON entry that has a url but no type is a configuration error, because Claude Code reads an entry with no type as a stdio server. Claude Code skips that server and reports MCP server "<name>" has a "url" but no "type"; add "type": "http" (or "sse" / "ws") to this entry.',
  },
  mcpCredentialVariablesEmpty: {
    url: 'https://code.claude.com/docs/en/mcp',
    quote: 'In a remote server’s url and headers, Claude Code reads credential variables from your environment as empty rather than expanding them. This keeps a project’s .mcp.json or a plugin from sending your Claude Code or cloud provider credentials to a server it names.',
  },
  mcpUnsetEnvVarLiteral: {
    url: 'https://code.claude.com/docs/en/mcp',
    quote: 'If a referenced environment variable isn’t set and has no default value, the config still loads: Claude Code reports a missing-variable warning for that server in claude mcp list output and uses the unexpanded ${VAR} text as-is. Set the variable or add a :-default fallback so the server starts with the value you intend.',
  },
};
