# Cural

Cural is a collaborative migration workspace for proving behavioral feature
parity between a legacy application and its refactored replacement.

The workflow is:

1. A Cursor cloud agent maps the legacy request path and discovers one
   source-backed end-user journey.
2. The same agent proposes a target architecture and component specifications.
3. The team reviews and edits the architecture and component specs, then clicks
   **Execute plan** to validate and freeze that exact migration snapshot.
4. A Cursor cloud agent summarizes the frozen plan, implements it on a
   `cural/exec-<snapshot-id>` target branch, and proves the result with computer
   use before Cural can show `Goal achieved`.

## Artifact model

- **Architecture overview** — a deliberately small communication diagram, not
  an exhaustive inventory.
- **Journey** — actor, preconditions, semantic steps, observable outcomes,
  fixtures, normalization rules, linked components, and source evidence.
- **Approval snapshot** — immutable copies of both diagrams, all specs, and all
  journeys used by execution.
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

That server-side `DATABASE_URL` is Cural's archive database. The target app's
`DATABASE_URL` and `OPENAI_API_KEY` are separate secrets and must be configured
inside the named Cursor cloud environment selected on the setup page. Cural
never stores or forwards their values.

The execute agent parses the target `DATABASE_URL` without printing it and
verifies that it points to Neon Postgres. It writes every database entry to the
default database addressed by that URL and does not create, select, or require
a separate Neon branch.

The setup page accepts optional pinned revisions, legacy/target base URLs, and a
fixture/reset command. Provide them so execute can start both apps and prove
the goal. If URLs are omitted, the execute agent must start both repositories
using their documented commands.

## Behavioral parity contract

Characterization captures what the legacy app does. End-to-end acceptance
checks exercise frozen user journeys inside a Cursor cloud VM with computer
use. The two proof questions must be typed and submitted through each visible
browser UI—legacy first, modern V2 second. Direct HTTP/API calls, scripts, and
Playwright request APIs do not count. Differential comparison determines
whether normalized, user-observable outcomes match.

The agent may run at most three complete legacy-to-modern proof cycles. Every
passed report must include computer-use artifacts, two live OpenAI response
identifiers, and query evidence for both question/answer rows in the default
Neon database.

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

followed by the fenced JSON contract defined in `lib/prompts.ts`, then
`CURAL_EVALUATION_REPORT` for the computer-use proof (OpenAI + Neon). Missing
or malformed reports are failures; a finished cloud run alone never means the
migration succeeded.

## Scripted proof

Open [http://localhost:3000/preview](http://localhost:3000/preview), review the
sample plan, and click **Execute plan**. The scripted preview shows the pending
and completed goal-evidence states without consuming cloud-agent credits.

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
