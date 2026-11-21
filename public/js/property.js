import { balanceCell, formatCents, getJson, row, showMessage } from "./api.js";

const params = new URLSearchParams(location.search);
const propertyId = params.get("id");
const message = document.getElementById("message");
const asOfInput = document.querySelector("#as-of-form input[name=as_of]");

async function loadRentRoll(asOf) {
  const query = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
  const { property, as_of, units, totals } = await getJson(`/api/properties/${propertyId}${query}`);
  document.title = `${property.name} · Larkspur Property Group`;
  document.getElementById("property-name").textContent = property.name;
  document.getElementById("property-meta").textContent =
    `${property.address} · ${property.kind} · ${totals.occupied_units} of ${totals.unit_count} units occupied`;
  asOfInput.value = as_of;

  document.getElementById("units").replaceChildren(
    ...units.map((u) =>
      u.lease
        ? row([
            u.unit_number,
            { text: u.square_feet.toLocaleString("en-US"), className: "num" },
            { text: u.lease.tenant_name, href: `/lease.html?id=${u.lease.id}` },
            u.lease.start_date,
            u.lease.end_date,
            { text: formatCents(u.lease.monthly_rent_cents), className: "num" },
            balanceCell(u.lease.balance_cents),
          ])
        : row([
            u.unit_number,
            { text: u.square_feet.toLocaleString("en-US"), className: "num" },
            { text: "Vacant", className: "muted" },
            "",
            "",
            "",
            "",
          ]),
    ),
  );
  document.getElementById("totals").replaceChildren(
    row([
      "Total",
      "",
      "",
      "",
      "",
      { text: formatCents(totals.monthly_rent_cents), className: "num" },
      balanceCell(totals.balance_cents),
    ]),
  );
}

document.getElementById("as-of-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadRentRoll(asOfInput.value).catch((err) => showMessage(message, err.message, "error"));
});

if (!propertyId) {
  showMessage(message, "No property selected.", "error");
} else {
  loadRentRoll(params.get("as_of")).catch((err) => showMessage(message, err.message, "error"));
}
