# whatloads

Your agent's instructions, skills and hooks are configuration. Configuration
fails silently: a skill that never loads looks exactly like a skill that loaded
and did not apply, and a `CLAUDE.md` that has grown to 600 lines does not
announce that it is being followed less closely than the 90-line one it
replaced.

`whatloads` reads that setup and tells you two things: **what it costs you on
every session**, and **what in it silently does nothing**.

```bash
npx whatloads
```

It reads. It never writes.

## What it reports

**The context bill.** Every file loaded before you have typed anything —
`CLAUDE.md`, `AGENTS.md`, every `@path` import expanded, every `.claude/rules/`
file without a `paths` scope, at project and user level — with line counts and
an estimated token total.

**What `~/.claude` costs everywhere, not just here.** Your global `CLAUDE.md`
and every skill under `~/.claude/skills/` are audited by default, but their
real cost is that you pay for them again in every project, before you have
typed anything, forever. `whatloads --user` breaks that out on its own:

```
npx whatloads --user
```

```
What ~/.claude costs on every single session, in any project
  ~/.claude/CLAUDE.md    118 lines

  7,222 characters from the global CLAUDE.md and unscoped rules, roughly 1,806 tokens

  75 skill descriptions under ~/.claude/skills/, loaded at launch whether or not the skill fires:
    saas-ad-studio  960 chars
    site-audit  939 chars
    ...

  45,582 characters total, roughly 11,396 tokens (estimated at 4 characters per token, not a tokenizer)
  Paid again at the start of every session, in every project — this is the fixed part of the bill.

  Not multiplied: nothing under ~/.claude documents a list of your projects, and
  whatloads does not crawl your filesystem to find one. Pass --projects a,b,c to
  see this across specific project directories.
```

Only the skill's `description` (and `when_to_use`) load at launch, capped at the
documented 1,536 characters — the `SKILL.md` body loads only when the skill
fires. That is the number counted here, not the file size. Pass
`--projects <dir1>,<dir2>,...` to multiply it across the projects you actually
work in:

```
npx whatloads --user --projects ~/code/site-a,~/code/site-b,~/code/site-c
```

whatloads never guesses how many projects you have — there is no documented,
stable list of them under `~/.claude` to read, and this tool does not crawl
your filesystem looking for one. Without `--projects`, it says so and reports
the flat, per-session number instead of a total it made up.

**The things that quietly do nothing:**

- A loose `.md` file in `.claude/skills/`. A skill is a directory containing
  `SKILL.md`; a file beside those directories is never discovered.
- Frontmatter that is not on line 1. One blank line above the opening `---` and
  the whole file is treated as skill content, description included.
- A skill with no `description` — the field that decides when it fires.
- A description past 1,536 characters, where the listing is truncated.
- An `@path` import pointing at a file that is not there, or a chain deeper than
  the four-hop limit.
- A project import that resolves outside the project, which loads only if an
  approval dialog was once accepted.
- A hook event name that does not exist. `SesionStart` is not an error, it is
  an entry that never fires.
- A matcher on an event that takes none, or a matcher value outside the
  documented set.
- A hook that prints to stdout on an event whose stdout goes to the debug log,
  where the model never sees it.
- A hook command pointing at a script that is not in the repository.

## Every finding cites its source

A tool that makes claims about how another product behaves is one release away
from being confidently wrong, and a wrong linter sends people to break working
configuration. So every check carries the documentation URL and the sentence it
enforces, and prints them with the finding:

```
high   An import chain is deeper than four hops
       CLAUDE.md:12 -> docs/deep/five.md
       Everything past the fourth hop never loads.
       "Imported files can recursively import other files, with a maximum
       depth of four hops."
       https://code.claude.com/docs/en/memory
```

Where the reference contradicts itself — and it does, about where the `Stop`
hook's stdout goes — the finding says so and recommends the form that is
documented either way. A check with no published sentence behind it is marked
`(inferred, not a documented rule)` and is never dressed up as one.

## It will not tell you that you are fine

There is no green "all good". A clean run prints what was checked, because
"nothing found" is a claim about coverage, not about quality:

```
What was checked
  instructions
    - the size of every instruction file loaded at launch
    ...
  Not checked: whether your instructions are good, whether a skill does what it
  says, anything about your application code. whatloads reads configuration.
```

## Options

```
npx whatloads                  audit the current directory
npx whatloads --dir ./app      audit somewhere else
npx whatloads --json           machine-readable, same objects as the report
npx whatloads --quiet          findings only, no context breakdown
npx whatloads --no-docs        omit the quoted documentation
npx whatloads --strict         exit non-zero on medium findings too
npx whatloads --user           add what ~/.claude costs in every project, not just this one
npx whatloads --projects a,b   multiply that cost across the project directories listed (implies --user)
```

Exit code is 1 when anything high-severity was found, so it can gate CI.

## In CI

```yaml
- run: npx whatloads --no-docs
```

## Requirements

Node 18 or newer. No dependencies, no install, no configuration file.

## License

MIT
