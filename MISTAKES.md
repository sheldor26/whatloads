# Mistakes

> Every time something breaks, it gets an entry here — what happened, why it
> was possible, and the guardrail that makes it impossible to repeat.
>
> An entry without a guardrail is just a complaint. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new mistake "Title" --tags area,failure-mode`
<!-- bitacora:entry
id: M-0005
date: 2026-09-21
tags: [hooks, false-positive]
severity: low
-->
### The script-echo check flagged a script that already wraps its output as systemMessage JSON

**What happened.** Running `whatloads` on its own repository reported this project's own
`.claude/hooks/bitacora-session-end.sh` for printing plain text on the
ambiguous-stdout `Stop` event. The script was correct: its `echo`/`printf`
calls are piped into `node -e '...'`, which wraps them as
`JSON.stringify({ systemMessage: ... })` before anything reaches real stdout —
running the script by hand confirmed the actual output was well-formed JSON,
exit 0.

**Root cause.** The check (`checks/hooks.mjs`, shipped the previous session) is a static text
scan: it looks for `echo`/`printf`/`cat` anywhere in a command or the script
it runs, with no notion of a shell pipe. It cannot tell an `echo` that goes
straight to stdout from one whose output is piped into a transform that
changes it before it ever reaches stdout — text scanning was never going to
model that without actually parsing shell, which this project has deliberately
avoided (DECISIONS.md D-0004).

**Guardrail.** Before flagging a plain-text print, the check now looks for the literal string
`systemMessage` anywhere in the same command or script. Its presence is a
cheap, honest signal that the author already built the JSON-wrapper pattern
the finding would otherwise tell them to build — matching the project's
existing pattern for a heuristic-not-a-fact check (the trigger-word guess in
`checks/skills.mjs`, always labelled `inferred`). A regression test
(`test/smoke.mjs`, "a script whose echo is piped into a systemMessage
wrapper is not reported") pins this down.

<!-- bitacora:entry
id: M-0004
date: 2026-09-21
tags: [publishing, process]
severity: medium
-->
### 0.1.2 was published from a dirty working tree

**What happened.** npm publish packed the working directory, not the last commit. The subagent
checks — checks/agents.mjs and changes across five files — went to the registry
while none of it existed in git. For a few minutes the published package
contained code that could not be found in the repository it points at, which is
the worst possible state for an open source tool: the thing people audit and
the thing they run were different.

**Root cause.** Publishing and committing are separate actions with no relationship enforced
between them, and npm's output looks identical either way. The version bump ran
first and succeeded, which made the sequence feel finished. Nothing in the
release path ever asks whether the tree is clean.

**Guardrail.** A prepublishOnly script that fails when `git status --porcelain` is not empty,
so npm refuses the publish itself rather than relying on anyone remembering.
Standing rule: the artifact that goes to a registry is built from a commit, and
the version bump is the last thing that happens before the publish, not the
first.

<!-- bitacora:entry
id: M-0003
date: 2026-09-21
tags: [testing, scope]
severity: medium
-->
### Clean fixture leaked the real ~/.claude into a hermetic test

**What happened.** The "a tidy project produces no findings" assertion in `test/smoke.mjs` failed
while building the user-scope report, on this machine, without a single line of
application code changed — confirmed by stashing the whole diff and re-running
the suite against unmodified `master`. `discover()` always resolves the user
config directory from `CLAUDE_CONFIG_DIR` or `homedir()/.claude` (`lib/discover.mjs`),
and the clean fixture never touched that env var, so it was silently auditing
whoever's real `~/.claude` happened to be on the machine running the test.

**Root cause.** The fixture built an isolated project directory but assumed user scope came
along for free. It didn't: user scope is resolved from the environment, not
from the fixture root, so "isolated project" was never "isolated setup". The
assertion had been passing only because every machine it had run on so far
happened to have a tidy `~/.claude` — an accident of the test author's own
config, not a property the test verified.

**Guardrail.** Any fixture that asserts an exact finding count (zero or otherwise) must set
`CLAUDE_CONFIG_DIR` to a temp directory it created itself before calling
`discover()`, and restore the previous value in the same block. The clean
fixture and the new user-scope fixture in `test/smoke.mjs` both do this now;
a fixture that reads user scope without it is the pattern to watch for in
review.

<!-- bitacora:entry
id: M-0002
date: 2026-09-21
tags: [logbook, tooling]
severity: medium
-->
### Five logbook entries were filled with each other's bodies

**What happened.** Five DECISIONS entries were created in one loop, then filled from a list
written in the same order. The logbook writes newest first, so the file's order
was the reverse of the list's, and every body landed under someone else's
title: the entry titled "Every check cites the sentence in the docs it
enforces" argued about never claiming a setup is fine. The file passed doctor —
every section was present and long enough.

**Root cause.** The filler matched entries by position in a file whose order is defined to be
the opposite of creation order. Nothing connected a body to its own title,
so there was no point at which the mismatch could be detected: the script had
no idea what any entry was called, and doctor checks that sections are filled,
not that they are about their heading.

**Guardrail.** The prose for an entry is keyed by its title, and the filler asserts the title
in the file matches the key before writing a single character — a mismatch is a
hard failure, not a silent write. Position is never used to identify an entry
again.

<!-- bitacora:entry
id: M-0001
date: 2026-09-21
tags: [naming, publishing]
severity: medium
-->
### npm rejected the package name after the repository was already built around it

**What happened.** The name was checked with `npm view agentdoctor version`, which returned
nothing, and the whole repository was built under it: package.json, the binary,
the README, a DECISIONS entry arguing for it. The publish failed with a 403 —
npm refuses a name too similar to an existing package, and `agent-doctor`
exists. The rename touched ten files and an architecture decision.

**Root cause.** Checking whether a name is *taken* answers a different question from whether it
is *publishable*. npm normalises punctuation and rejects near neighbours, and
`npm view` never mentions that rule: an unoccupied name still fails. The check
that was run looked authoritative, which is why nobody looked further.

**Guardrail.** Before a name is written into anything, check the normalised neighbourhood, not
the exact string: strip the hyphens, dots and underscores and confirm every
variant is free (`agentdoctor`, `agent-doctor`, `agent.doctor`). The name is
only settled when `npm publish --dry-run` has run and the registry itself has
not objected — and until it is settled, the name lives in package.json and
nowhere else.

