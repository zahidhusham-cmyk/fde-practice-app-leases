# Practice guide

The real interview runs in a browser editor with a built-in AI agent pinned to a **small, fast model (Haiku-class)**.
That model is weaker than what you normally use, so your prompts have to do more of the work, and the interviewers
grade **how you work and what you prompt** as much as the result.

## Setup to mimic the interview

1. Clone, `npm install`, start Postgres (`docker compose up -d`, port 5433), `npm run db:reset`. Do all of this *before* starting the timer.
2. In Cursor, pick the **smallest model available** (Claude Haiku if it's listed) and turn off auto/max mode.
3. Use **agent mode** once you've approved a plan. Don't leave the agent stuck in plan mode.
4. Set a **45-minute timer**. Open `TASKS.md` only when the timer starts.
5. Don't open `INTERVIEWER_NOTES.md` until you're done.

## Suggested 45 minutes

This matches the real interview: one feature in 45 minutes.

| Time | What |
| --- | --- |
| 0–8 | Read README + your one task. Run `npm test` and `npm run typecheck`. Click through a rent roll and a lease page. Ask the agent for a map of the layers and the tables. |
| 8–15 | Clarify: list the questions you'd ask the interviewer (edge cases, what "done" means), state your assumptions, and write a short plan. |
| 15–38 | Build in small steps: SQL/query → service → route → page → tests. Review every diff. Run the checks after each step. |
| 38–45 | Click through it in the browser, run all checks, summarize what you did, what you'd do next, and any risks. |

If you pick Task 1 (the bug), spend the build time on: reproduce → find the cause yourself → fix → regression tests → list affected invoices.

## Prompt template

Write prompts the way you'd write a ticket for a junior engineer:

```
Goal:        <one sentence: what should be true when this is done>
Context:     <what you found: file + function, the symptom, why it happens>
Files:       <exact files it may change; what it must NOT touch>
Constraints: <follow the existing pattern in X; money is integer cents; parameterized SQL only;
              write in a transaction; don't change the schema/signature unless needed>
Done when:   <tests to add/pass, `npm test` + `npm run typecheck` green, behaviour to check by hand>
```

Example (for a feature, not a spoiler):

```
Goal: add GET /api/tenants/:tenantId returning the tenant and all their leases with current balances.
Context: getLease and getLeaseBalance in src/db/queries/leases.ts already compute these per lease.
Files: a new src/routes/tenants.ts (mounted in src/app.ts), src/services/tenants.ts, a query in
       src/db/queries/leases.ts, test/tenants.api.test.ts. Don't modify other routes.
Constraints: follow the route -> service -> query layering used by leases. 404 via NotFoundError.
             Parameterized SQL. One query for the balances, not one per lease.
Done when: new tests for 200 + 404 pass, npm test and npm run typecheck are green.
```

Tips for a weak model:
- **One step per prompt.** "Add the query" → review → "add the service" → review. That beats one giant prompt.
- **Name files and functions explicitly.** Don't make it search.
- **Paste the error or failing test output** instead of describing it.
- **Ask it to explain before it edits** when you're unsure ("why does this sum drift?"). Then decide the fix yourself.
- **Reject and re-prompt** when a diff is too big or touches files you didn't name.

## Habits they're looking for

- **Narrate:** say what you think before you ask the agent ("I think the month length is wrong for April; let's confirm").
- **Review every diff**, especially money math and SQL. Read it out loud briefly.
- **Run `npm test` + `npm run typecheck` after every change.**
- **Commit per task** with a clear message.
- **Name tradeoffs and risks** you didn't have time to address (concurrency, idempotency, historical data).

## Afterwards

Export the chat, compare against `INTERVIEWER_NOTES.md`, and note: where you lost time, which prompts were vague,
and what you shipped without reviewing.
