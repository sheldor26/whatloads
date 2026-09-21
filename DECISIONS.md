# Decisions

> Architecture decisions, lightweight. One entry per choice that would be
> expensive to reverse, or that a future reader would otherwise second-guess.
>
> The point is not the decision — it is the *context*, so that when the context
> changes the decision can be revisited honestly. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new decision "Title" --tags area`

<!-- bitacora:entry
id: D-0006
date: 2026-09-21
tags: [scope]
-->
### Report what was checked, never that the setup is fine

**Context.** A tool that makes claims about how another product behaves is one release away
from being confidently wrong, and a linter that is wrong is worse than no
linter: it sends people to change working configuration. This project has
already watched that happen once — an entry in bitacora's own logbook asserted
a fact about Claude Code that came from inference rather than from the docs.

**Decision.** Every check carries the documentation URL and the sentence it enforces, and
prints them with the finding. A check whose behaviour cannot be pointed at a
published sentence either ships as a warning that says it is inferred, or does
not ship.

**Consequences.** Findings become arguable instead of authoritative, which is the correct posture
for a tool auditing someone else's product. It also makes the checks age
visibly: when a cited sentence disappears from the docs, the check is stale and
can be found by searching for the URL. The cost is that genuinely useful
heuristics with no published backing have to be labelled as guesses.

<!-- bitacora:entry
id: D-0005
date: 2026-09-21
tags: [scope]
-->
### Stay agent-neutral in name and vocabulary

**Context.** predeploy already exists and checks a web application before it ships:
committed env files, secrets in the bundle. The temptation is to let one tool
grow into "checks everything", because the two share a shape.

**Decision.** This tool looks only at the setup that drives the agent — instruction files,
skills, hooks, settings, rules — and never at application code, dependencies or
build output. A finding about the app belongs in predeploy.

**Consequences.** Both tools stay explainable in one sentence, which is most of what makes a
small open source tool get used. The cost is that a user with both installed
runs two commands, and that the boundary has to be defended every time a
tempting check arrives on the wrong side of it.
--

<!-- bitacora:entry
id: D-0004
date: 2026-09-21
tags: [scope]
-->
### No runtime dependencies

**Context.** The tool has to run through npx on a machine whose owner has not opted into
anything, against a directory full of their own configuration. Every dependency
is code that runs in that position.

**Decision.** No runtime dependencies. Node 18 or newer, standard library only. Test runner
included, no framework.

**Consequences.** It installs in a second and there is no supply chain to audit, which is the
whole argument for running it at all. The cost falls on parsing: YAML
frontmatter, a settings schema and markdown structure all have to be parsed by
hand, conservatively, and a parser that guesses produces false findings — which
is the failure this tool can least afford.

<!-- bitacora:entry
id: D-0003
date: 2026-09-21
tags: [scope]
-->
### Audit the agent setup, never the application

**Context.** The obvious name puts Claude in it, because that is the setup being audited
today. But the instruction file the ecosystem converged on is AGENTS.md, read
by several tools, and a name carrying someone else's trademark limits where a
project can go and how it can be described.

**Decision.** The name is agentdoctor, the vocabulary is agent-neutral, and AGENTS.md is a
first-class input rather than a compatibility note. Claude Code specifics live
in the checks, which name it plainly, not in the branding.

**Consequences.** Support for another agent's configuration can be added without a rename or an
apology, and nothing in the project implies endorsement by anyone. The cost is
a name that says less on first read than the obvious one would.

<!-- bitacora:entry
id: D-0002
date: 2026-09-21
tags: [scope]
-->
### Every check cites the sentence in the docs it enforces

**Context.** A checker that ends with "everything looks good" is making a claim about the
things it did not look at, and the reader hears it as a guarantee. The same
reasoning already produced a non-negotiable in predeploy.

**Decision.** The output always ends with what was checked, what was found, and what was not
checked. There is no green "you are fine" state — a clean run prints the
coverage list.

**Consequences.** A reader can tell the difference between a passing check and an absent one, and
the tool cannot be blamed for a problem it never claimed to look for. The cost
is a noisier clean run, and the discipline of keeping the coverage list honest
as checks are added.
