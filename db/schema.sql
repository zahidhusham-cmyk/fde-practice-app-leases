-- Larkspur Property Group: lease billing schema.
-- npm run db:reset (and every API test) drops and recreates everything from this file.
-- Money is integer cents in BIGINT columns. Dates are DATE (no time, no timezone).

DROP TABLE IF EXISTS payment_applications;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS leases;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS properties;

CREATE TABLE properties (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  address   TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('retail', 'office', 'industrial'))
);

CREATE TABLE units (
  id           SERIAL PRIMARY KEY,
  property_id  INTEGER NOT NULL REFERENCES properties(id),
  unit_number  TEXT NOT NULL,
  square_feet  INTEGER NOT NULL CHECK (square_feet > 0),
  UNIQUE (property_id, unit_number)
);

CREATE TABLE tenants (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  contact_email  TEXT NOT NULL
);

-- start_date and end_date are both inclusive: the tenant occupies the unit on both days.
CREATE TABLE leases (
  id                  SERIAL PRIMARY KEY,
  unit_id             INTEGER NOT NULL REFERENCES units(id),
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  monthly_rent_cents  BIGINT NOT NULL CHECK (monthly_rent_cents > 0),
  CHECK (end_date >= start_date)
);
CREATE INDEX leases_unit_idx ON leases (unit_id);

-- One rent invoice per lease per month. period_start is always the 1st of the month.
CREATE TABLE invoices (
  id            SERIAL PRIMARY KEY,
  lease_id      INTEGER NOT NULL REFERENCES leases(id),
  kind          TEXT NOT NULL DEFAULT 'rent' CHECK (kind IN ('rent', 'fee')),
  period_start  DATE NOT NULL,
  due_date      DATE NOT NULL,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  description   TEXT NOT NULL,
  UNIQUE (lease_id, kind, period_start)
);
CREATE INDEX invoices_lease_idx ON invoices (lease_id);

CREATE TABLE payments (
  id            SERIAL PRIMARY KEY,
  lease_id      INTEGER NOT NULL REFERENCES leases(id),
  received_on   DATE NOT NULL,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  reference     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX payments_lease_idx ON payments (lease_id);

-- How much of each payment went to which invoice. A payment's leftover (amount minus
-- its applications) is unapplied credit.
CREATE TABLE payment_applications (
  id            SERIAL PRIMARY KEY,
  payment_id    INTEGER NOT NULL REFERENCES payments(id),
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id),
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0)
);
CREATE INDEX payment_applications_invoice_idx ON payment_applications (invoice_id);
CREATE INDEX payment_applications_payment_idx ON payment_applications (payment_id);
