# Larkspur Property Group: Lease Billing (practice app)

A small internal tool for **Larkspur Property Group**, a fictional company that owns four small commercial
properties (shops, offices and warehouse bays). The accounting team uses it to see who rents which unit, to
bill rent every month, to record the payments tenants send in, and to produce each tenant's monthly statement.

This is an interview **practice** repo. The tasks are in [TASKS.md](TASKS.md) and the practice method is in
[PRACTICE_GUIDE.md](PRACTICE_GUIDE.md). Don't open `INTERVIEWER_NOTES.md` until you've finished: it contains spoilers.

## The domain in plain words

No real-estate background needed. These are all the terms the app uses:

| Term | Meaning |
| --- | --- |
| **Property** | A building or small complex the company owns, e.g. Harbor Point Plaza (a strip of shops). |
| **Unit** | One rentable space in a property: a shop, an office suite, a warehouse bay. Measured in square feet. |
| **Tenant** | The business renting a unit. |
| **Lease** | The contract between a tenant and the landlord for one unit: start date, end date and **monthly rent**. Both dates are *inclusive* (the tenant has the unit on its first and last day). A unit can have several leases over time, but only one at a time. |
| **Vacant** | A unit with no lease covering the date you're looking at. |
| **Rent roll** | The landlord's main report: every unit in a property, who's in it, what they pay and what they owe. |
| **Invoice** | A bill sent to a tenant. Here, one rent invoice per lease per month, due on the 1st (or on the move-in date). |
| **Proration** | Charging for part of a month. A tenant who moves in or out mid-month pays *monthly rent × days occupied ÷ days in that month*. |
| **Payment application** | Deciding which invoice(s) a payment pays off. This app pays the **oldest open invoice first**. |
| **Open / outstanding** | The unpaid part of an invoice: amount minus what's been applied to it. |
| **Unapplied credit** | Money a tenant paid that hasn't gone against any invoice yet (they overpaid). |
| **Balance** | Everything billed to a lease minus everything the tenant paid. Positive = they owe us; negative = they're in credit. |
| **Monthly statement** | A per-tenant summary for one month: balance brought forward, charges, payments, closing balance. |

Simplifications in this app: USD only, no taxes, no security deposits, no late fees, no rent increases, and
billing history starts in **January 2026** (when the company started using this tool), even for older leases.

## Stack

- **Backend:** Node + TypeScript + Express 5 (`src/`), run with `tsx`.
- **Database:** Postgres through `pg`, with raw parameterized SQL and no ORM. Money is stored as **integer cents** in `BIGINT` columns; dates are `DATE` columns that come back as `'YYYY-MM-DD'` strings.
- **Frontend:** plain HTML + vanilla JS modules in `public/`, served by the same server, using `fetch` and DOM updates with no framework.
- **Tests:** vitest + supertest against a real Postgres test database.

```
src/
  server.ts            starts the HTTP server (port 3100)
  app.ts               Express app: routes, static files, error handler
  routes/              HTTP layer: parse + validate input, call a service, send JSON
  services/            business logic (proration, invoicing, payments, rent roll, statements)
  db/pool.ts           pg pool, type parsers, withTransaction()
  db/queries/          SQL, one file per table area
  db/seed.ts, reset.ts schema + seed loading
  lib/                 errors, validation, date helpers
public/                index.html (properties), property.html (rent roll), lease.html (tenant ledger + statement)
db/schema.sql          the schema
test/                  unit + API tests
```

## Running it

You need Node 20+ and Postgres (from Docker or a local install).

**Option A: Postgres in Docker**
```bash
docker compose up -d          # Postgres 16 on localhost:5433, creates leases + leases_test DBs
npm install
npm run db:reset              # create tables + load seed data into the dev DB
npm run dev                   # http://localhost:3100
```

The Docker database listens on port **5433** so it won't clash with another Postgres (or the fund-ops practice
app) on 5432. The default connection strings already point at 5433.

**Option B: Postgres you already have**
```bash
createuser leases --pwprompt                 # password: leases (or anything, then match the URLs below)
createdb leases -O leases
createdb leases_test -O leases
export DATABASE_URL=postgres://leases:leases@localhost:5432/leases
export TEST_DATABASE_URL=postgres://leases:leases@localhost:5432/leases_test
npm install && npm run db:reset && npm run dev
```

**Checks**
```bash
npm test             # API + unit tests (each API test resets the *test* database)
npm run typecheck    # tsc --noEmit
```

`npm test` always uses `TEST_DATABASE_URL` (default `.../leases_test`) and never touches your dev data.
Run `npm run db:reset` any time you want the dev database back to the seed state.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/properties?as_of=YYYY-MM-DD` | All properties with unit count, occupied units and contracted monthly rent (as_of defaults to today) |
| GET | `/api/properties/:propertyId?as_of=YYYY-MM-DD` | Rent roll: every unit, the lease covering `as_of` (or `null` if vacant), rent and balance |
| GET | `/api/leases/:leaseId` | Lease + tenant + unit, invoices (oldest first, with paid/open), payments (newest first), totals |
| GET | `/api/leases/:leaseId/statements/:month` | Monthly statement, e.g. `/api/leases/10/statements/2026-10` |
| POST | `/api/leases/:leaseId/payments` | Record a payment: `{ "received_on": "2026-11-20", "amount_cents": 860000, "reference": "ACH" }` |
| POST | `/api/invoices/generate` | Bill rent for a month: `{ "month": "2026-12" }`. 201 if it created invoices, 200 if everything was already billed |

Errors come back as `{ "error": "message" }`: 400 for bad input, 404 for unknown ids.

## Seed data

Four properties (Harbor Point Plaza, Larkspur Office Center, Millbrook Industrial Park, Cedar Row Shops) with
21 units and 21 leases, including a few tenants who moved in or out during 2026 and three vacant units.
Rent is billed for January to November 2026, and payments are recorded through 2026-11-20. Most tenants pay on
time; a few don't (one stopped paying in September, one pays a flat amount that's less than their rent, one pays a
month late, one overpays every month).
