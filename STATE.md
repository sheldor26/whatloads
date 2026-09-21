# State

updated: 2026-09-21

> A snapshot of where this project is right now — the file a new session reads
> first. It answers "what exists, what is half-done, what is next".
>
> It is not a diary. When this file starts telling stories, the stories belong
> in the logbook. `doctor` enforces that with a line budget.

## Shipped

- A working CLI: `node bin/agentdoctor.mjs`, zero dependencies, read-only.
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
- Hook and settings checks: unparseable settings files, event names that do not
  exist (with a suggestion), matchers on events that take none, matcher values
  outside the documented set, hooks printing to a stream the model never reads,
  and hook commands pointing at scripts that are not in the repository.
- `--json`, `--quiet`, `--no-docs`, `--strict`, `--dir`. Exit 1 on any high
  finding, so it can gate CI.
- 29 assertions in `test/smoke.mjs`, against fixtures on disk.

## In flight

- Nothing half-written. The next checks have not been started.

## Next

1. Write the README and publish 0.1.0 under the name `agentdoctor`, which is
   free on npm.
2. Read the script a hook actually runs, not only the command line, so a
   `bash run.sh` whose script ends in a bare `echo` is caught the way an inline
   `echo` already is. This is the check that would have caught the defect the
   tool was built around.
3. Audit user scope properly: `~/.claude/CLAUDE.md` and `~/.claude/skills/` are
   already discovered, but nothing yet reports what the user-level setup costs
   *across* every project, which is where the number gets uncomfortable.

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
