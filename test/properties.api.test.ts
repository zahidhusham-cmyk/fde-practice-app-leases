import { describe, expect, it } from "vitest";
import { api, propertyIdByName, useFreshDatabase } from "./helpers";

useFreshDatabase();

type RentRollUnit = { unit_number: string; lease: { tenant_name: string; balance_cents: number } | null };
const unit = (units: RentRollUnit[], number: string) => units.find((u) => u.unit_number === number)!;

describe("GET /api/properties", () => {
  it("lists properties with occupancy and contracted rent as of a date", async () => {
    const res = await api().get("/api/properties?as_of=2026-11-21").expect(200);
    expect(res.body).toHaveLength(4);
    const harbor = res.body.find((p: { name: string }) => p.name === "Harbor Point Plaza");
    expect(harbor).toMatchObject({ unit_count: 6, occupied_units: 5, monthly_rent_cents: 28_000_00 });
  });

  it("defaults as_of to today and rejects a bad date", async () => {
    await api().get("/api/properties").expect(200);
    await api().get("/api/properties?as_of=2026-13-01").expect(400);
  });
});

describe("GET /api/properties/:propertyId (rent roll)", () => {
  it("shows who occupies each unit on the as_of date", async () => {
    const id = await propertyIdByName("Millbrook Industrial Park");
    const nov = await api().get(`/api/properties/${id}?as_of=2026-11-21`).expect(200);
    const mar = await api().get(`/api/properties/${id}?as_of=2026-03-15`).expect(200);
    const jul = await api().get(`/api/properties/${id}?as_of=2026-07-01`).expect(200);

    expect(unit(nov.body.units, "Bay C").lease?.tenant_name).toBe("Kestrel Auto Parts");
    expect(unit(mar.body.units, "Bay C").lease?.tenant_name).toBe("Dunmore Woodworks");
    expect(unit(jul.body.units, "Bay C").lease).toBeNull();
    expect(nov.body.totals).toMatchObject({ unit_count: 4, occupied_units: 4 });
  });

  it("shows each tenant's balance and the property total", async () => {
    const id = await propertyIdByName("Larkspur Office Center");
    const res = await api().get(`/api/properties/${id}?as_of=2026-11-21`).expect(200);

    expect(unit(res.body.units, "Suite 300").lease?.balance_cents).toBe(25_800_00);
    expect(unit(res.body.units, "Suite 310").lease).toBeNull();
    expect(res.body.totals).toMatchObject({ unit_count: 6, occupied_units: 5, balance_cents: 25_800_00 });
  });

  it("returns 404 for an unknown property and 400 for a bad id", async () => {
    await api().get("/api/properties/9999").expect(404);
    await api().get("/api/properties/abc").expect(400);
  });
});

describe("static pages", () => {
  it("serves the HTML frontend", async () => {
    const res = await api().get("/").expect(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("Larkspur Property Group");
    await api().get("/lease.html").expect(200);
    await api().get("/property.html").expect(200);
  });
});
