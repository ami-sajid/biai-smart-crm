import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newDb } from "pg-mem";
import { create, list, save } from "../lib/db";
import {
  seed,
  editable,
  createSchema,
  newEnquiry,
  fieldOrigin,
  ground,
  type CreateInput,
  type Analysis,
} from "../lib/domain";
function database() {
  const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
  return new Pool();
}
function input(): CreateInput {
  return {
    requestId: randomUUID(),
    channel: "WhatsApp",
    message: seed()[0].message,
    changes: { ...editable(seed()[0]), status: "New", name: "", phone: "" },
  };
}
const analysis: Analysis = {
  customer_name: null,
  phone_number: null,
  programme: "Bootcamp",
  enquiry_type: "Sales",
  detected_language: "English",
  customer_intent: "Programme information",
  suggested_reply: "How can we help?",
  needs_human_review: true,
};
test("creation allocates unique database IDs, persists and preserves all 20 official rows exactly", async () => {
  const p = database();
  const before = await list(p);
  const a = await create(p, input()),
    b = await create(p, input());
  assert.notEqual(a.id, b.id);
  assert.ok(a.id > 20);
  assert.equal(a.status, "New");
  assert.equal(a.origin, "Manual Entry");
  assert.equal(a.name, "");
  assert.equal(a.phone, "");
  const after = await list(p);
  assert.equal(after.length, 22);
  assert.deepEqual(
    after.filter((r) => r.origin !== "Manual Entry"),
    before,
  );
  assert.deepEqual(
    after.find((r) => r.id === a.id),
    a,
  );
  await p.end();
});
test("retries create one row and one creation audit; changed payload cannot reuse the key", async () => {
  const p = database(),
    payload = input();
  const a = await create(p, payload),
    b = await create(p, payload);
  assert.deepEqual(a, b);
  await assert.rejects(
    () => create(p, { ...payload, channel: "Facebook" }),
    /already used/,
  );
  assert.equal((await list(p)).length, 21);
  assert.equal((await p.query("SELECT * FROM biai_web_audit")).rows.length, 1);
  await p.end();
});
test("creation rejects existing IDs, official origin, empty messages, invalid channels and Paid", () => {
  for (const extra of [
    { id: 1 },
    { origin: "Official Dataset" },
    { message: " " },
    { channel: "CSV" },
    { changes: { ...input().changes, status: "Paid" } },
  ])
    assert.equal(
      createSchema.safeParse({ ...input(), ...extra }).success,
      false,
    );
});
test("missing identity remains blank and unsupported AI identity provenance is rejected", () => {
  const payload = input();
  const grounded = ground(
    { ...analysis, phone_number: seed()[0].phone },
    payload.message,
  );
  assert.equal(grounded.phone_number, null);
  const row = newEnquiry({ ...payload, analysis: grounded }, 1000000);
  assert.equal(row.phone, "");
  assert.equal(row.name, "");
  assert.equal(fieldOrigin(row, "phone"), "Not provided");
  assert.throws(
    () =>
      newEnquiry(
        {
          ...payload,
          analysis: grounded,
          changes: { ...payload.changes, phone: seed()[0].phone },
          provenance: { phone: "Extracted by AI" },
        },
        1000000,
      ),
    /provenance/,
  );
});
test("official metadata, AI evidence and manual changes have distinct persisted provenance", async () => {
  const p = database(),
    official = (await list(p))[0];
  assert.equal(fieldOrigin(official, "phone"), "From official dataset");
  const payload = input();
  const row = await create(p, {
    ...payload,
    analysis,
    changes: { ...payload.changes, programme: analysis.programme },
    provenance: { programme: "Extracted by AI" },
  });
  assert.equal(fieldOrigin(row, "programme"), "Extracted by AI");
  const changed = await save(p, {
    id: row.id,
    version: row.version,
    changes: { ...editable(row), programme: "Fellowship" },
    identityApproved: false,
    paymentVerified: false,
    followUp: false,
  });
  assert.equal(fieldOrigin(changed, "programme"), "Manual");
  assert.deepEqual(
    (await list(p)).find((r) => r.id === row.id)?.provenance,
    changed.provenance,
  );
  await p.end();
});
test("both review transitions persist, retain corrections/analysis/reply and stage, and are audited", async () => {
  const p = database(),
    payload = input();
  let row = await create(p, {
    ...payload,
    analysis,
    changes: { ...payload.changes, suggested_reply: analysis.suggested_reply },
  });
  for (const pending of [false, true]) {
    const previous = row;
    row = await save(p, {
      id: row.id,
      version: row.version,
      changes: { ...editable(row), needs_human_review: pending },
      identityApproved: false,
      paymentVerified: false,
      followUp: false,
    });
    const persisted = (await list(p)).find((r) => r.id === row.id)!;
    assert.equal(persisted.needs_human_review, pending);
    assert.equal(persisted.status, previous.status);
    assert.equal(persisted.message, previous.message);
    assert.equal(persisted.suggested_reply, previous.suggested_reply);
    assert.deepEqual(persisted.analysis, previous.analysis);
    assert.equal(persisted.phone, previous.phone);
  }
  const events = (await p.query("SELECT event FROM biai_web_audit ORDER BY id"))
    .rows;
  assert.equal(events[1].event.reviewFrom, "Pending");
  assert.equal(events[1].event.reviewTo, "Reviewed");
  assert.equal(events[2].event.reviewFrom, "Reviewed");
  assert.equal(events[2].event.reviewTo, "Pending");
  assert.deepEqual(
    (await list(p)).filter((r) => r.origin !== "Manual Entry"),
    seed(),
  );
  await p.end();
});
