import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analysisSchema,
  groundPipeline,
  pipelineContext,
  seed,
  editable,
  applySave,
  type Analysis,
  type SaveInput,
} from "../lib/domain";
import { responseSchema } from "../lib/ai";
const message =
  "Ami admission nite interested. Registration process ta bolben?";
const suggestion: Analysis = {
  customer_name: null,
  phone_number: null,
  programme: "Bootcamp",
  enquiry_type: "Sales",
  detected_language: "Banglish",
  customer_intent: "Wants to join",
  suggested_reply: "The team can help with registration.",
  needs_human_review: false,
  recommended_pipeline_stage: "Interested",
  pipeline_reason: "Customer explicitly expresses interest in joining.",
  pipeline_confidence: "high",
  requires_staff_approval: true,
  payment_verification_required: false,
  pipeline_signal: "explicit_interest",
  pipeline_evidence: message,
};
const context = { status: "New" as const, contactRecorded: false };
function payload(): SaveInput {
  const row = seed()[0];
  return {
    id: row.id,
    version: row.version,
    changes: editable(row),
    identityApproved: false,
    paymentVerified: false,
    followUp: false,
  };
}
test("valid explicit interest is recommended, with approval required", () => {
  const result = groundPipeline(suggestion, message, context);
  assert.equal(result.recommended_pipeline_stage, "Interested");
  assert.equal(result.requires_staff_approval, true);
});
test("initial fee question stays New", () => {
  const text = "Bhai AI Bootcamp er fee koto?";
  const result = groundPipeline(
    {
      ...suggestion,
      recommended_pipeline_stage: "New",
      pipeline_signal: "initial_enquiry",
      pipeline_evidence: text,
    },
    text,
    context,
  );
  assert.equal(result.recommended_pipeline_stage, "New");
});
test("explicit decline may recommend Lost", () => {
  const text = "Ami join korbo na, thanks.";
  const result = groundPipeline(
    {
      ...suggestion,
      recommended_pipeline_stage: "Lost",
      pipeline_signal: "explicit_decline",
      pipeline_evidence: text,
    },
    text,
    context,
  );
  assert.equal(result.recommended_pipeline_stage, "Lost");
  assert.equal(result.pipeline_confidence, "high");
});
for (const text of [
  "Ami payment korechi.",
  "I have paid.",
  "আমি পেমেন্ট করেছি",
])
  test("payment claim requires verification: " + text, () => {
    const result = groundPipeline(
      { ...suggestion, pipeline_evidence: text },
      text,
      context,
    );
    assert.equal(result.recommended_pipeline_stage, "New");
    assert.equal(result.payment_verification_required, true);
    assert.equal(result.needs_human_review, true);
  });
test("Paid recommendation cannot bypass independent staff verification", () => {
  const result = groundPipeline(
    { ...suggestion, recommended_pipeline_stage: "Paid" },
    message,
    context,
  );
  assert.equal(result.recommended_pipeline_stage, "New");
  const input = payload();
  input.analysis = result;
  input.changes.status = "Paid";
  assert.throws(() => applySave(seed()[0], input), /Verify payment/);
  input.paymentVerified = true;
  assert.equal(applySave(seed()[0], input).status, "Paid");
});
test("verified Paid is not downgraded by AI", () => {
  const result = groundPipeline(
    { ...suggestion, recommended_pipeline_stage: "Lost" },
    message,
    { status: "Paid", contactRecorded: true },
  );
  assert.equal(result.recommended_pipeline_stage, "Paid");
});
test("Contacted requires a recorded or staff-confirmed contact", () => {
  const draft = {
    ...suggestion,
    recommended_pipeline_stage: "Contacted" as const,
    pipeline_signal: "confirmed_contact" as const,
  };
  assert.equal(
    groundPipeline(draft, message, context).recommended_pipeline_stage,
    "New",
  );
  assert.equal(
    groundPipeline(draft, message, { ...context, contactRecorded: true })
      .recommended_pipeline_stage,
    "Contacted",
  );
  const input = payload();
  input.changes.status = "Contacted";
  const confirmed = applySave(seed()[0], input);
  assert.ok(confirmed.contact_confirmed_at);
  assert.equal(
    pipelineContext({ ...confirmed, status: "Interested" }).contactRecorded,
    true,
  );
});
for (const type of [
  "Spam",
  "Support",
  "Job Enquiry",
  "Other",
  "Unclassified",
] as const)
  test(type + " is not recommended as a qualified sales lead", () => {
    const result = groundPipeline(
      { ...suggestion, enquiry_type: type },
      message,
      context,
    );
    assert.equal(result.recommended_pipeline_stage, "New");
    assert.equal(result.needs_human_review, true);
  });
