import { addDays, parseMonth } from "../lib/dates";
import { generateRentInvoices } from "../services/invoices";
import { recordPayment } from "../services/payments";
import { pool } from "./pool";

// Seed data for Larkspur Property Group. Billing in the tool started in January 2026,
// so there are no invoices before then even for older leases. Invoices go through
// generateRentInvoices and payments through recordPayment, exactly like the app does.

const LAST_SEEDED_DAY = "2026-11-20";
const BILLED_MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"].map(
  (m) => `2026-${m}`,
);

const PROPERTIES = [
  { name: "Harbor Point Plaza", address: "1200 Harbor Point Blvd, Portland, ME", kind: "retail" },
  { name: "Larkspur Office Center", address: "45 Larkspur Way, Portland, ME", kind: "office" },
  { name: "Millbrook Industrial Park", address: "8 Millbrook Rd, Westbrook, ME", kind: "industrial" },
  { name: "Cedar Row Shops", address: "310 Cedar St, Falmouth, ME", kind: "retail" },
] as const;

const UNITS: { property: string; unit: string; sqft: number }[] = [
  ...["101", "102", "103", "104", "105", "106"].map((unit, i) => ({
    property: "Harbor Point Plaza",
    unit,
    sqft: [1800, 2400, 3200, 2100, 1400, 1600][i]!,
  })),
  ...["Suite 200", "Suite 210", "Suite 220", "Suite 300", "Suite 310", "Suite 320"].map((unit, i) => ({
    property: "Larkspur Office Center",
    unit,
    sqft: [4200, 3100, 1900, 3600, 2800, 5200][i]!,
  })),
  ...["Bay A", "Bay B", "Bay C", "Bay D"].map((unit, i) => ({
    property: "Millbrook Industrial Park",
    unit,
    sqft: [18000, 24000, 9000, 12000][i]!,
  })),
  ...["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"].map((unit, i) => ({
    property: "Cedar Row Shops",
    unit,
    sqft: [1100, 950, 1300, 800, 1000][i]!,
  })),
];

/** How a tenant pays in the seed data. */
type PaymentPattern =
  | { kind: "on_time" } // pays each invoice in full a few days after it's due
  | { kind: "on_time_until"; lastMonth: string } // then stops paying
  | { kind: "fixed"; amountCents: number; day: number } // same amount every month, regardless of the invoice
  | { kind: "arrears"; day: number }; // pays last month's invoice on this day of the following month

interface SeedLease {
  property: string;
  unit: string;
  tenant: string;
  email: string;
  start: string;
  end: string;
  rentCents: number;
  pattern: PaymentPattern;
  /** Month -> amount actually paid that month instead of the invoice amount. */
  overrides?: Record<string, number>;
}

const ON_TIME: PaymentPattern = { kind: "on_time" };

