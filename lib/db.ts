import { createHash } from "node:crypto";
import { createSchema, newEnquiry, type CreateInput } from "./domain";
import { Pool } from "pg";
import {
  seed,
  editable,
  applySave,
  saveSchema,
  type SaveInput,
  type Enquiry,
} from "./domain";
export type DB = Pick<Pool, "query" | "connect">;
let pool: Pool | undefined;
export function db(): Pool {
  if (!process.env.DATABASE_URL) throw Error("Database is not configured.");
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  }));
}
export async function setup(p: DB) {
  await p.query(
    `CREATE TABLE IF NOT EXISTS biai_web_enquiries(id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data JSONB NOT NULL); CREATE TABLE IF NOT EXISTS biai_web_audit(id BIGSERIAL PRIMARY KEY,enquiry_id INTEGER NOT NULL,event JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS biai_web_budget(day TEXT PRIMARY KEY,used INTEGER NOT NULL);
    CREATE SEQUENCE IF NOT EXISTS biai_manual_id START WITH 1000000;
    ALTER TABLE biai_web_enquiries ADD COLUMN IF NOT EXISTS request_id TEXT;
    ALTER TABLE biai_web_enquiries ADD COLUMN IF NOT EXISTS request_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS biai_enquiry_request ON biai_web_enquiries(request_id);`,
  );
}
export async function importSource(p: DB) {
  await setup(p);
  for (const row of seed())
    await p.query(
      "INSERT INTO biai_web_enquiries(id,version,data) VALUES($1,0,$2) ON CONFLICT(id) DO NOTHING",
      [row.id, JSON.stringify(row)],
    );
}
export async function list(p: DB): Promise<Enquiry[]> {
  await importSource(p);
  return (
    await p.query("SELECT data FROM biai_web_enquiries ORDER BY id")
  ).rows.map((r) => r.data);
}
export async function save(p: DB, input: SaveInput) {
  saveSchema.parse(input);
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    const found = await c.query(
      "SELECT data FROM biai_web_enquiries WHERE id=$1 FOR UPDATE",
      [input.id],
    );
    if (!found.rows[0]) throw Error("Record not found.");
    const old = found.rows[0].data as Enquiry;
    const row = applySave(old, input);
    if (row !== old) {
      const result = await c.query(
        "UPDATE biai_web_enquiries SET data=$1,version=$2 WHERE id=$3 AND version=$4",
        [JSON.stringify(row), row.version, row.id, input.version],
      );
      if (result.rowCount !== 1)
        throw Error("This record changed. Reload it before saving.");
      await c.query(
        "INSERT INTO biai_web_audit(enquiry_id,event) VALUES($1,$2)",
        [
          row.id,
          JSON.stringify({
            before: editable(old),
            after: editable(row),
            reviewFrom: old.needs_human_review ? "Pending" : "Reviewed",
            reviewTo: row.needs_human_review ? "Pending" : "Reviewed",
            from: old.status,
            to: row.status,
            paymentVerified: input.paymentVerified,
            identityApproved: input.identityApproved,
            followUp: input.followUp,
            version: row.version,
          }),
        ],
      );
    }
    await c.query("COMMIT");
    return row;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function reserve(p: DB, key: string, limit: number) {
  await p.query(
    "INSERT INTO biai_web_budget(day,used) VALUES($1,0) ON CONFLICT(day) DO NOTHING",
    [key],
  );
  const r = await p.query(
    "UPDATE biai_web_budget SET used=used+1 WHERE day=$1 AND used<$2 RETURNING used",
    [key, limit],
  );
  if (!r.rowCount)
    throw Error("Request limit reached. Please try again later.");
}
export function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// A database sequence allocates IDs; a unique request key makes retries safe across instances.
export async function create(p: DB, input: CreateInput): Promise<Enquiry> {
  const parsed = createSchema.parse(input);
  const draft = newEnquiry(parsed, 0); // Validate before starting a transaction.
  const hash = createHash("sha256")
    .update(JSON.stringify(parsed))
    .digest("hex");
  await importSource(p);
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    const inserted = await c.query(
      "INSERT INTO biai_web_enquiries(id,version,data,request_id,request_hash) VALUES(nextval('biai_manual_id'),0,$1,$2,$3) ON CONFLICT(request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING id,data,request_hash",
      [JSON.stringify(draft), parsed.requestId, hash],
    );
    let row: Enquiry;
    const stored = inserted.rows[0];
    if (stored.request_hash !== hash)
      throw Error(
        "This creation request was already used. Reload before creating another enquiry.",
      );
    if (stored.data.id === 0) {
      row = { ...stored.data, id: Number(stored.id) };
      await c.query("UPDATE biai_web_enquiries SET data=$1 WHERE id=$2", [
        JSON.stringify(row),
        row.id,
      ]);
      await c.query(
        "INSERT INTO biai_web_audit(enquiry_id,event) VALUES($1,$2)",
        [
          row.id,
          JSON.stringify({
            action: "Created",
            origin: "Manual Entry",
            to: "New",
            reviewTo: row.needs_human_review ? "Pending" : "Reviewed",
          }),
        ],
      );
    } else {
      row = stored.data;
    }
    await c.query("COMMIT");
    return row;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