for (const text of ["Refund policy ki?", "I want to cancel.", "টাকা ফেরত চাই"])
  test("refund/cancellation does not imply Lost: " + text, () => {
    const result = groundPipeline(
      {
        ...suggestion,
        recommended_pipeline_stage: "Lost",
        pipeline_signal: "explicit_decline",
        pipeline_evidence: text,
      },
      text,
      { status: "Interested", contactRecorded: false },
    );
    assert.equal(result.recommended_pipeline_stage, "Interested");
    assert.equal(result.needs_human_review, true);
  });
test("unclear, low-confidence and fabricated evidence retain the current stage", () => {
  for (const patch of [
    { pipeline_signal: "unclear" as const },
    { pipeline_confidence: "low" as const },
    { pipeline_evidence: "Not present" },
  ]) {
    const result = groundPipeline({ ...suggestion, ...patch }, message, {
      status: "Contacted",
      contactRecorded: true,
    });
    assert.equal(result.recommended_pipeline_stage, "Contacted");
    assert.equal(result.needs_human_review, true);
  }
});
test("saving analysis without applying recommendation preserves stage; manual override still works", () => {
  const old = { ...seed()[0], status: "Contacted" as const };
  const input = { ...payload(), changes: editable(old), analysis: suggestion };
  const saved = applySave(old, input);
  assert.equal(saved.status, "Contacted");
  assert.equal(saved.analysis?.recommended_pipeline_stage, "Interested");
  assert.equal(old.version, 0);
  input.changes.status = "Lost";
  assert.equal(applySave(old, input).status, "Lost");
});
test("Zod validates pipeline statuses, confidence and mandatory approval flag; old analysis remains valid", () => {
  assert.equal(
    analysisSchema.safeParse({
      ...suggestion,
      recommended_pipeline_stage: "Qualified",
    }).success,
    false,
  );
  assert.equal(
    analysisSchema.safeParse({ ...suggestion, pipeline_confidence: "certain" })
      .success,
    false,
  );
  assert.equal(
    analysisSchema.safeParse({ ...suggestion, requires_staff_approval: false })
      .success,
    false,
  );
  const {
    recommended_pipeline_stage,
    pipeline_reason,
    pipeline_confidence,
    requires_staff_approval,
    payment_verification_required,
    pipeline_signal,
    pipeline_evidence,
    ...legacy
  } = suggestion;
  assert.equal(analysisSchema.safeParse(legacy).success, true);
  for (const key of [
    "recommended_pipeline_stage",
    "pipeline_reason",
    "pipeline_confidence",
    "requires_staff_approval",
  ])
    assert.ok(responseSchema.required.includes(key));
});

test("recommendation persists separately from stage in PostgreSQL storage until staff saves a stage change", async () => {
  const { newDb } = await import("pg-mem");
  const { list, save } = await import("../lib/db");
  const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
  const p = new Pool();
  try {
    const original = await list(p);
    const input = { ...payload(), analysis: suggestion, analysisMessage: message, targetConfirmed: true };
    const drafted = await save(p, input);
    assert.equal(drafted.status, "New");
    const reloaded = (await list(p))[0];
    assert.equal(reloaded.analysis?.recommended_pipeline_stage, "Interested");
    assert.equal(reloaded.analysis_message, message);
    assert.equal(reloaded.message, original[0].message);
    const accepted = await save(p, { ...payload(), version: reloaded.version, changes: { ...editable(reloaded), status: "Interested" } });
    assert.equal(accepted.status, "Interested");
    const events = (await p.query("SELECT event FROM biai_web_audit ORDER BY id")).rows;
    assert.equal(events[0].event.from, "New"); assert.equal(events[0].event.to, "New");
    assert.equal(events[1].event.to, "Interested");
    assert.deepEqual((await list(p)).slice(1), original.slice(1));
  } finally { await p.end(); }
});
