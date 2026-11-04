import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { create, list, save, type DB } from "../lib/db";
import { seed, editable, type CreateInput } from "../lib/domain";
// PGlite runs PostgreSQL itself in WASM, including actual transaction rollback.
// This adapter is test-only; production continues using pg.Pool against Neon.
function adapter(pg: PGlite, failAudit = false): DB {
  const query = async (sql: string, values?: unknown[]) => {
    if (failAudit && sql.startsWith("INSERT INTO biai_web_audit"))
      throw Error("Injected audit failure");
    const result = values
      ? await pg.query(sql, values)
      : (await pg.exec(sql)).at(-1)!;
    return { ...result, rowCount: result.affectedRows, rows: result.rows };
  };
  return {
    query,
    connect: async () => ({ query, release() {} }),
  } as unknown as DB;
}
test("real PostgreSQL engine: creation/retry, audit rollback, disk persistence and reversible review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "biai-pg-"));
  let pg = new PGlite(directory);
  try {
    let p = adapter(pg);
    const original = await list(p);
    const payload: CreateInput = {
      requestId: randomUUID(),
      channel: "Phone Call",
      message: seed()[0].message,
      changes: {
        ...editable(seed()[0]),
        status: "New",
        name: "",
        phone: "",
        suggested_reply: "Reviewed draft",
      },
    };
    const row = await create(p, payload);
    assert.deepEqual(await create(p, payload), row);
    await assert.rejects(
      () => create(adapter(pg, true), { ...payload, requestId: randomUUID() }),
      /Injected audit failure/,
    );
    assert.equal((await list(p)).length, 21);
    assert.equal(
      (await p.query("SELECT * FROM biai_web_audit")).rows.length,
      1,
    );
    let current = row;
    for (const pending of [false, true]) {
      current = await save(p, {
        id: current.id,
        version: current.version,
        changes: { ...editable(current), needs_human_review: pending },
        paymentVerified: false,
        identityApproved: false,
        followUp: false,
      });
      assert.equal(current.status, "New");
      assert.equal(current.suggested_reply, "Reviewed draft");
    }
    await pg.close();
    pg = new PGlite(directory);
    p = adapter(pg);
    const reloaded = await list(p);
    assert.deepEqual(
      reloaded.find((r) => r.id === current.id),
      current,
    );
    assert.deepEqual(
      reloaded.filter((r) => r.origin !== "Manual Entry"),
      original,
    );
    assert.equal(
      (await p.query("SELECT * FROM biai_web_audit")).rows.length,
      3,
    );
  } finally {
    await pg.close();
    await rm(directory, { recursive: true, force: true });
  }
});
