import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./lib/errors";
import { invoicesRouter } from "./routes/invoices";
import { leasesRouter } from "./routes/leases";
import { propertiesRouter } from "./routes/properties";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/properties", propertiesRouter);
  app.use("/api/leases", leasesRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Plain HTML/JS frontend.
  app.use(express.static(publicDir));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
