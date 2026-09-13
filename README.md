# Cural

Cural is a collaborative enterprise refactoring workspace organized around three
explicit phases:

1. **Research** — inspect the legacy repository, submit two representative
   questions through its visible UI, trace the request path, and produce
   `research-plan.md` plus a legacy component diagram.
2. **Plan** — turn that research into a target architecture and ordered,
   dependency-aware implementation steps in `implementation-plan.md`.
3. **Implement** — execute the approved plan, verify the modern application
   through its UI, and produce an implementation summary, verification report,
   and computer-use recording.

Research, Plan, and Implement use separate Cursor cloud-agent sessions. Cural
passes the durable document output from one phase into the next; it does not
depend on a shared chat or VM.

## Verification contract

The implementation agent submits the exact two Research questions through the
modern UI so they reach the modern API. A successful result requires:

- Two visible, non-empty modern responses.
- Two live OpenAI response proofs.
- Neon endpoint evidence and persisted question/answer rows for both questions.
- A pushed `cural/exec-*` branch and commit SHA.
- A saved computer-use recording of the modern UI interaction.

Legacy answers are copied into `implementation-plan.md` for context. They are
not parity expectations, are not compared with modern answers, and do not need
to match.

## Workspace

The board keeps a persistent Research → Plan → Implement navigation above a
split workspace:

- The main canvas shows the legacy diagram during Research and the target
  diagram during Plan and Implement.
- The adjacent panel keeps every generated Markdown document available and
  shows component responsibilities, findings, linked implementation steps,
  blockers, and verification evidence.
- Saved artifacts include documents, screenshots, branch/PR links, reports,
  and the verification recording.

Live boards are stored in Liveblocks. Durable project history uses local files
under `.data/cural` during local development or Neon plus private Vercel Blob
artifacts in deployed environments.

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

`DATABASE_URL` above stores Cural archives. The modern application's
`DATABASE_URL` and `OPENAI_API_KEY` remain in the named Cursor cloud
environment selected during setup; Cural does not store their values.

Open [http://localhost:3000/preview](http://localhost:3000/preview) for a
deterministic walkthrough that does not consume cloud-agent credits.

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Unit tests cover cross-phase document transfer, workflow gates, strict agent
reports, OpenAI/Neon proof, branch safety, archive compatibility, and the
explicit absence of answer parity. The browser test covers the complete
Research → Plan → Implement preview flow.

## Trust boundary

This repository is still a proof rather than a hardened multi-tenant product.
Before broad deployment, add organization authentication, execution roles,
rate limits, audit logs, and stronger server-side remote-branch verification.
