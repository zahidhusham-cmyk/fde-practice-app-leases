// Small helpers shared by every page. No framework: fetch + DOM.

export async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export async function postJson(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 123456 -> "$1,234.56" */
export function formatCents(cents) {
  return usd.format(cents / 100);
}

/** "1,234.56" -> 123456. Returns null if the text is not a valid dollar amount. */
export function dollarsToCents(text) {
  const cleaned = String(text).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Build a <tr> from cell specs: a string, or { text, className, href }. */
export function row(cells, tag = "td") {
  const tr = document.createElement("tr");
  for (const cell of cells) {
    const spec = typeof cell === "object" && cell !== null ? cell : { text: cell };
    const td = document.createElement(tag);
    if (spec.className) td.className = spec.className;
    if (spec.href) {
      const a = document.createElement("a");
      a.href = spec.href;
      a.textContent = spec.text;
      td.append(a);
    } else {
      td.textContent = spec.text ?? "";
    }
    tr.append(td);
  }
  return tr;
}

export function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = `message ${kind}`;
}

/** Balance cell: red when the tenant owes money, green when they're in credit. */
export function balanceCell(cents) {
  return { text: formatCents(cents), className: cents > 0 ? "num owing" : cents < 0 ? "num credit" : "num" };
}
