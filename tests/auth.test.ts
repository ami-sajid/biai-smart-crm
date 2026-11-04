import { test } from "node:test";
import assert from "node:assert/strict";
import { guard, configured, safeError } from "../lib/auth";

test("public demo permits reading and same-origin writes without login", async () => {
  await guard(new Request("http://localhost:3000/api/crm"));
  await guard(new Request("http://localhost:3000/api/crm", {
    method: "PATCH",
    headers: { origin: "http://localhost:3000" },
    body: "{}",
  }));
  assert.ok(!safeError(new Error("Request limit exceeded")).includes("access code"));
});

test("same-origin validation still rejects cross-site write requests", async () => {
  await assert.rejects(() => guard(new Request("https://example.com/api/crm", {
    method: "POST", headers: { origin: "https://other.example.com" }, body: "{}",
  })), /Request origin rejected/);
  assert.equal(safeError(new Error("Request origin rejected.")), "Request origin rejected.");
});

test("database configuration is independent of any reviewer password", () => {
  const old = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://example:example@localhost/demo";
  try { assert.equal(configured(), true); }
  finally {
    if (old === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = old;
  }
});
