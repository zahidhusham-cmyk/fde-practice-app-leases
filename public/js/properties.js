import { formatCents, getJson, postJson, row, showMessage } from "./api.js";

const message = document.getElementById("message");

async function loadProperties() {
  const properties = await getJson("/api/properties");
  document.getElementById("as-of").textContent = `Occupancy as of today`;
  document.getElementById("properties").replaceChildren(
    ...properties.map((p) =>
      row([
        { text: p.name, href: `/property.html?id=${p.id}` },
        p.kind,
        p.address,
        { text: String(p.unit_count), className: "num" },
        { text: String(p.occupied_units), className: "num" },
        { text: formatCents(p.monthly_rent_cents), className: "num" },
      ]),
    ),
  );
}

document.getElementById("generate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const out = document.getElementById("generate-message");
  const month = new FormData(event.currentTarget).get("month");
  try {
    const result = await postJson("/api/invoices/generate", { month });
    showMessage(
      out,
      `${result.month}: created ${result.created_count} invoices (${formatCents(result.total_billed_cents)}), skipped ${result.skipped_count} already billed.`,
      "ok",
    );
  } catch (err) {
    showMessage(out, err.message, "error");
  }
});

loadProperties().catch((err) => showMessage(message, err.message, "error"));