const LEASES: SeedLease[] = [
  // Harbor Point Plaza
  { property: "Harbor Point Plaza", unit: "101", tenant: "Tidewater Coffee Co.", email: "ap@tidewatercoffee.example", start: "2024-03-01", end: "2029-02-28", rentCents: 4_850_00, pattern: ON_TIME },
  { property: "Harbor Point Plaza", unit: "102", tenant: "Brightline Dental, LLC", email: "office@brightlinedental.example", start: "2026-03-16", end: "2031-03-31", rentCents: 6_200_00, pattern: ON_TIME, overrides: { "2026-03": 3_200_00 } },
  { property: "Harbor Point Plaza", unit: "103", tenant: "Pinecrest Pharmacy", email: "accounts@pinecrestrx.example", start: "2022-07-01", end: "2027-06-30", rentCents: 7_400_00, pattern: ON_TIME },
  { property: "Harbor Point Plaza", unit: "104", tenant: "Salt & Ember Pizza", email: "owner@saltandember.example", start: "2021-01-01", end: "2026-06-15", rentCents: 5_100_00, pattern: ON_TIME },
  { property: "Harbor Point Plaza", unit: "104", tenant: "Northwind Fitness", email: "billing@northwindfit.example", start: "2026-09-01", end: "2031-08-31", rentCents: 5_600_00, pattern: ON_TIME },
  { property: "Harbor Point Plaza", unit: "105", tenant: "Bayside Nails & Spa", email: "baysidenails@example.com", start: "2025-05-01", end: "2027-01-31", rentCents: 3_950_00, pattern: ON_TIME },
  // Larkspur Office Center
  { property: "Larkspur Office Center", unit: "Suite 200", tenant: "Halvorsen & Reyes, Attorneys at Law", email: "accounting@halvorsenreyes.example", start: "2023-10-01", end: "2028-09-30", rentCents: 9_800_00, pattern: ON_TIME },
  { property: "Larkspur Office Center", unit: "Suite 210", tenant: "Quillon Analytics, Inc.", email: "finance@quillon.example", start: "2026-08-11", end: "2029-08-31", rentCents: 7_250_00, pattern: ON_TIME },
  { property: "Larkspur Office Center", unit: "Suite 220", tenant: "Meridian Family Therapy", email: "admin@meridianft.example", start: "2025-01-01", end: "2026-12-31", rentCents: 4_400_00, pattern: ON_TIME },
  { property: "Larkspur Office Center", unit: "Suite 300", tenant: "Copperleaf Insurance Agency", email: "ops@copperleafins.example", start: "2024-06-01", end: "2027-05-31", rentCents: 8_600_00, pattern: { kind: "on_time_until", lastMonth: "2026-08" } },
  { property: "Larkspur Office Center", unit: "Suite 320", tenant: "Ostrander Engineering Group", email: "ap@ostrandereng.example", start: "2026-05-20", end: "2031-05-31", rentCents: 11_500_00, pattern: ON_TIME },
  // Millbrook Industrial Park
  { property: "Millbrook Industrial Park", unit: "Bay A", tenant: "Granite State Logistics", email: "payables@granitestatelogistics.example", start: "2023-01-01", end: "2028-12-31", rentCents: 14_200_00, pattern: ON_TIME },
  { property: "Millbrook Industrial Park", unit: "Bay B", tenant: "Northeast Cold Storage, Inc.", email: "ar-ap@necoldstorage.example", start: "2025-11-01", end: "2030-10-31", rentCents: 18_750_00, pattern: ON_TIME },
  { property: "Millbrook Industrial Park", unit: "Bay C", tenant: "Dunmore Woodworks", email: "dunmorewoodworks@example.com", start: "2020-04-01", end: "2026-03-31", rentCents: 6_900_00, pattern: ON_TIME },
  { property: "Millbrook Industrial Park", unit: "Bay C", tenant: "Kestrel Auto Parts", email: "accounts@kestrelauto.example", start: "2026-10-04", end: "2031-10-31", rentCents: 8_100_00, pattern: { kind: "on_time_until", lastMonth: "2026-10" } },
  { property: "Millbrook Industrial Park", unit: "Bay D", tenant: "Alder Brewing Company", email: "books@alderbrewing.example", start: "2024-09-01", end: "2029-08-31", rentCents: 9_300_00, pattern: { kind: "fixed", amountCents: 7_000_00, day: 10 } },
  // Cedar Row Shops
  { property: "Cedar Row Shops", unit: "Unit 1", tenant: "Cedar Row Books", email: "hello@cedarrowbooks.example", start: "2023-02-01", end: "2028-01-31", rentCents: 2_750_00, pattern: ON_TIME },
  { property: "Cedar Row Shops", unit: "Unit 2", tenant: "Fern & Fig Florist", email: "fernandfig@example.com", start: "2025-08-01", end: "2027-07-31", rentCents: 2_400_00, pattern: { kind: "fixed", amountCents: 2_500_00, day: 2 } },
  { property: "Cedar Row Shops", unit: "Unit 3", tenant: "Lumen Yoga Studio", email: "studio@lumenyoga.example", start: "2026-01-12", end: "2027-02-28", rentCents: 3_100_00, pattern: ON_TIME },
  { property: "Cedar Row Shops", unit: "Unit 4", tenant: "Two Rivers Tailoring", email: "tworiverstailoring@example.com", start: "2019-06-01", end: "2026-02-28", rentCents: 2_200_00, pattern: ON_TIME },
  { property: "Cedar Row Shops", unit: "Unit 5", tenant: "Sundial Ice Cream", email: "sundialicecream@example.com", start: "2024-04-01", end: "2029-03-31", rentCents: 2_600_00, pattern: { kind: "arrears", day: 18 } },
];

