import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  editable,
  applySave,
  ground,
  analysisSchema,
  filterRows,
  csvExport,
  saveSchema,
  type Analysis,
} from "../lib/domain";
import { responseSchema } from "../lib/ai";
import source from "../data/source.json";
const draft: Analysis = {
  customer_name: null,
  phone_number: null,
  programme: "Bootcamp",
  enquiry_type: "Sales",
  detected_language: "English",
  customer_intent: "Course enquiry",
  suggested_reply: "Our team can confirm the details.",
  needs_human_review: false,
};
const input = (r = seed()[0]) => ({
  id: r.id,
  version: r.version,
  changes: editable(r),
  paymentVerified: false,
  identityApproved: false,
  followUp: false,
});
for (const [i, s] of source.entries())
  test(`source record ${i + 1} preserved`, () => {
    const r = seed()[i];
    assert.equal(r.message, s.message);
    assert.equal(r.original_name, s["sender name"]);
    assert.equal(r.original_phone, s.phone);
    assert.equal(r.status, "New");
    assert.equal(r.enquiry_type, "Unclassified");
    assert.equal(r.received, s["received at"]);
  });
test("20 messages, 19 contacts, 6 missing phones", () => {
  const rows = seed();
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((r) => r.phone || "id" + r.id)).size, 19);
  assert.equal(rows.filter((r) => !r.phone).length, 6);
});
test("paid status requires independent verification", () => {
  const r = seed()[0],
    p = input(r);
  p.changes.status = "Paid";
  assert.throws(() => applySave(r, p), /Verify payment/);
  assert.equal(applySave(r, { ...p, paymentVerified: true }).status, "Paid");
});
test("identity correction must be approved", () => {
  const r = seed()[0],
    p = input(r);
  p.changes.name = "Corrected name";
  assert.throws(() => applySave(r, p), /Approve/);
  const saved = applySave(r, { ...p, identityApproved: true });
  assert.equal(saved.name, "Corrected name");
  assert.equal(saved.original_name, r.name);
});
test("stale writes rejected", () => {
  const r = seed()[0];
  assert.throws(() => applySave({ ...r, version: 1 }, input(r)), /changed/);
});
test("identical save does not create a new version", () => {
  const r = seed()[0];
  assert.equal(applySave(r, input(r)), r);
});
test("follow-up is explicit and recorded", () => {
  const r = seed()[0];
  assert.ok(applySave(r, { ...input(r), followUp: true }).last_follow_up);
  assert.equal(r.last_follow_up, null);
});
test("pasted message requires target confirmation", () => {
  const r = seed()[0];
  assert.throws(
    () => applySave(r, { ...input(r), analysisMessage: "different" }),
    /Confirm/,
  );
  assert.doesNotThrow(() =>
    applySave(r, {
      ...input(r),
      analysisMessage: "different",
      targetConfirmed: true,
    }),
  );
});
test("source fields cannot be supplied as changes", () => {
  const r = seed()[0];
  assert.throws(() =>
    saveSchema.parse({
      ...input(r),
      changes: { ...editable(r), message: "replace original" },
    }),
  );
});
test("spam suppresses reply and programme", () => {
  const r = seed()[0],
    p = input(r);
  p.changes.enquiry_type = "Spam";
  p.changes.suggested_reply = "Do not send";
  p.changes.programme = "Bootcamp";
  const saved = applySave(r, p);
  assert.equal(saved.suggested_reply, "");
  assert.equal(saved.programme, "Unclassified");
});
for (const type of ["Support", "Job Enquiry", "Other", "Unclassified"] as const)
  test(type + " permits explicit staff review", () => {
    const r = seed()[0],
      p = input(r);
    p.changes.enquiry_type = type;
    p.changes.needs_human_review = false;
    assert.equal(applySave(r, p).needs_human_review, false);
  });
test("hallucinated identity removed", () => {
  const out = ground(
    { ...draft, customer_name: "Invented", phone_number: "01712345678" },
    "How much is the course?",
  );
  assert.equal(out.customer_name, null);
  assert.equal(out.phone_number, null);
  assert.equal(out.needs_human_review, true);
});
test("explicit Bengali phone retained", () => {
  const out = ground(
    { ...draft, customer_name: "রাফি", phone_number: "০১৭১২৩৪৫৬৭৮" },
    "আমার নাম রাফি। ফোন ০১৭১২৩৪৫৬৭৮।",
  );
  assert.equal(out.phone_number, "০১৭১২৩৪৫৬৭৮");
  assert.equal(out.customer_name, "রাফি");
});
test("separate numbers cannot become a phone", () => {
  assert.equal(
    ground(
      { ...draft, phone_number: "202610261200" },
      "Date 2026-10-26, price 1200",
    ).phone_number,
    null,
  );
});
test("invalid classifications rejected", () => {
  assert.throws(() =>
    analysisSchema.parse({ ...draft, programme: "Guaranteed Job" }),
  );
});
test("provider schema excludes additionalProperties", () => {
  assert.ok(!JSON.stringify(responseSchema).includes("additionalProperties"));
  assert.deepEqual(responseSchema.required.sort(), Object.keys(responseSchema.properties).sort());
});
test("search filters work across message and phone", () => {
  assert.equal(
    filterRows(seed(), "01711000001", "All", "All", "All").length,
    2,
  );
  assert.equal(filterRows(seed(), "", "Sales", "All", "All").length, 0);
});
test("CSV escapes spreadsheet formulas and quotes", () => {
  const r = seed()[0];
  const csv = csvExport([{ ...r, name: '=HYPERLINK("x")' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
});
