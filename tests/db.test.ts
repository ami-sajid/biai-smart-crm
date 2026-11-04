import { test } from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import { list, save, reserve, setup } from "../lib/db";
import { editable } from "../lib/domain";
function mock() {
  const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
  return new Pool();
}
test("repeat import keeps exactly 20 records and retains staff edits", async () => {
  const p = mock();
  const rows = await list(p),
    r = rows[0];
  const changed = await save(p, {
    id: r.id,
    version: r.version,
    changes: { ...editable(r), status: "Contacted" },
    paymentVerified: false,
    identityApproved: false,
    followUp: false,
  });
  assert.equal(changed.version, 1);
  const again = await list(p);
  assert.equal(again.length, 20);
  assert.equal(again[0].status, "Contacted");
  assert.equal(again[0].message, r.message);
  assert.equal((await p.query("SELECT * FROM biai_web_audit")).rows.length, 1);
  await p.end();
});
test("stale DB save is rejected", async () => {
  const p = mock();
  const r = (await list(p))[0];
  const payload = {
    id: r.id,
    version: r.version,
    changes: { ...editable(r), status: "Contacted" as const },
    paymentVerified: false,
    identityApproved: false,
    followUp: false,
  };
  await save(p, payload);
  await assert.rejects(() => save(p, payload), /changed/);
  await p.end();
});
test("daily budget cannot exceed configured cap", async () => {
  const p = mock();
  await setup(p);
  await reserve(p, "test-day", 2);
  await reserve(p, "test-day", 2);
  await assert.rejects(() => reserve(p, "test-day", 2), /limit/);
  assert.equal(
    (await p.query("SELECT used FROM biai_web_budget")).rows[0].used,
    2,
  );
  await p.end();
});
test("zero cap disables requests", async () => {
  const p = mock();
  await setup(p);
  await assert.rejects(() => reserve(p, "disabled", 0), /limit/);
  await p.end();
});
