# Architecture

> How this project is built, and the reasoning that is too structural to live
> in a code comment. If a section here is longer than a screen, it probably
> wants to be a `DECISIONS.md` entry instead.

## Shape

```
bin/agentdoctor.mjs   argument parsing, running the checks, exit code
lib/                  the parts every check shares
checks/               one module per area, each exporting run() and coverage
test/smoke.mjs        fixtures on disk, assertions, no framework
```

The four files in `lib/` are the ones to read first:

- `discover.mjs` — finds the setup: instruction files, `.claude/rules/`,
  skills, settings, at both project and user scope. It also expands `@path`
  import chains and reports what went wrong while expanding them.
- `docs.mjs` — the published sentences the checks enforce, each with its URL.
  Nothing else in the project quotes documentation.
- `hook-events.mjs` — the documented hook events, whether each takes a matcher,
  the matcher values where they are enumerated, and where each event's stdout
  goes.
- `markdown.mjs` / `frontmatter.mjs` — the two parsers, both deliberately
  small.

`report.mjs` owns every byte that reaches the terminal.

## Data

There is none. The tool reads files, holds findings in memory, prints, and
exits. It writes nothing, anywhere, ever — that is the reason it is safe to run
through `npx` against a directory full of someone's own configuration.

A finding is a plain object: `severity`, `title`, `where`, `detail`, `doc`, and
optionally `inferred: true`. `--json` prints them unchanged, so the JSON shape
is the internal shape and has to stay stable.

## Boundaries

- A check never reads documentation text of its own. It references an entry in
  `docs.mjs` by name, so every claim the tool makes is in one file and can be
  re-verified against the source in one pass.
- A check never prints. It returns findings and facts; `bin/` decides what the
  user sees, and `--json` gets the same objects.
- `discover.mjs` never judges. It reports what exists and what failed to
  resolve; deciding that something is wrong belongs to a check.
- `hook-events.mjs` records one event whose documented behaviour contradicts
  itself (`stdout: 'ambiguous'`). Checks must treat that state as its own case,
  never collapse it into the safe or the unsafe one.

## Conventions

- Node 18+, ESM, standard library only, in the tool and in the tests.
- Severity means consequence, not confidence: `high` is "this silently does
  nothing", `medium` is "this does not do what the file says", `low` is style,
  `note` is information. A finding the tool is unsure about carries
  `inferred: true` and says so in its own text — it does not get demoted.
- A finding says what the consequence is, not just what the rule is. "Move it
  to `<name>/SKILL.md`" beats "invalid skill layout".
- Every new check adds a line to its module's `coverage` array. The clean run
  prints that array, so a check with no coverage line is invisible when it
  passes.
- The record — this file, the logbook, code comments, commit messages — is
  written in English.
