# Interviewer notes (SPOILERS)

Don't read this before a practice run. Use it afterwards to grade yourself.

## Baseline state

- `npm test`: **39 tests, 1 failing**: `test/proration.test.ts > rentForMonth > prorates a mid-month move-in by the number of days in that month` (expected 300000, received 290323).
- `npm run typecheck`: clean.
- Seeded data already shows the symptom. Brightline Dental's March invoice is **$3,542.86** (should be $3,200.00).
  Because payments go to the oldest invoice first, their $342.86 short-payment in March has rolled forward every
  month and now shows as $342.86 open on the **November** invoice. The amount they "owe" sits on an invoice that has
  nothing to do with the mistake. A strong candidate explains this.

| Seeded prorated invoice | Billed | Correct | Difference |
| --- | --- | --- | --- |
| Brightline Dental, March 2026 (move-in Mar 16, 16 days) | $3,542.86 | $3,200.00 | overcharged $342.86 |
| Ostrander Engineering, May 2026 (move-in May 20, 12 days) | $4,600.00 | $4,451.61 | overcharged $148.39 |
| Kestrel Auto Parts, October 2026 (move-in Oct 4, 28 days) | $7,560.00 | $7,316.13 | overcharged $243.87 |
| Salt & Ember Pizza, June 2026 (move-out Jun 15, 15 days) | $2,467.74 | $2,550.00 | undercharged $82.26 |
| Lumen Yoga, January 2026 (move-in Jan 12) | $2,000.00 | $2,000.00 | correct |
| Quillon Analytics, August 2026 (move-in Aug 11) | $4,911.29 | $4,911.29 | correct |

---

## Task 1: proration uses the wrong month length (planted bug)

**Where:** `src/lib/dates.ts` → `daysInMonth(year, month)`. `month` is 1–12, but JavaScript's `Date.UTC` takes a
0-based month. `Date.UTC(year, month - 1, 0)` is "day 0 of this month", which is the last day of the **previous**
month. So it returns the previous month's length. The comment ("Day 0 of a month is the last day of the month
before it") is true, which makes the line look right.

**Why Dana's spot checks looked fine:** the bug only shows when a month and the month before it have different
lengths. January (after December) and August (after July) are both 31 after 31, so Lumen's January move-in and
Quillon's August move-in are correct. Every other month is wrong. The unit tests for August and January pass for
the same reason, which is a nice thing to point out: the existing tests happened to pick the two months that hide
the bug.

**A good fix:** `new Date(Date.UTC(year, month, 0)).getUTCDate()`, with a short comment explaining the 0-based
month. Then add regression tests: `daysInMonth` for all 12 months of 2026 plus February 2028 (leap year), and a
proration test in a month that follows a different-length month (the failing one covers April). Run the whole suite.

**Reporting back to Dana (strong signal):**
- List the affected invoices (the table above), including the one where we **under**charged.
- Don't silently rewrite invoices that were sent. `npm run db:reset` fixes dev, but in production you'd issue a
  credit note / adjustment for the overcharges and decide with Dana whether to bill or write off the $82.26 undercharge.
  Ask her. A query that finds every prorated invoice whose amount differs from the corrected calculation is a good
  deliverable.
- Explain that Brightline's $342.86 now shows on the November invoice because of oldest-first application.

**Weak signs:** changing the test's expected value; "fixing" it inside `rentForMonth` with a special case or a
hard-coded 30; adding `+ 1` somewhere without understanding why; not checking whether other invoices are affected.

**Common Haiku mistakes:** it often blames `daysBetween` or the inclusive `+ 1` in `rentForMonth` (that part is
correct: both lease dates are inclusive, and the "counts both the first and the last day" test shows it). It may
switch to `new Date(year, month, 0)` (local time), which gives the right number but mixes local and UTC
helpers. Accept it only if you say why it's safe. It may also "fix" the test.

---

## Second issue (no test): payments aren't written in a transaction

Not a numbered task. Strong candidates spot it while reading `recordPayment` for Tasks 2, 6 or 7, or when asked
"anything else you'd flag?".

**Where:** `src/services/payments.ts` → `recordPayment`. It inserts the payment, reads the open invoices, then inserts
each application, all as separate statements on the pool. There's no `withTransaction` (unlike `generateRentInvoices`)
and no lock.

**Consequences:**
1. **Partial writes:** if an application insert fails half-way (DB hiccup, process killed), the payment exists but
   is only partly applied, and nothing rolls it back.
