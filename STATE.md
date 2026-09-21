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
  outside the documented set, hooks printing to a stream the model never reads
  — including inside a script a wrapper command runs, e.g. `bash run.sh` —
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
- A logo (`assets/logo.svg`) in the README, and the GitHub repo's About
  description and topics set to match.
- A bug-hunt pass (4 parallel review angles, each finding verified against the
  actual code before trusting it): fixed a symlink cycle under
  `.claude/agents/` or `.claude/rules/` that crashed `discover()` with
  unbounded recursion; CRLF `SKILL.md`/agent files that read as "frontmatter
  never closed"; an inline `[a, b]` frontmatter array that broke on a quoted
  item containing a comma; the hook script-follow check missing a bare
  `$CLAUDE_PROJECT_DIR/run.sh` with no `bash`/`sh` in front; the external-import
  check being silently skipped for the global `CLAUDE.md`; an imported file
  tagged by the scope of whichever entry pulled it in instead of where it
  physically lives (so a project file importing `~/.claude/notes.md` never
  counted toward `--user`); `instructions.run()` executing twice per
  invocation under `--user`; and `~/.claude/agents/` descriptions missing
  entirely from the `--user` total. 63 assertions in `test/smoke.mjs` now
  (was 54), including regression cases for each of the above.

## Bug hunt findings not fixed

- Skill/subagent description truncation counts JS string `.length` (UTF-16
  code units). For text with astral characters (many emoji) this can
  over-count; for others it may not match however Claude Code itself counts
  the documented 1,536/15,000 limits. Not changed — nothing confirms which
  unit Claude Code uses server-side, and guessing here is exactly what
  DECISIONS.md D-0004 rules out.
- `checks/hooks.mjs`'s "shared hook names a path that only exists on one
  machine" check excludes a short hardcoded list of system bin directories
  (extended today to cover Homebrew on Apple Silicon). It will keep needing
  new prefixes as they're reported; a general mechanism (e.g. resolving
  against `$PATH`) would be more correct but adds environment-dependent
  behavior this tool has otherwise avoided. Left as is.

## In flight

- Nothing half-written. The next checks have not been started.

## Next

1. Submit to awesome-claude-code (issue-template flow, highest-ROI
   distribution move for a tool with zero users so far — competitive research
   turned up agnix, claudelint and AgentLinter as real overlap; per-finding
   doc citation and the `--user`/`--projects` framing are the parts none of
   them do).
2. `whatloads` on its own real `~/.claude` (not a fixture) currently reports
   3 high, 13 low: loose `.md` files directly in `~/.claude/skills/` that have
   never loaded (the L-0001 defect class), and skill descriptions that don't
   name a trigger. Not a regression from anything in this session — confirmed
   identical on unmodified `master` — but it means a completely clean run of
   `whatloads` against this machine's actual setup hasn't been demonstrated
   yet, only against fixtures. The `Stop` hook check now also finds a real,
   unrelated issue in *this* repo's own `.claude/hooks/bitacora-session-end.sh`
   (prints plain text on an ambiguous-stdout event) — not fixed here, since
   that script belongs to bitacora, not to a check.

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
