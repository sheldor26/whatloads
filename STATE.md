# State

updated: 2026-09-20

> A snapshot of where this project is right now — the file a new session reads
> first. It answers "what exists, what is half-done, what is next".
>
> It is not a diary. When this file starts telling stories, the stories belong
> in the logbook. `doctor` enforces that with a line budget.

## Shipped

- A working CLI: `node bin/whatloads.mjs`, zero dependencies, read-only.
- The context cost report: every instruction file loaded at launch, including
  expanded `@path` imports and unscoped `.claude/rules/`, with line counts and
  an estimated token total.
- Instruction checks: missing import targets, chains past the documented
  four-hop limit, project imports that resolve outside the project, and
  `CLAUDE.md` files over the documented 200-line target.
- Skill checks: loose `.md` files in a skills directory, frontmatter that is
  not on line 1, unterminated frontmatter, missing descriptions, descriptions
  past the 1,536-character truncation point, `disable-model-invocation`, and
  oversized `SKILL.md` bodies.
- Subagent checks (`.claude/agents/*.md`, including subfolders): no `name`
  field (treated as documentation, not a subagent), a name starting with `-`
  or containing `:` (silently skipped), a `name` with no `description`
  (silently skipped), two subagents in the same tree sharing a `name`
  (only one loads, by filesystem read order), and combined descriptions past
  the documented 15,000-token budget where Claude Code itself starts warning.
- MCP checks (the project's `.mcp.json`): unparseable JSON, a `url` with no
  `type` (read as stdio, connection skipped), a credential variable
  (`ANTHROPIC_API_KEY`, `NPM_TOKEN`, and others) sent in a `url` or `headers`
  field (always reads as empty there, by design, no warning), and any other
  `${VAR}` reference with no `:-default` that is unset in the environment
  (loads as the literal text).
- Hook and settings checks: unparseable settings files, event names that do not
  exist (with a suggestion), matchers on events that take none, matcher values
  outside the documented set, hooks printing to a stream the model never reads,
  and hook commands pointing at scripts that are not in the repository.
- `--json`, `--quiet`, `--no-docs`, `--strict`, `--dir`. Exit 1 on any high
  finding, so it can gate CI.
- The user-scope report (`--user`): what the global `CLAUDE.md`, unscoped
  `~/.claude/rules/`, and every skill description under `~/.claude/skills/`
  cost on every single session, in any project — skill descriptions truncated
  at the same 1,536 characters Claude Code truncates at, since that's what
  loads at launch, not the SKILL.md body. `--projects a,b,c` multiplies that
  cost across the directories listed and implies `--user`; without it, the
  report says explicitly that it was not multiplied, since nothing under
  `~/.claude` documents a project list and whatloads does not crawl the
  filesystem for one. Also in `--json`, under `userScope`.
- 52 assertions in `test/smoke.mjs`, against fixtures on disk, including one
  that points `CLAUDE_CONFIG_DIR` at a fake config directory.
- A logo (`assets/logo.svg`) in the README, and the GitHub repo's About
  description and topics set to match.

## In flight

- Nothing half-written. The next checks have not been started.

## Next

1. Read the script a hook actually runs, not only the command line, so a
   `bash run.sh` whose script ends in a bare `echo` is caught the way an inline
   `echo` already is. This is the check that would have caught the defect the
   tool was built around.
2. Submit to awesome-claude-code (issue-template flow, highest-ROI
   distribution move for a tool with zero users so far — competitive research
   turned up agnix, claudelint and AgentLinter as real overlap; per-finding
   doc citation and the `--user`/`--projects` framing are the parts none of
   them do).
3. `whatloads` on its own real `~/.claude` (not a fixture) currently reports
   3 high, 13 low: loose `.md` files directly in `~/.claude/skills/` that have
   never loaded (the L-0001 defect class), and skill descriptions that don't
   name a trigger. Not a regression from anything in this session — confirmed
   identical on unmodified `master` — but it means a completely clean run of
   `whatloads` against this machine's actual setup hasn't been demonstrated
   yet, only against fixtures.

## Known rough edges

- The token count is characters divided by four, not a tokenizer. It is labelled
  as an estimate everywhere it is printed. Tolerated because a real tokenizer is
  a dependency, and the decision that matters — "this is too much" — does not
  change at 10% accuracy.
- `hook-events.mjs` is a hand-copied table. When Claude Code adds an event, this
  tool calls it a typo. Tolerated for now; the guardrail is that every entry is
  traceable to the reference page, so refreshing it is mechanical.
- Two events are marked `ambiguous` because the reference page contradicts
  itself about where their stdout goes. That is a real state of the world, not a
  bug here, but it means those findings are worded more softly than the rest.
- Only Claude Code's layout is understood. `AGENTS.md` is read as an instruction
  file, but nothing else about other agents' configuration is checked, which
  makes the agent-neutral name a promise rather than a description.
