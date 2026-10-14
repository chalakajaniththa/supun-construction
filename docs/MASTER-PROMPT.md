# Master Prompt

Copy everything inside the box into a **fresh** Claude Code session opened in this folder
(`supun-construction/`). Change only the `STEP_FILE` line each time:

- `docs/steps/STEP-1-foundation.md`
- `docs/steps/STEP-2-master-data-documents.md`
- `docs/steps/STEP-3-daily-operations.md`
- `docs/steps/STEP-4-money.md`
- `docs/steps/STEP-5-dashboard-reminders-reports.md`
- `docs/steps/STEP-6-backup-packaging-polish.md`

Run them **in order**, one session per step. Before starting step N, check that `docs/DRIFT-LOG.md` marks
step N−1 as ✅.

---

```text
STEP_FILE = docs/steps/STEP-1-foundation.md

You are the sole senior full-stack engineer building the "Supun Construction" business management
system (Next.js + NestJS + Prisma/PostgreSQL + SeaweedFS + Gotenberg, Docker Compose, pnpm monorepo).
You are implementing ONE step of a 6-step plan, fully autonomously. I will not be available to answer
questions — do not ask me anything and do not stop to wait for confirmation. When something is
ambiguous, choose the simplest option consistent with the docs, carry on, and record the decision in the
drift log.

## 1. Load context (in this order, before writing any code)
1. Read `docs/00-OVERVIEW.md` completely.
2. Read `docs/DRIFT-LOG.md` completely. It overrides the overview and step files wherever they disagree.
3. Read the step file at STEP_FILE completely.
4. Explore ONLY the parts of the codebase listed under "Read first" in the step file (plus anything you
   actually need to touch). Check `git log --oneline -20` and `git status` to see where things stand.
   If the drift log says this step is "🟨 Partial", continue from where it stopped instead of redoing work.
5. Make a task list (TodoWrite / task tool) from the step's tasks and acceptance criteria.

## 2. Implement
- Implement every task in the step file. Follow the conventions in overview §4 and the patterns already
  in the codebase (look at an existing module before writing a new one).
- Do not implement features from later steps (placeholders are fine where the step says so). Do not
  rewrite earlier steps' work unless it is needed for this step or is broken; log any such change.
- Business logic goes in pure, unit-tested calculator functions. Money uses Decimal/decimal.js, never floats.
- Every UI string goes into BOTH `apps/web/messages/en.json` and `si.json` (natural, simple Sinhala).
- Extend the sample seed so the new features show realistic data.
- Schema changes: create a new Prisma migration (never edit applied migrations) and log it.
- Use current, stable library APIs. If something in the docs is outdated (a flag, an image tag, an API),
  check the official docs or the web, use the correct current approach, and log it as a deviation.

## 3. Verify (do not skip; loop until green)
Satisfy the "Definition of Done" in overview §11 and every acceptance criterion in the step file:
1. `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` — all green.
2. Dev infra up (`docker compose -f docker-compose.dev.yml up -d`) → API e2e tests green.
3. Fresh full stack: `docker compose down -v && docker compose up -d --build` → all services healthy,
   migrations and seed OK (check `docker compose logs api`).
4. Playwright e2e for this step's flows (and all earlier specs, as a regression) green against
   http://localhost:3000.
5. Look at the real UI yourself (browser tools or Playwright screenshots) in English AND Sinhala, at 1280px
   and 1440px widths. Fix visual problems, console errors and untranslated strings.
If something fails, find the root cause and fix it — do not weaken, skip or delete tests to make them pass.
If a test is genuinely wrong, fix the test and log why.

## 4. Record & commit
1. Append a section for this step to `docs/DRIFT-LOG.md` using its template: deviations, decisions,
   schema changes, gotchas for the next step, useful commands, a test summary, unfinished items, and
   "Needs human". Update the Status table (✅ or 🟨 with the reason, date, commit hash).
   Write it so a brand-new session with zero memory can continue correctly.
2. Make sure `.env` and secrets are not committed. Commit everything with the message given in the step's
   acceptance criteria (amend the drift-log commit hash afterwards in a small follow-up commit if needed).
3. Finish with a short summary: what was built, the test counts, any deviations, and anything I must do by hand.

## Rules
- Work until the step is fully complete and verified. If you truly cannot finish something (e.g. it needs
  real Google credentials), implement everything around it, mark it under "Needs human" in the drift log,
  and still complete the rest.
- Never run destructive commands outside this project folder. `docker compose down -v` is allowed only for
  this project's compose projects (`supun`, `supun-dev`).
- Do not push to any remote and do not create remote repositories.
```
