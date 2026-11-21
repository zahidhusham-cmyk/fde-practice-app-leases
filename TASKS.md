# Tasks

> **How to run a session:** start on a fresh branch off `main`
> (`git switch main && git pull && git switch -c practice/<task>-<date>`, then `npm run db:reset`). Pick **one**
> task below, set a **45-minute timer**, and use the smallest model available (Haiku). Spend the first few minutes
> exploring the codebase and the app before you prompt anything.
>
> On `main`, `npm test` has **one known failure**, which belongs to Task 1. If you're doing Tasks 2–8, leave it alone
> and don't add any new failures. Each task stands on its own: you don't need to have done any other task first.
>
> Explain what you're doing and why as you go. You're not expected to finish every last detail.

---

**From:** Dana Whitcomb, Controller
**Subject:** Brightline Dental says their first invoice was wrong

### 1. A move-in invoice that doesn't add up

Hi,

Brightline Dental moved into Harbor Point, unit 102, on March 16. Their first invoice was $3,542.86. Their
bookkeeper says 16 days of a $6,200 month should be $3,200.00, so that's what they paid, and now our system says
they still owe us money. She's been polite about it, but she's asked twice.

I spot-checked a couple of other mid-month move-ins and those looked right to me, so I'm not sure what's going on.
Could you work out what's happening, fix it so it can't come back, and tell me which other invoices are affected?
Please don't change any invoices we've already sent until we've talked about how to correct them.

Thanks,
Dana

---

**From:** Dana Whitcomb, Controller
**Subject:** Late fees

### 2. Charge late fees on overdue rent

Our leases let us charge a late fee when rent isn't paid on time, but we never actually do it because nobody has
time to work them out by hand. Could the tool add late fees to tenants who are late?

The standard lease language is "5% of the overdue amount, if rent is not received within 5 days of the due date."
A few tenants are always late, and they should start seeing these on their statements. Sundial Ice Cream is the
obvious one.

Thanks,
Dana

---

**From:** Marcus Bell, Leasing Manager
**Subject:** Signing new leases without engineering

### 3. Sign a new lease from the property page

Every time we sign a new tenant I have to email engineering to get the lease into the system. I'd like to do it
myself from the property page: pick the unit, enter the tenant (new or existing), the start and end dates and the
monthly rent, and save it.

Please make sure it won't let me make a mess. Last year someone double-booked a unit in the old spreadsheet and we
billed two tenants for the same space for three months. If something's wrong I need a message that tells me what
to fix.

Marcus

---

**From:** Dana Whitcomb, Controller
**Subject:** Who owes us money, and for how long

### 4. Accounts receivable aging report

At month end I need an aging report: every tenant who owes us money, across all four properties, with what they
owe split by how overdue it is. The usual buckets are current (not yet due), 1–30 days past due, 31–60, 61–90 and
over 90 days. I'd like a total row, and to be able to run it "as of" a date, since I usually close the books a few
days after month end.

A page I can look at is fine for now. It needs to stay fast. We're buying two more buildings next year.

Dana

---

**From:** Marcus Bell, Leasing Manager
**Subject:** Rent increases

### 5. Scheduled rent increases

Most of our leases have rent steps written into them: the rent goes up on set dates, for example to $5,000 a month
from the second year and $5,150 from the third. Right now each lease has one monthly rent, so when a step date
arrives someone has to remember to change it, and if we change the number it rewrites history.

We need to store each lease's rent schedule and have monthly billing charge the rent that applies to that month.
The rent roll should show the rent that's in effect on the date being viewed. Ostrander Engineering is going up to
$11,845.00 on 2027-06-01, if you want a real example.

Marcus

---

**From:** Dana Whitcomb, Controller
**Subject:** Bounced payment from Alder Brewing

### 6. Reverse a bounced payment

Our bank just told us Alder Brewing's $7,000 payment from November 10 bounced. There's no way to undo a payment in
the tool, so their account now shows them owing less than they really do.

Could you add a way to reverse a payment that bounces? The invoices it paid should show as unpaid again, the
tenant's balance and statement should be right, and we need to be able to see afterwards that the payment
happened and was reversed. We don't delete things from the books.

Dana

---

**From:** Dana Whitcomb, Controller
**Subject:** Fern & Fig keep overpaying

### 7. Apply tenant credits to new invoices

Fern & Fig pays $2,500 every month even though their rent is $2,400, so they've built up over a thousand dollars
of credit. That money just sits on their old payments. When we bill December, their new invoice will show the full
$2,400 as open even though they've already paid more than half of it, and it'll look like they owe us rent.

When a tenant has unapplied credit, it should be used against their open invoices, oldest first, the same way a
new payment would be. That should happen when new invoices are billed, and we'd also like to fix up the tenants
who already have credit today.

Dana

---

**From:** Marcus Bell, Leasing Manager
**Subject:** Occupancy and expiring leases

### 8. Occupancy and upcoming lease expirations

The owners ask me every month how full each building is and which leases are coming up for renewal. I'd like a
page that shows, for each property, how many units and square feet are occupied versus vacant on a given date,
and a list of the leases that end in the next 90 days (tenant, unit, end date, monthly rent), soonest first.

Occupancy by square feet matters more to the owners than by unit count, because one warehouse bay is bigger than
the whole of Cedar Row.

Marcus
