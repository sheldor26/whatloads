# Learnings

> The counterpart to MISTAKES.md. When something works unusually well, the
> transferable part gets written down before it is forgotten.
>
> The test for an entry: would it change how you approach the *next* problem?
> If not, it is a changelog line, not a learning. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new learning "Title" --tags area`
<!-- bitacora:entry
id: L-0001
date: 2026-09-21
tags: [dogfooding]
-->
### Point the tool at the projects that produced it, on day one

**What worked.** The first complete run of whatloads was against its own repository and the
three other projects on this machine. It immediately reported the same
high-severity finding in all four: the three skills bitacora installs are loose
.md files in .claude/skills/, and a skill has to be a directory containing
SKILL.md, so none of them had ever loaded in any project.

**Why it worked.** The tool was built out of defects already paid for in those projects, which
means those projects are exactly the corpus where the next defect of the same
family is sitting. A checker validated against fixtures only proves it agrees
with its author; a checker pointed at real configuration written months earlier
by someone who believed it was correct is being tested against the actual
failure distribution.

**Reuse it when.** The moment a checking tool runs end to end, before the README and before any
polish. Point it at the oldest real thing available, not at the fixtures. If it
finds nothing there, that is evidence about the checks, not about the corpus.

