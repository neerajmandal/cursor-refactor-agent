# Cural

Cural is a collaborative migration workspace for proving behavioral feature
parity between a legacy application and its refactored replacement.

The workflow is:

1. A Cursor cloud agent maps the legacy request path and discovers one
   source-backed end-user journey.
2. The same agent proposes a target architecture and component specifications.
3. The team edits the journey and specs. Clicking Execute validates and freezes
   that exact migration snapshot.
4. A coordinator delegates each frozen component spec to a named subagent and
   opens a target-repository pull request.
5. A separate cloud evaluation run executes the frozen journey against both
   applications inside a Cursor VM using computer use. Cural shows
   `Parity proven` only when every required check passes, and posts the VM
   walkthrough videos on the evidence board.

## Artifact model

- **Architecture overview** — a deliberately small communication diagram, not
  an exhaustive inventory.
- **Journey** — actor, preconditions, semantic steps, observable outcomes,
  fixtures, normalization rules, linked components, and source evidence.
- **Approval snapshot** — immutable copies of both diagrams, all specs, and all
  journeys used by execution and evaluation.
- **Work item** — per-component attempt, frozen spec, status, summary, and
  dependencies.
- **Evaluation report** — normalized legacy/target observations and evidence for
  each required journey.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required server credentials:

```dotenv
CURSOR_API_KEY=cursor_...
LIVEBLOCKS_SECRET_KEY=sk_...
APP_PASSWORD=
APP_SECRET=
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
```

Set `APP_PASSWORD` to hide the app behind a shared login. Local runs store
refactor history under `.data/cural`. On Vercel, set `DATABASE_URL` (Neon) and
`BLOB_READ_WRITE_TOKEN` so graphs, reports, and walkthrough videos persist.

The setup page accepts optional pinned revisions, legacy/target base URLs, and a
fixture/reset command. Provide them for reproducible parity runs. If URLs are
omitted, the evaluation agent must start both repositories using their
documented commands.

## Behavioral parity contract

Characterization captures what the legacy app does. End-to-end acceptance
checks exercise frozen user journeys inside a Cursor cloud VM with computer
use (not Playwright). Differential comparison determines whether normalized,
user-observable outcomes match.

Normalization is explicit and reviewable:

- `omit:requestId` removes a named volatile object field.
- `pattern => replacement` normalizes matching text.
- Semantic mismatches must never be normalized away.

The deterministic harness is the oracle. Agents provision, execute, diagnose,
and repair it; they do not subjectively declare two apps equivalent.

Implementation runs must finish with:

```text
CURAL_EXECUTION_REPORT
```

followed by the fenced JSON contract defined in `lib/prompts.ts`. Evaluation
runs use `CURAL_EVALUATION_REPORT`. Missing or malformed reports are failures;
a finished cloud run alone never means the migration succeeded.

## Scripted proof

Open [http://localhost:3000/preview](http://localhost:3000/preview), approve the
sample plan, and execute it. The scripted preview walks through execution,
evaluation, and the parity evidence surface without consuming cloud-agent
credits.

A concept preview of the fuller diagnosis workflow (clean story diagrams plus
System / Findings / Evidence) lives at
[http://localhost:3000/preview/vision](http://localhost:3000/preview/vision).

The real board starts at [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Unit tests cover journey extraction, execution validation, strict agent reports,
and observable normalization. The browser test proves that the UI cannot reach
its final state before the parity report passes.

## Current trust boundary

This repository is a proof, not a multi-tenant deployment. Board setup is
persisted in Liveblocks before navigation and agent starts use shared room
claims, but the app still grants room access to anyone holding a board URL.
Add organization authentication, role-based execution controls, API rate limits, audit
logs, and durable operational storage before wider team deployment.
