import { GoogleGenAI } from "@google/genai";
import {
  analysisSchema,
  ground,
  groundPipeline,
  type PipelineContext,
  STAGES,
  type Analysis,
  PROGRAMMES,
  TYPES,
  LANGUAGES,
} from "./domain";
import { SYSTEM, PIPELINE_RULES } from "./prompt";
export const responseSchema = {
  type: "object",
  properties: {
    customer_name: { type: ["string", "null"] },
    phone_number: { type: ["string", "null"] },
    programme: { type: "string", enum: PROGRAMMES },
    enquiry_type: { type: "string", enum: TYPES },
    detected_language: { type: "string", enum: LANGUAGES },
    customer_intent: { type: "string" },
    suggested_reply: { type: "string" },
    needs_human_review: { type: "boolean" },
    recommended_pipeline_stage: { type: "string", enum: STAGES },
    pipeline_reason: { type: "string" },
    pipeline_confidence: { type: "string", enum: ["low", "medium", "high"] },
    requires_staff_approval: { type: "boolean", enum: [true] },
    payment_verification_required: { type: "boolean" },
    pipeline_evidence: { type: "string" },
    pipeline_signal: {
      type: "string",
      enum: [
        "initial_enquiry",
        "explicit_interest",
        "explicit_decline",
        "confirmed_contact",
        "payment_claim",
        "unclear",
      ],
    },
  },
  required: Object.keys(analysisSchema.shape),
};
export async function analyze(
  message: string,
  current?: Analysis,
  context: PipelineContext = { status: "New", contactRecorded: false },
): Promise<Analysis> {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)
    throw Error(
      "Add GEMINI_API_KEY and GEMINI_MODEL to enable AI. Manual review is available.",
    );
  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: Math.max(
          10000,
          Math.min(120000, Number(process.env.GEMINI_TIMEOUT_MS) || 120000),
        ),
      },
    });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: JSON.stringify({
        message,
        reviewed_context: current ?? null,
        pipeline_context: context,
      }),
      config: {
        systemInstruction:
          SYSTEM +
          PIPELINE_RULES +
          (current
            ? " Regenerate only the reply using the staff-reviewed context."
            : ""),
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
        temperature: 0.2,
      },
    });
    const result = ground(
      analysisSchema.parse(JSON.parse(response.text || "")),
      message,
    );
    return current
      ? {
          ...current,
          suggested_reply:
            current.enquiry_type === "Spam" ? "" : result.suggested_reply,
        }
      : groundPipeline(result, message, context);
  } catch (e) {
    const code = Number((e as { status?: number }).status);
    if (code === 429)
      throw Error(
        "Gemini quota reached. Check AI Studio usage and retry later.",
      );
    if (code === 401 || code === 403)
      throw Error(
        "Gemini access rejected. Check your API key and permissions.",
      );
    if (code === 404)
      throw Error(
        "Gemini model unavailable. Set GEMINI_MODEL to a model available in AI Studio.",
      );
    if (code === 400)
      throw Error(
        "Gemini rejected the request. Check the model, key and JSON schema compatibility.",
      );
    throw Error(
      "Gemini did not return valid output in time. No records were changed; retry or review manually.",
    );
  }
}
