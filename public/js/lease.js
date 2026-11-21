import { balanceCell, dollarsToCents, formatCents, getJson, postJson, row, showMessage } from "./api.js";

const leaseId = new URLSearchParams(location.search).get("id");
const message = document.getElementById("message");

function summaryItem(label, cents) {
  const div = document.createElement("div");
  div.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = formatCents(cents);
  div.prepend(strong);
  return div;
}

async function loadLease() {
  const { lease, invoices, payments, totals } = await getJson(`/api/leases/${leaseId}`);
  document.title = `${lease.tenant_name} · Larkspur Property Group`;
  document.getElementById("tenant-name").textContent = lease.tenant_name;
  document.getElementById("lease-meta").textContent =
    `${lease.property_name}, ${lease.unit_number} · ${lease.start_date} to ${lease.end_date} · ` +
    `${formatCents(lease.monthly_rent_cents)} / month · ${lease.contact_email}`;
  document.getElementById("back-link").href = `/property.html?id=${lease.property_id}`;

  document.getElementById("summary").replaceChildren(
    summaryItem("Billed to date", totals.billed_cents),
    summaryItem("Paid to date", totals.paid_cents),
    summaryItem("Balance (negative = credit)", totals.balance_cents),
    summaryItem("Unapplied credit", totals.unapplied_credit_cents),
  );

  document.getElementById("invoices").replaceChildren(
    ...invoices.map((i) =>
      row([
        i.due_date,
        i.description,
        { text: formatCents(i.amount_cents), className: "num" },
        { text: formatCents(i.paid_cents), className: "num" },
        balanceCell(i.open_cents),
      ]),
    ),
  );
  document.getElementById("payments").replaceChildren(
    ...payments.map((p) =>
      row([
        p.received_on,
        p.reference,
        { text: formatCents(p.amount_cents), className: "num" },
        { text: formatCents(p.applied_cents), className: "num" },
        { text: formatCents(p.unapplied_cents), className: "num" },
      ]),
    ),
  );
}

function statementTable(rows) {
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  tbody.append(...rows);
  table.append(tbody);
  return table;
}

async function loadStatement(month) {
  const s = await getJson(`/api/leases/${leaseId}/statements/${month}`);
  const rows = [
    row(["Balance brought forward", "", balanceCell(s.opening_balance_cents)]),
    ...s.charges.map((c) => row([c.due_date, c.description, { text: formatCents(c.amount_cents), className: "num" }])),
    ...s.payments.map((p) =>
      row([p.received_on, `Payment ${p.reference}`.trim(), { text: `−${formatCents(p.amount_cents)}`, className: "num" }]),
    ),
    row(["Closing balance", "", balanceCell(s.closing_balance_cents)]),
  ];
  const heading = document.createElement("p");
  heading.className = "muted";
  heading.textContent = `${s.month_name}: ${s.period.start} to ${s.period.end}`;
  document.getElementById("statement").replaceChildren(heading, statementTable(rows));
}

document.getElementById("payment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const out = document.getElementById("payment-message");
  const data = new FormData(form);
  const amountCents = dollarsToCents(data.get("amount"));
  if (amountCents === null || amountCents <= 0) {
    showMessage(out, "Enter a positive dollar amount, e.g. 4850.00", "error");
    return;
  }
  try {
    const payment = await postJson(`/api/leases/${leaseId}/payments`, {
      received_on: data.get("received_on"),
      amount_cents: amountCents,
      reference: data.get("reference"),
    });
    const credit = payment.unapplied_cents > 0 ? `, ${formatCents(payment.unapplied_cents)} left as credit` : "";
    showMessage(
      out,
      `Recorded ${formatCents(payment.amount_cents)} across ${payment.applications.length} invoice(s)${credit}.`,
      "ok",
    );
    form.reset();
    await loadLease();
  } catch (err) {
    showMessage(out, err.message, "error");
  }
});

document.getElementById("statement-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const month = new FormData(event.currentTarget).get("month");
  loadStatement(month).catch((err) => showMessage(message, err.message, "error"));
});

if (!leaseId) {
  showMessage(message, "No lease selected.", "error");
} else {
  loadLease().catch((err) => showMessage(message, err.message, "error"));
}