2. **Race / double application:** two payments for the same lease at the same moment both read the same open
   invoices and both apply to the oldest. Verified on the seed: two concurrent $8,600 payments for Copperleaf put
   **$17,200 against the September invoice** (open = −$8,600) and nothing on October. The lease balance is still
   right, but the invoice-level numbers are wrong, and `open_invoices_cents` (a plain sum) hides it because the
   negative cancels out.

**Good fix:** wrap the whole thing in `withTransaction`, and lock before reading the open invoices, e.g.
`SELECT id FROM leases WHERE id = $1 FOR UPDATE` (serialises payments per lease) or `SELECT ... FROM invoices ... FOR UPDATE`.
Pass the transaction client into `listOpenInvoices`, `insertPayment` and `insertApplication` (they already take a `Db`).
A test with `Promise.all` of two payments makes a good regression test. Bonus: the `ON CONFLICT DO NOTHING` in
invoice generation already makes that path safe to re-run, which is worth contrasting.

---

# Standalone features (Tasks 2–8)

Notes that apply to all of them:

- **Schema changes go in `db/schema.sql`** (and `src/db/seed.ts` if seed data needs it). `npm run db:reset` and every API
  test recreate the schema, so editing the file is the "migration" here. Strong candidates say production would need
  a real forward migration (`ALTER TABLE ... ADD COLUMN ... DEFAULT ...`, backfill, then constraints).
- **Follow the layers:** routes parse and validate with `lib/validation.ts`; services hold the rules and throw
  `NotFoundError` / `ValidationError` / `HttpError(409, ...)`; SQL lives in `db/queries/*`. Multi-row writes use `withTransaction`.
- **Task 1's bug is still on `main`.** It affects anything that bills a partial month. A good candidate notices it
  but stays on scope ("that's the known failing test; I'm leaving it").
- The seed's "today" is effectively **2026-11-21**: payments are recorded through 2026-11-20 and November is billed.

---

## Task 2: late fees (deliberately ambiguous)

The point of this task is **clarifying questions before building**. The lease sentence leaves a lot open. A strong
candidate asks (or states assumptions out loud and gets them confirmed):

- **5% of what?** The invoice amount, or the amount still unpaid? If someone pays $9,000 of $9,300, is the fee 5% of $300?
- **"Within 5 days":** is a payment on day 5 on time? (Usually yes: late from day 6, so `as_of > due_date + 5`.)
- **One fee per late invoice, or every month it stays unpaid?** (Usually one per invoice.) Fees on fees? (No.)
- **When does it run?** A button/endpoint that assesses fees "as of" a date, like invoice generation? Automatically during billing?
  Either way, re-running must not double-charge.
- **Backfill?** Sundial paid every invoice about 17 days late all year. Do we charge fees for January to October now, or only
  going forward? (Almost certainly only going forward. Surprise back-fees are a customer-relations decision for Dana.)
- **Disputed amounts:** Brightline's open $342.86 is our own billing error (Task 1). With oldest-first application,
  Brightline has technically been "late" every month since March. Charging them a fee would be wrong. Raising this is a
  very strong signal.
- **Grace period / rounding / minimum fee?** 5% rounded to the cent (`Math.round(open * 5 / 100)` in integer math).

**Implementation that fits the codebase:** the schema already allows `invoices.kind = 'fee'`. Insert a fee invoice per late
rent invoice. Note the unique key `(lease_id, kind, period_start)`: use the rent invoice's `period_start` and you get
idempotency for free with `insertInvoiceIfMissing` (one fee per rent invoice). If you want one fee per lease per month
regardless of how many invoices are late, that's a different rule. Ask. A link from the fee to the invoice it's
for (`related_invoice_id`) is better, but it's a schema change.

Seed checks as of 2026-11-21 (6+ days late and still open): Copperleaf Sep, Oct, Nov; Alder Sep (partial, $6,700 open),
Oct, Nov; Kestrel Nov; Sundial Nov; Brightline Nov ($342.86, disputed).

**Common Haiku mistakes:** computing days late with local `Date` objects; charging on the full invoice amount without
asking; no idempotency (fees double on re-run); fees counted as late themselves; floats (`amount * 0.05`).

---

## Task 3: sign a new lease (validation + 409)

**Expected:** `POST /api/units/:unitId/leases` (or under properties) with `{ tenant_id | tenant_name, contact_email, start_date, end_date, monthly_rent_cents }`,
a form on `property.html`, and tests.