interface PlannedPayment {
  leaseId: number;
  receivedOn: string;
  amountCents: number;
  reference: string;
}

function reference(leaseIndex: number, month: string): string {
  return leaseIndex % 3 === 0 ? `Check #${1000 + leaseIndex * 37 + Number(month.slice(5))}` : "ACH";
}

export async function seed(): Promise<void> {
  const propertyIds = new Map<string, number>();
  for (const p of PROPERTIES) {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO properties (name, address, kind) VALUES ($1, $2, $3) RETURNING id`,
      [p.name, p.address, p.kind],
    );
    propertyIds.set(p.name, rows[0]!.id);
  }

  const unitIds = new Map<string, number>();
  for (const u of UNITS) {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO units (property_id, unit_number, square_feet) VALUES ($1, $2, $3) RETURNING id`,
      [propertyIds.get(u.property), u.unit, u.sqft],
    );
    unitIds.set(`${u.property}/${u.unit}`, rows[0]!.id);
  }

  const leaseIds: number[] = [];
  for (const l of LEASES) {
    const tenant = await pool.query<{ id: number }>(
      `INSERT INTO tenants (name, contact_email) VALUES ($1, $2) RETURNING id`,
      [l.tenant, l.email],
    );
    const lease = await pool.query<{ id: number }>(
      `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [unitIds.get(`${l.property}/${l.unit}`), tenant.rows[0]!.id, l.start, l.end, l.rentCents],
    );
    leaseIds.push(lease.rows[0]!.id);
  }

  // Month by month: bill rent on the 1st, then record that month's payments in date order.
  const invoiceAmounts = new Map<string, { amount: number; due: string }>(); // `${leaseId}/${month}`
  for (const label of BILLED_MONTHS) {
    const month = parseMonth(label);
    const result = await generateRentInvoices(month);
    for (const inv of result.invoices) {
      invoiceAmounts.set(`${inv.lease_id}/${label}`, { amount: inv.amount_cents, due: inv.due_date });
    }

    const planned: PlannedPayment[] = [];
    LEASES.forEach((l, i) => {
      const leaseId = leaseIds[i]!;
      const thisMonth = invoiceAmounts.get(`${leaseId}/${label}`);
      const ref = reference(i, label);
      const p = l.pattern;

      if (p.kind === "on_time" || (p.kind === "on_time_until" && label <= p.lastMonth)) {
        if (!thisMonth) return;
        planned.push({
          leaseId,
          receivedOn: addDays(thisMonth.due, (i % 4) + 1),
          amountCents: l.overrides?.[label] ?? thisMonth.amount,
          reference: ref,
        });
      } else if (p.kind === "fixed") {
        if (!thisMonth) return;
        planned.push({ leaseId, receivedOn: `${label}-${String(p.day).padStart(2, "0")}`, amountCents: p.amountCents, reference: ref });
      } else if (p.kind === "arrears") {
        const prevLabel = BILLED_MONTHS[BILLED_MONTHS.indexOf(label) - 1];
        const prev = prevLabel ? invoiceAmounts.get(`${leaseId}/${prevLabel}`) : undefined;
        if (!prev) return;
        planned.push({ leaseId, receivedOn: `${label}-${String(p.day).padStart(2, "0")}`, amountCents: prev.amount, reference: ref });
      }
    });

    const due = planned
      .filter((p) => p.receivedOn <= LAST_SEEDED_DAY)
      .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.leaseId - b.leaseId);
    for (const p of due) {
      await recordPayment(p);
    }
  }
}
