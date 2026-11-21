import { Router } from "express";
import * as properties from "../services/properties";
import { todayIso } from "../lib/dates";
import { parseDate, parseId } from "../lib/validation";

export const propertiesRouter = Router();

/** ?as_of=YYYY-MM-DD, defaulting to today. */
function asOfParam(value: unknown): string {
  return value === undefined ? todayIso() : parseDate(value, "as_of");
}

propertiesRouter.get("/", async (req, res) => {
  res.json(await properties.listProperties(asOfParam(req.query.as_of)));
});

propertiesRouter.get("/:propertyId", async (req, res) => {
  res.json(
    await properties.getRentRoll(parseId(req.params.propertyId, "propertyId"), asOfParam(req.query.as_of)),
  );
});