**Validation that matters:**
- 400: missing or invalid dates, `end_date < start_date`, rent not a positive integer of cents, both or neither of tenant id / new tenant name.
- 404: unknown unit or tenant id.
- **409: overlapping lease on the same unit.** Overlap test with inclusive dates: `new.start <= existing.end AND new.end >= existing.start`.
  Good seed cases: Harbor Point **104** is vacant from 2026-06-16 to 2026-08-31, so a lease from 2026-07-01 to 2026-08-31 is fine
  and 2026-08-15 to 2027-08-14 must be rejected (Northwind starts 2026-09-01). Millbrook **Bay C**: anything that touches
  2026-10-04 onwards conflicts with Kestrel. Suite 310 and Harbor Point 106 have never had a lease.
- **409 (or 400) on a duplicate tenant name.** `tenants.name` is `UNIQUE`, so inserting "Tidewater Coffee Co." as a new tenant throws
  Postgres error `23505` and the app returns a **500**. Catch it (check first, or map `err.code === '23505'`). Same trap as the fund-ops LP task.
- The message should say what to fix: "Unit 104 already has a lease from 2026-09-01 to 2031-08-31 (Northwind Fitness)".

**Concurrency (strong signal):** two people saving overlapping leases at the same moment both pass a check-then-insert. Fixes:
lock the unit row (`SELECT ... FROM units WHERE id = $1 FOR UPDATE`) inside a transaction, or let the database enforce it
with `CREATE EXTENSION btree_gist` + `EXCLUDE USING gist (unit_id WITH =, daterange(start_date, end_date, '[]') WITH &&)`
and map error `23P01` to 409. Naming either is good.

