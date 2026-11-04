import { z } from "zod";
import source from "../data/source.json";
export const STAGES = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost",
] as const;
export const PROGRAMMES = [
  "Unclassified",
  "Bootcamp",
  "Fellowship",
  "Corporate Training",
  "Masterclass",
] as const;
export const TYPES = [
  "Unclassified",
  "Sales",
  "Support",
  "Spam",
  "Job Enquiry",
  "Other",
] as const;
export const LANGUAGES = [
  "Unknown",
  "English",
  "Bangla",
  "Banglish",
  "Mixed",
] as const;
export const analysisSchema = z.object({
  customer_name: z.string().max(250).nullable(),
  phone_number: z.string().max(100).nullable(),
  programme: z.enum(PROGRAMMES),
  enquiry_type: z.enum(TYPES),
  detected_language: z.enum(LANGUAGES),
  customer_intent: z.string().min(1).max(1500),
  suggested_reply: z.string().max(4000),
  needs_human_review: z.boolean(),
  // Optional for compatibility with previously saved analysis and older clients.
  recommended_pipeline_stage: z.enum(STAGES).optional(),
  pipeline_reason: z.string().min(1).max(800).optional(),
  pipeline_confidence: z.enum(["low", "medium", "high"]).optional(),
  requires_staff_approval: z.literal(true).optional(),
  payment_verification_required: z.boolean().optional(),
  pipeline_evidence: z.string().max(15000).optional(),
  pipeline_signal: z
    .enum([
      "initial_enquiry",
      "explicit_interest",
      "explicit_decline",
      "confirmed_contact",
      "payment_claim",
      "unclear",
    ])
    .optional(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const editableSchema = z
  .object({
    name: z.string().trim().max(250),
    phone: z.string().max(100),
    programme: z.enum(PROGRAMMES),
    enquiry_type: z.enum(TYPES),
    status: z.enum(STAGES),
    detected_language: z.enum(LANGUAGES),
    customer_intent: z.string().max(1500),
    suggested_reply: z.string().max(4000),
    needs_human_review: z.boolean(),
  })
  .strict();
export type Editable = z.infer<typeof editableSchema>;
export const CHANNELS = [
  "WhatsApp",
  "Facebook",
  "Website",
  "Phone Call",
] as const;
export type Provenance = "From official dataset" | "Extracted by AI" | "Manual";
const provenanceSchema = z.partialRecord(
  z.enum(
    Object.keys(editableSchema.shape) as [
      keyof Editable,
      ...(keyof Editable)[],
    ],
  ),
  z.enum(["Extracted by AI", "Manual"]),
);
export type Enquiry = Editable & {
  origin?: "Official Dataset" | "Manual Entry";
  provenance?: Partial<Record<keyof Editable, Provenance>>;
  analysis?: Analysis;
  contact_confirmed_at?: string;
  analysis_message?: string;

  id: number;
  channel: string;
  received: string;
  message: string;
  original_name: string;
  original_phone: string;
  version: number;
  last_follow_up: string | null;
  updated_at: string | null;
  analysis_origin: string;
};
export type SaveInput = {
  id: number;
  version: number;
  changes: Editable;
  paymentVerified: boolean;
  identityApproved: boolean;
  followUp: boolean;
  analysisMessage?: string;
  targetConfirmed?: boolean;
  provenance?: Partial<Record<keyof Editable, "Extracted by AI" | "Manual">>;
  analysis?: Analysis;
};
export const saveSchema = z
  .object({
    id: z.number().int().positive(),
    version: z.number().int().nonnegative(),
    changes: editableSchema,
    paymentVerified: z.boolean(),
    identityApproved: z.boolean(),
    followUp: z.boolean(),
    analysisMessage: z.string().max(15000).optional(),
    targetConfirmed: z.boolean().optional(),
    provenance: provenanceSchema.optional(),
    analysis: analysisSchema.optional(),
  })
  .strict();
export function seed(): Enquiry[] {
  return source.map((r) => ({
    origin: "Official Dataset",
    id: Number(r.id),
    channel: r.channel,
    received: r["received at"],
    message: r.message,
    original_name: r["sender name"],
    original_phone: r.phone,
    name: r["sender name"],
    phone: r.phone,
    programme: "Unclassified",
    enquiry_type: "Unclassified",
    status: "New",
    detected_language: "Unknown",
    customer_intent: "",
    suggested_reply: "",
    needs_human_review: true,
    version: 0,
    last_follow_up: null,
    updated_at: null,
    analysis_origin: "Not analyzed",
  }));
}
export function editable(r: Enquiry): Editable {
  return editableSchema.parse(
    Object.fromEntries(
      Object.keys(editableSchema.shape).map((k) => [k, r[k as keyof Enquiry]]),
    ),
  );
}
export function applySave(old: Enquiry, input: SaveInput): Enquiry {
  const p = saveSchema.parse(input);
  if (old.id !== p.id) throw Error("Record not found.");
  if (
    p.analysisMessage !== undefined &&
    p.analysisMessage !== old.message &&
    !p.targetConfirmed
  )
    throw Error(
      "Confirm the target enquiry before saving pasted-text results.",
    );
  if (old.version !== p.version)
    throw Error("This record changed. Reload it before saving.");
  if (
    p.changes.status === "Paid" &&
    old.status !== "Paid" &&
    !p.paymentVerified
  )
    throw Error("Verify payment independently before moving to Paid.");
  if (
    (p.changes.name !== old.name || p.changes.phone !== old.phone) &&
    !p.identityApproved
  )
    throw Error("Approve the name or phone correction before saving.");
  const changes = { ...p.changes };
  if (changes.enquiry_type === "Spam") {
    changes.suggested_reply = "";
    changes.programme = "Unclassified";
  }
  if (changes.enquiry_type === "Job Enquiry")
    changes.programme = "Unclassified";
  if (
    !p.followUp &&
    !p.analysis &&
    !p.provenance &&
    JSON.stringify(editable(old)) === JSON.stringify(changes)
  )
    return old;
  return {
    ...old,
    ...changes,
    provenance: resolveProvenance(
      changes,
      p.provenance,
      p.analysis,
      p.analysisMessage ?? old.message,
      old,
    ),
    ...(p.analysis
      ? {
          analysis: ground(p.analysis, p.analysisMessage ?? old.message),
          analysis_message: p.analysisMessage ?? old.message,
        }
      : {}),
    ...(changes.status === "Contacted" && old.status !== "Contacted"
      ? { contact_confirmed_at: new Date().toISOString() }
      : {}),
    version: old.version + 1,
    updated_at: new Date().toISOString(),
    last_follow_up: p.followUp ? new Date().toISOString() : old.last_follow_up,
    analysis_origin: "Staff reviewed",
  };
}
export function ground(a: Analysis, message: string): Analysis {
  const out = { ...a };
  if (
    out.customer_name &&
    !message.toLocaleLowerCase().includes(out.customer_name.toLocaleLowerCase())
  ) {
    out.customer_name = null;
    out.needs_human_review = true;
  }
  const digits = (s: string) =>
    s
      .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
      .replace(/\D/g, "");
  if (out.phone_number) {
    const d = digits(out.phone_number);
    const spans =
      message.match(
        /(?<![\p{L}\p{N}])\+?[0-9০-৯][0-9০-৯ ()-]{5,}[0-9০-৯](?![\p{L}\p{N}])/gu,
      ) || [];
    if (d.length < 7 || d.length > 15 || !spans.some((s) => digits(s) === d)) {
      out.phone_number = null;
      out.needs_human_review = true;
    }
  }
  if (out.enquiry_type === "Spam") {
    out.suggested_reply = "";
    out.programme = "Unclassified";
  }
  if (out.enquiry_type === "Job Enquiry") out.programme = "Unclassified";
  if (
    ["Support", "Other", "Job Enquiry", "Unclassified"].includes(
      out.enquiry_type,
    )
  )
    out.needs_human_review = true;
  return out;
}
export function filterRows(
  rows: Enquiry[],
  query: string,
  type: string,
  stage: string,
  programme: string,
) {
  const q = query.toLowerCase();
  return rows.filter(
    (r) =>
      (!q ||
        [r.name, r.phone, r.message, r.channel].some((x) =>
          x.toLowerCase().includes(q),
        )) &&
      (type === "All" || r.enquiry_type === type) &&
      (stage === "All" || r.status === stage) &&
      (programme === "All" || r.programme === programme),
  );
}
export function csvExport(rows: Enquiry[]) {
  const cols = [
    "id",
    "name",
    "phone",
    "channel",
    "origin",
    "programme",
    "enquiry_type",
    "status",
    "customer_intent",
    "suggested_reply",
  ];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      cols,
      ...rows.map((r) =>
        cols.map((k) =>
          k === "origin"
            ? r.origin || "Official Dataset"
            : r[k as keyof Enquiry],
        ),
      ),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}

export function fieldOrigin(
  row: Enquiry,
  key: keyof Editable,
): Provenance | "Not provided" {
  if (row[key] === "") return "Not provided";
  if (row.provenance?.[key]) return row.provenance[key]!;
  if (
    row.origin !== "Manual Entry" &&
    ((key === "name" && row.name === row.original_name) ||
      (key === "phone" && row.phone === row.original_phone))
  )
    return "From official dataset";
  return "Manual";
}
export function resolveProvenance(
  changes: Editable,
  requested: SaveInput["provenance"],
  analysis: Analysis | undefined,
  message: string,
  old?: Enquiry,
) {
  const grounded = analysis ? ground(analysis, message) : undefined;
  const values = grounded && {
    name: grounded.customer_name,
    phone: grounded.phone_number,
    programme: grounded.programme,
    enquiry_type: grounded.enquiry_type,
    detected_language: grounded.detected_language,
    customer_intent: grounded.customer_intent,
    suggested_reply: grounded.suggested_reply,
    needs_human_review: grounded.needs_human_review,
  };
  const result: Partial<Record<keyof Editable, Provenance>> = {};
  for (const key of Object.keys(changes) as (keyof Editable)[]) {
    if (requested?.[key] === "Extracted by AI") {
      if (
        !values ||
        !(key in values) ||
        changes[key] !== values[key as keyof typeof values]
      )
        throw Error("AI provenance must match the message analysis.");
      result[key] = "Extracted by AI";
    } else if (
      requested?.[key] === "Manual" ||
      !old ||
      changes[key] !== old[key]
    )
      result[key] = "Manual";
    else {
      const origin = fieldOrigin(old, key);
      if (origin !== "Not provided") result[key] = origin;
    }
  }
  return result;
}
export const createSchema = z
  .object({
    requestId: z.string().uuid(),
    channel: z.enum(CHANNELS),
    message: z.string().trim().min(1).max(15000),
    changes: editableSchema.extend({ status: z.literal("New") }),
    provenance: provenanceSchema.optional(),
    analysis: analysisSchema.optional(),
  })
  .strict();
export type CreateInput = z.infer<typeof createSchema>;
export function newEnquiry(input: CreateInput, id: number): Enquiry {
  const p = createSchema.parse(input);
  const changes = { ...p.changes };
  if (changes.enquiry_type === "Spam") {
    changes.programme = "Unclassified";
    changes.suggested_reply = "";
  }
  if (changes.enquiry_type === "Job Enquiry")
    changes.programme = "Unclassified";
  return {
    ...changes,
    id,
    origin: "Manual Entry",
    channel: p.channel,
    message: p.message,
    original_name: "",
    original_phone: "",
    received: new Date().toISOString(),
    version: 0,
    updated_at: null,
    last_follow_up: null,
    analysis_origin: "Staff reviewed",
    provenance: resolveProvenance(changes, p.provenance, p.analysis, p.message),
    ...(p.analysis ? { analysis: ground(p.analysis, p.message) } : {}),
  };
}

export type PipelineContext = {
  status: (typeof STAGES)[number];
  contactRecorded: boolean;
};
export function pipelineContext(row?: Enquiry): PipelineContext {
  return {
    status: row?.status ?? "New",
    contactRecorded: !!(
      row?.contact_confirmed_at ||
      row?.last_follow_up ||
      row?.status === "Contacted"
    ),
  };
}
// AI output is a recommendation, never an Editable.status mutation.
export function groundPipeline(
  a: Analysis,
  message: string,
  context: PipelineContext,
): Analysis {
  if (!a.recommended_pipeline_stage) return a; // Legacy analysis.
  const result: Analysis = { ...a, requires_staff_approval: true };
  const keep = (reason: string, review = true): Analysis => ({
    ...result,
    recommended_pipeline_stage: context.status,
    pipeline_reason: reason,
    pipeline_confidence: "low",
    needs_human_review: a.needs_human_review || review,
  });
  const paymentClaim =
    a.payment_verification_required ||
    a.pipeline_signal === "payment_claim" ||
    a.recommended_pipeline_stage === "Paid" ||
    /(?:\bi\s+(?:have\s+)?paid\b|payment\s+(?:korechi|korsi|done|completed)|পেমেন্ট\s*(?:করেছি|করা)|টাকা\s*(?:দিয়েছি|পাঠিয়েছি))/iu.test(
      message,
    );
  if (context.status === "Paid")
    return {
      ...keep(
        "Keep the staff-verified Paid stage. AI cannot override verified payment.",
        false,
      ),
      pipeline_confidence: "high",
      payment_verification_required: false,
    };
  if (paymentClaim) {
    result.payment_verification_required = true;
    return keep(
      "Payment is unverified. Staff must independently verify payment before choosing Paid.",
    );
  }
  if (a.enquiry_type !== "Sales")
    return keep(
      "This is not a qualified sales enquiry. Keep the current stage and review manually.",
    );
  if (a.recommended_pipeline_stage === "Contacted" && !context.contactRecorded)
    return keep(
      "No staff contact is recorded. Analysis alone does not mean the customer was contacted.",
    );
  if (/refund|cancel|ferot|ferat|ফেরত|রিফান্ড|বাতিল/iu.test(message))
    return keep(
      "Refund or cancellation discussion needs staff review; it does not automatically mean Lost.",
    );
  const evidence = a.pipeline_evidence?.trim();
  if (
    a.pipeline_confidence === "low" ||
    !a.pipeline_confidence ||
    !a.pipeline_reason ||
    !evidence ||
    !message.toLocaleLowerCase().includes(evidence.toLocaleLowerCase())
  )
    return keep(
      "Insufficient clear message evidence. Keep the current stage for human review.",
    );
  const signals = {
    New: "initial_enquiry",
    Contacted: "confirmed_contact",
    Interested: "explicit_interest",
    Lost: "explicit_decline",
  } as const;
  if (
    a.pipeline_signal !==
    signals[a.recommended_pipeline_stage as keyof typeof signals]
  )
    return keep(
      "The recommendation lacks a matching customer action. Keep the current stage for human review.",
    );
  return result;
}
