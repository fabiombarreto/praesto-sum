#!/usr/bin/env node
/**
 * A local-only fixture standing in for the deployed Worker's two export
 * routes during data-export phase 4's Level 3 validation. Never deployed,
 * never imported by production code — its whole purpose is to let
 * `scripts/pull-export-snapshot.mjs` be exercised end to end, including its
 * bad-token failure path, without ever making a live call to production.
 */
import { createServer } from "node:http";

const TOKEN = process.env.PRAESTO_MOCK_TOKEN ?? "correct-token";
const PORT = Number(process.env.PRAESTO_MOCK_PORT ?? 4173);
const DATE = process.env.PRAESTO_MOCK_DATE ?? new Date().toISOString().slice(0, 10);

const server = createServer((req, res) => {
  const authorization = req.headers.authorization ?? "";
  if (authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const url = req.url ?? "";
  if (url.endsWith("/api/export.ics")) {
    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="praesto-${DATE}.ics"`,
    });
    res.end("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    return;
  }

  if (url.endsWith("/api/export")) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="praesto-${DATE}.json"`,
    });
    res.end("{}");
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`mock-export-server: listening on ${PORT}`);
});