**Questions to ask:** can a lease start in the past (backdating)? Should signing a lease that starts this month bill it straight away,
or wait for the next "Generate invoices" run? (If it waits, re-running generation for the current month picks it up, because generation is idempotent.)
Maximum lease length? Can the same tenant rent two units? (Yes, it's allowed by the schema.)

**Common Haiku mistakes:** overlap check with `<` instead of `<=` (misses the same-day boundary); checking only "is there a current lease today";
tenant insert and lease insert not in one transaction (orphan tenant on failure); using `innerHTML` for the error message; not refreshing the rent roll.

---

## Task 4: accounts receivable aging (report query, N+1 trap)

**Expected numbers as of 2026-11-21** (days past due = as_of − due_date; "current" = not yet due):

| Tenant | Current | 1–30 | 31–60 | 61–90 | 90+ | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Alder Brewing Company | 0 | 9,300.00 | 9,300.00 | 6,700.00 | 0 | 25,300.00 |
| Brightline Dental, LLC | 0 | 342.86 | 0 | 0 | 0 | 342.86 |
| Copperleaf Insurance Agency | 0 | 8,600.00 | 8,600.00 | 8,600.00 | 0 | 25,800.00 |
| Kestrel Auto Parts | 0 | 8,100.00 | 0 | 0 | 0 | 8,100.00 |
| Sundial Ice Cream | 0 | 2,600.00 | 0 | 0 | 0 | 2,600.00 |
| **Total** | 0 | 28,942.86 | 17,900.00 | 15,300.00 | 0 | **62,142.86** |

(Once the Task 1 fix is applied and the DB reseeded, Brightline drops off: their payments then match their invoices.)

**The trap:** `getRentRoll` in `services/properties.ts` already does N+1: one query for the units, then one lease query and one
balance query **per unit**. Haiku will copy that pattern: properties → units → lease → invoices → applications, which means hundreds of
queries for 21 units, and it grows with every building. Dana's "it needs to stay fast" is the hint. A strong answer is **one SQL
query**: open amount per invoice (`amount - SUM(applications)`), joined to lease/tenant/unit/property, bucketed with
`SUM(...) FILTER (WHERE ...)` or `CASE`, grouped by lease. Mention an index on `invoices(due_date)` if it grows. Calling out the existing N+1 in the rent roll is a bonus.

**Subtleties to ask about or handle:**
- **As-of in the past:** an invoice's open amount *as of* Oct 31 must only count payments received on or before Oct 31. The existing
  `open_cents` uses all applications, so it's only right for "today". Join applications to payments and filter `received_on <= as_of`.
  Also exclude invoices with `due_date > as_of`, or decide that they go in "current". Ask.
- **Bucket edges:** is 30 days in "1–30" and 31 in "31–60"? Is due today "current"? State it and test the boundaries.
- **Credits:** Fern & Fig is $1,100 in credit. Show it as a separate column, or net it? Ask. Don't silently drop it.
- Show the report per tenant (lease) and grouped by property, with totals that reconcile to the sum of lease balances that are positive.

**Common Haiku mistakes:** N+1 loops; JS-side bucketing with `new Date()` arithmetic (timezone off-by-one); ignoring `as_of` when computing
open amounts; buckets that overlap or skip day 30/31; totals that don't reconcile.

---

## Task 5: scheduled rent increases (schema change)

**Expected schema:** a `rent_steps` (or `lease_rent_schedule`) table: `(id, lease_id, effective_date, monthly_rent_cents, UNIQUE(lease_id, effective_date))`.
Backfill one step per existing lease at its `start_date` with its current rent (in `seed.ts` here, and as a migration in production).
Then either drop `leases.monthly_rent_cents` or keep it as "base rent" and say which. Keeping both without a rule leads to two sources of truth.

**Billing:** `generateRentInvoices` needs the rent in effect for the month. Simplest correct query: latest step with `effective_date <= month.start`
(or use a `LATERAL` join). Ask: **what if a step starts mid-month?** (Prorate the two rates by days, or apply steps from the 1st only? Most leases
put steps on the 1st. Ask Marcus, then enforce it or handle it.)

**Rent roll / property list:** show the step in effect on `as_of`. Both `listProperties` (SQL sum) and `getRentRoll` need to change. Missing one is a common miss.

**API:** `POST /api/leases/:leaseId/rent-steps` with validation: date inside the lease (400), positive cents (400), duplicate date (409), unknown lease (404).
Example: Ostrander (lease ending 2031-05-31) → $11,845.00 from 2027-06-01. Then generating 2027-05 bills $11,500.00 and 2027-06 bills $11,845.00.

**Good discussion:** changing `monthly_rent_cents` in place rewrites history, which is the whole problem. Invoices store their own amount, so past invoices
stay correct either way. Should steps be editable once billed? (No, or only future ones.)

**Common Haiku mistakes:** forgetting the backfill so existing leases bill $0 or crash; picking the *earliest* step instead of the latest one in effect;
updating billing but not the rent roll and property list; N+1 per lease for the step lookup; edits to tests that rely on `monthly_rent_cents`.

---

## Task 6: reverse a bounced payment

**Seed data:** Alder Brewing's 2026-11-10 $7,000 payment (payment id 173 on a fresh seed) was applied $4,400 to the **August** invoice and $2,600 to **September**.
After the reversal, August should be $4,400 open, September $9,300 open, and Alder's balance should go from $25,300.00 to **$32,300.00**.

**"We don't delete things from the books":** don't `DELETE` the payment. Good designs:
- Add `reversed_on DATE` + `reversal_reason` to `payments`, and delete (or mark) its applications. Every query that sums payments or applications then has
  to ignore reversed payments: `getLeaseBalance`, `listInvoicesForLease`, `getPayment` / `listPaymentsForLease`, `sumPaidBefore`, `listPaymentsReceivedBetween`.
  **Missing one is the classic bug.** Grep for every `FROM payments` and every `payment_applications` join.
- Or record the reversal as its own row (a negative entry / reversal record) so the ledger is append-only. The `CHECK (amount_cents > 0)` constraints
  mean this needs a schema change. Either approach is fine if it's explained.

**Statement question (strong signal):** should the November statement show the original payment and then a reversal line, both in November?
Accountants usually want the reversal dated when it bounced, and earlier statements left unchanged. Ask Dana. Also ask about an NSF/bounced-payment fee.

**Must:** do it in one transaction; return 409 if it's already reversed; 404 for an unknown payment; show "Reversed" on the lease page's payments
table with a button or form to reverse. Bonus: after reopening older invoices, later payments that went to newer invoices are now "out of order" under
oldest-first. Mention whether you'd re-run the application (and why it may not matter for the balance).

**Common Haiku mistakes:** hard delete; reversing the payment but leaving its applications (invoices stay paid); filtering reversed payments in one query
but not the others, so the balance and the statement disagree; not using a transaction.

---

## Task 7: apply tenant credits to new invoices

**Seed data:** Fern & Fig ($2,400 rent) pays $2,500 on the 2nd of each month, so each payment has $100 unapplied: $1,100 credit across 11 payments.
All their invoices are already fully paid, so there's nothing to apply to **until December is billed**. That's a good thing to discover by
looking at the data before building. After billing December with the feature in place, Fern's December invoice should be $1,300.00 open,
with $1,100 applied from old payments (oldest payment's credit first), and their unapplied credit should be $0.

**Design:** reuse `planApplications`. For each lease with credit, walk payments with `unapplied_cents > 0` oldest first and insert `payment_applications`
rows from those payments to the open invoices. It must happen **inside the same transaction** as `generateRentInvoices` (or in a separate
idempotent "apply credits" step that's also run once for existing data). It needs the same locking as `recordPayment` should have (see the second issue above).

**Things to notice:**
- The **statement and balance are already correct** (they're based on totals, not applications). What's wrong is invoice-level "open" amounts, and
  anything built on them (e.g. aging). Saying this shows you understand the model.
- Should a credit be applied automatically, or should Dana approve it? Some tenants want overpayments refunded. Ask.
- Make the backfill idempotent and run it once (an endpoint, or a script like `db:reset`).

**Common Haiku mistakes:** creating a fake negative "credit invoice" or a new payment (double-counts cash); applying credit in JS and not persisting it;
not doing it in a transaction; applying newest credit first; running it per lease with N+1 queries over every lease every time.

---

## Task 8: occupancy and lease expirations (report, date edges)

**Expected as of 2026-11-21:** total 101,450 sq ft, vacant 5,200 sq ft (Harbor Point 106: 1,600; Suite 310: 2,800; Cedar Row Unit 4: 800), so
**96,250 sq ft occupied (94.9%)**, 18 of 21 units. By property: Harbor Point 10,900 / 12,500 (87.2%); Larkspur Office 18,000 / 20,800 (86.5%);
Millbrook 63,000 / 63,000 (100%); Cedar Row 4,350 / 5,150 (84.5%).

**Expiring within 90 days of 2026-11-21 (through 2027-02-19):** Meridian Family Therapy (Suite 220, 2026-12-31) and Bayside Nails & Spa (Harbor Point 105, 2027-01-31).
Lumen Yoga ends 2027-02-28, just outside the window, so it's a good boundary test. Ask whether "next 90 days" includes day 90, and whether it means 90 days or 3 calendar months.

**Things to ask/handle:** a lease that ends *on* the as-of date is still occupied that day (inclusive end dates). A lease signed for the future (none in seed, but Task 3 can create one):
occupied or "pre-leased"? Percent with integer math or rounding to one decimal; a property with no units (divide by zero).

**N+1 again:** one grouped SQL query (`SUM(square_feet) FILTER (WHERE l.id IS NOT NULL)`) beats looping over `getRentRoll` per property.
Expirations: `end_date BETWEEN $1 AND $1::date + 90` ordered by `end_date`.

**Common Haiku mistakes:** counting occupied units by lease count (the same unit can have two leases in history, so it needs the as-of filter);
`new Date()` date math in the browser; excluding leases ending exactly on the boundary; percent from rounded numbers.

---

## What good looks like (process, not just the result)

1. **Orient first (about 5 min):** read the README, run the tests and see the one failure, skim the layers (route → service → query), click through a rent roll and a lease page.
2. **Look at the data before building.** For example, Brightline's lease page shows the $342.86 sitting on November, and Fern's invoices are already all paid.
3. **Ask clarifying questions** when the ticket is vague (Task 2 especially), and state assumptions out loud when you can't ask.
4. **Specific prompts.** For example: "In `src/lib/dates.ts`, `daysInMonth` returns the previous month's length because `Date.UTC` months are 0-based.
   Fix it, keep the signature, and add a unit test for all 12 months of 2026 and Feb 2028 in `test/dates.test.ts`. Don't change any other file." Not: "fix proration."
5. **Review every diff**, especially date math, SQL and money. Push back when the agent edits tests to match wrong output.
6. **Run `npm test` and `npm run typecheck` after each change**, not only at the end.
7. **Name tradeoffs:** history vs adjustments, transactions and locking, 400 vs 409 vs 422, N+1 vs one query, idempotency.
8. **Small, separate commits**, one per logical change.

Red flags: accepting a large agent diff unread; changing tests to match buggy output; floats for money; date math with local `Date` objects;
multi-row writes without a transaction; string-concatenated SQL; `innerHTML` with tenant names.
